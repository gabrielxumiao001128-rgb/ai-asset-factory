import type { AssetPackage, TaskStatus, TaskEvent } from '../types.js';
import { JsonStore } from '../db/json-store.js';
import { config } from '../config.js';
import { join } from 'path';

// SSE 实时推送监听器（必须在内存中，无法持久化）
const eventListeners = new Map<string, (event: TaskEvent) => void>();

interface TaskStore {
  tasks: Record<string, AssetPackage>;
}

interface EventStore {
  events: Record<string, TaskEvent[]>;
}

const taskStore = new JsonStore<TaskStore>(
  join(config.dbPath.replace('app.db', ''), 'tasks.json'),
  { tasks: {} }
);

const eventStore = new JsonStore<EventStore>(
  join(config.dbPath.replace('app.db', ''), 'events.json'),
  { events: {} }
);

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

  taskStore.update((data) => {
    data.tasks[taskId] = task;
    return data;
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
  const timestamp = Date.now();

  // 更新任务状态
  taskStore.update((data) => {
    const task = data.tasks[taskId];
    if (task) {
      task.status = status;
      if (status === 'completed' || status === 'failed') {
        task.completedAt = timestamp;
      }
    }
    return data;
  });

  // 插入事件
  const event: TaskEvent = {
    taskId,
    status,
    message: message || '',
    timestamp,
  };

  eventStore.update((data) => {
    if (!data.events[taskId]) {
      data.events[taskId] = [];
    }
    data.events[taskId].push(event);
    return data;
  });

  // 通知 SSE 监听器
  const listener = eventListeners.get(taskId);
  if (listener) listener(event);
}

/**
 * 获取任务完整信息
 */
export function getTask(taskId: string): AssetPackage | undefined {
  const data = taskStore.get();
  return data.tasks[taskId];
}

/**
 * 更新任务的素材数据
 */
export function updateTaskData(
  taskId: string,
  data: Partial<AssetPackage>
): void {
  taskStore.update((store) => {
    const task = store.tasks[taskId];
    if (!task) return store;

    if (data.productInfo !== undefined) task.productInfo = data.productInfo;
    if (data.copywriting !== undefined) task.copywriting = data.copywriting;
    if (data.images !== undefined) task.images = data.images;
    if (data.video !== undefined) task.video = data.video;
    if (data.error !== undefined) task.error = data.error;
    if (data.status !== undefined) task.status = data.status;
    if (data.completedAt !== undefined) task.completedAt = data.completedAt;

    return store;
  });
}

/**
 * 获取任务事件历史
 */
export function getTaskEvents(taskId: string): TaskEvent[] {
  const data = eventStore.get();
  return data.events[taskId] || [];
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
  const oneHourAgo = Date.now() - 3600 * 1000;

  taskStore.update((data) => {
    for (const [id, task] of Object.entries(data.tasks)) {
      if (task.completedAt && task.completedAt < oneHourAgo) {
        delete data.tasks[id];
      }
    }
    return data;
  });

  eventStore.update((data) => {
    for (const id of Object.keys(data.events)) {
      const task = taskStore.get().tasks[id];
      if (!task || (task.completedAt && task.completedAt < oneHourAgo)) {
        delete data.events[id];
      }
    }
    return data;
  });

  // 清理内存中的监听器
  for (const [id] of eventListeners) {
    const task = taskStore.get().tasks[id];
    if (!task || (task.completedAt && task.completedAt < oneHourAgo)) {
      eventListeners.delete(id);
    }
  }
}
