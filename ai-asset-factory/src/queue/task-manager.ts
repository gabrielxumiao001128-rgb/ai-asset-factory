import type { AssetPackage, TaskStatus, TaskEvent } from '../types.js';
import { getDb } from '../db/index.js';

// SSE 实时推送监听器（必须在内存中，无法持久化）
const eventListeners = new Map<string, (event: TaskEvent) => void>();

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
export async function createTask(taskId: string, originalImageUrl: string): Promise<AssetPackage> {
  const task: AssetPackage = {
    taskId,
    status: 'pending',
    images: [],
    originalImageUrl,
    createdAt: Date.now(),
  };

  const db = await getDb();
  await db.run(
    `INSERT INTO tasks (id, status, original_image_url, images_json, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [taskId, 'pending', originalImageUrl, '[]', task.createdAt]
  );

  return task;
}

/**
 * 更新任务状态
 */
export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  message?: string
): Promise<void> {
  const db = await getDb();
  const timestamp = Date.now();

  // 更新任务状态
  await db.run(`UPDATE tasks SET status = ? WHERE id = ?`, [status, taskId]);

  // 如果完成或失败，记录 completed_at
  if (status === 'completed' || status === 'failed') {
    await db.run(`UPDATE tasks SET completed_at = ? WHERE id = ?`, [timestamp, taskId]);
  }

  // 插入事件
  const event: TaskEvent = {
    taskId,
    status,
    message: message || '',
    timestamp,
  };

  await db.run(
    `INSERT INTO task_events (task_id, status, message, timestamp)
     VALUES (?, ?, ?, ?)`,
    [taskId, status, message || '', timestamp]
  );

  // 通知 SSE 监听器
  const listener = eventListeners.get(taskId);
  if (listener) listener(event);
}

/**
 * 获取任务完整信息
 */
export async function getTask(taskId: string): Promise<AssetPackage | undefined> {
  const db = await getDb();
  const row = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
  if (!row) return undefined;
  return rowToTask(row);
}

/**
 * 更新任务的素材数据
 */
export async function updateTaskData(
  taskId: string,
  data: Partial<AssetPackage>
): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const params: any[] = [];

  if (data.productInfo !== undefined) {
    sets.push('product_info_json = ?');
    params.push(data.productInfo ? JSON.stringify(data.productInfo) : null);
  }
  if (data.copywriting !== undefined) {
    sets.push('copywriting_json = ?');
    params.push(data.copywriting ? JSON.stringify(data.copywriting) : null);
  }
  if (data.images !== undefined) {
    sets.push('images_json = ?');
    params.push(data.images.length > 0 ? JSON.stringify(data.images) : null);
  }
  if (data.video !== undefined) {
    sets.push('video_json = ?');
    params.push(data.video ? JSON.stringify(data.video) : null);
  }
  if (data.error !== undefined) {
    sets.push('error = ?');
    params.push(data.error || null);
  }
  if (data.status !== undefined) {
    sets.push('status = ?');
    params.push(data.status);
  }
  if (data.completedAt !== undefined) {
    sets.push('completed_at = ?');
    params.push(data.completedAt || null);
  }

  if (sets.length === 0) return;

  params.push(taskId);
  await db.run(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, params);
}

/**
 * 获取任务事件历史
 */
export async function getTaskEvents(taskId: string): Promise<TaskEvent[]> {
  const db = await getDb();
  const rows = await db.all(
    `SELECT task_id as taskId, status, message, timestamp
     FROM task_events
     WHERE task_id = ?
     ORDER BY timestamp ASC`,
    [taskId]
  );
  return rows as TaskEvent[];
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
export async function cleanupOldTasks(): Promise<void> {
  const db = await getDb();
  const oneHourAgo = Date.now() - 3600 * 1000;

  // 删除已完成超过 1 小时的任务及其事件
  await db.run(
    `DELETE FROM tasks WHERE completed_at IS NOT NULL AND completed_at < ?`,
    [oneHourAgo]
  );

  // 清理内存中的监听器
  for (const [id] of eventListeners) {
    const row = await db.get('SELECT completed_at FROM tasks WHERE id = ?', [id]);
    if (!row || (row.completed_at && row.completed_at < oneHourAgo)) {
      eventListeners.delete(id);
    }
  }
}
