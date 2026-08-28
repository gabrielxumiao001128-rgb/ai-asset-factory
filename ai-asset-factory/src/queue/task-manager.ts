import type { AssetPackage, TaskStatus, TaskEvent } from '../types.js';
import { getDb } from '../db/index.js';

// SSE 实时推送监听器（必须在内存中，无法持久化）
const eventListeners = new Map<string, (event: TaskEvent) => void>();

/**
 * 将任务对象序列化为数据库记录
 */
function taskToRow(task: AssetPackage) {
  return {
    id: task.taskId,
    status: task.status,
    original_image_url: task.originalImageUrl,
    product_info_json: task.productInfo ? JSON.stringify(task.productInfo) : null,
    copywriting_json: task.copywriting ? JSON.stringify(task.copywriting) : null,
    images_json: task.images.length > 0 ? JSON.stringify(task.images) : null,
    video_json: task.video ? JSON.stringify(task.video) : null,
    error: task.error || null,
    created_at: task.createdAt,
    completed_at: task.completedAt || null,
  };
}

/**
 * 将数据库记录反序列化为任务对象
 */
function rowToTask(row: any): AssetPackage {
  return {
    taskId: row.id,
    status: row.status,
    originalImageUrl: row.original_image_url,
    productInfo: row.product_info_json ? JSON.parse(row.product_info_json) : undefined,
    copywriting: row.copywriting_json ? JSON.parse(row.copywriting_json) : undefined,
    images: row.images_json ? JSON.parse(row.images_json) : [],
    video: row.video_json ? JSON.parse(row.video_json) : undefined,
    error: row.error || undefined,
    createdAt: row.created_at,
    completedAt: row.completed_at || undefined,
  };
}

/**
 * 创建新任务
 */
export function createTask(taskId: string, originalImageUrl: string): AssetPackage {
  const task: AssetPackage = {
    taskId,
    status: 'pending',
    images: [],
    originalImageUrl,
    createdAt: Date.now(),
  };

  const db = getDb();
  db.prepare(`
    INSERT INTO tasks (id, status, original_image_url, images_json, created_at)
    VALUES (@id, @status, @original_image_url, '[]', @created_at)
  `).run({
    id: taskId,
    status: 'pending',
    original_image_url: originalImageUrl,
    created_at: task.createdAt,
  });

  return task;
}

/**
 * 更新任务状态
 */
export function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  message?: string
): void {
  const db = getDb();
  const timestamp = Date.now();

  // 更新任务状态
  db.prepare(`UPDATE tasks SET status = @status WHERE id = @id`).run({
    id: taskId,
    status,
  });

  // 如果完成或失败，记录 completed_at
  if (status === 'completed' || status === 'failed') {
    db.prepare(`UPDATE tasks SET completed_at = @ts WHERE id = @id`).run({
      id: taskId,
      ts: timestamp,
    });
  }

  // 插入事件
  const event: TaskEvent = {
    taskId,
    status,
    message: message || '',
    timestamp,
  };

  db.prepare(`
    INSERT INTO task_events (task_id, status, message, timestamp)
    VALUES (@task_id, @status, @message, @timestamp)
  `).run({
    task_id: taskId,
    status,
    message: message || '',
    timestamp,
  });

  // 通知 SSE 监听器
  const listener = eventListeners.get(taskId);
  if (listener) listener(event);
}

/**
 * 获取任务完整信息
 */
export function getTask(taskId: string): AssetPackage | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM tasks WHERE id = @id').get({ id: taskId }) as any;
  if (!row) return undefined;
  return rowToTask(row);
}

/**
 * 更新任务的素材数据
 */
export function updateTaskData(
  taskId: string,
  data: Partial<AssetPackage>
): void {
  const db = getDb();
  const sets: string[] = [];
  const params: Record<string, any> = { id: taskId };

  if (data.productInfo !== undefined) {
    sets.push('product_info_json = @product_info_json');
    params.product_info_json = data.productInfo ? JSON.stringify(data.productInfo) : null;
  }
  if (data.copywriting !== undefined) {
    sets.push('copywriting_json = @copywriting_json');
    params.copywriting_json = data.copywriting ? JSON.stringify(data.copywriting) : null;
  }
  if (data.images !== undefined) {
    sets.push('images_json = @images_json');
    params.images_json = data.images.length > 0 ? JSON.stringify(data.images) : null;
  }
  if (data.video !== undefined) {
    sets.push('video_json = @video_json');
    params.video_json = data.video ? JSON.stringify(data.video) : null;
  }
  if (data.error !== undefined) {
    sets.push('error = @error');
    params.error = data.error || null;
  }
  if (data.status !== undefined) {
    sets.push('status = @status');
    params.status = data.status;
  }
  if (data.completedAt !== undefined) {
    sets.push('completed_at = @completed_at');
    params.completed_at = data.completedAt || null;
  }

  if (sets.length === 0) return;

  db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = @id`).run(params);
}

/**
 * 获取任务事件历史
 */
export function getTaskEvents(taskId: string): TaskEvent[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT task_id as taskId, status, message, timestamp
    FROM task_events
    WHERE task_id = @task_id
    ORDER BY timestamp ASC
  `).all({ task_id: taskId }) as TaskEvent[];
  return rows;
}

/**
 * 注册事件监听器（用于 SSE 实时推送）
 */
export function onTaskEvent(
  taskId: string,
  callback: (event: TaskEvent) => void
): void {
  eventListeners.set(taskId, callback);
}

/**
 * 移除事件监听器
 */
export function removeTaskListener(taskId: string): void {
  eventListeners.delete(taskId);
}

/**
 * 清理已完成超过 1 小时的任务（定期调用）
 */
export function cleanupOldTasks(): void {
  const db = getDb();
  const oneHourAgo = Date.now() - 3600 * 1000;

  // 删除已完成超过 1 小时的任务及其事件
  db.prepare(`
    DELETE FROM tasks
    WHERE completed_at IS NOT NULL AND completed_at < @ts
  `).run({ ts: oneHourAgo });

  // 清理内存中的监听器
  for (const [id] of eventListeners) {
    const row = db.prepare('SELECT completed_at FROM tasks WHERE id = @id').get({ id }) as any;
    if (!row || (row.completed_at && row.completed_at < oneHourAgo)) {
      eventListeners.delete(id);
    }
  }
}
