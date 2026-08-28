import { JsonStore } from '../db/json-store.js';
import { config } from '../config.js';
import { join } from 'path';
import type { AssetPackage } from '../types.js';

const MAX_HISTORY = 50;

interface HistoryEntry {
  taskId: string;
  originalImageUrl: string;
  productInfo?: any;
  scenes?: any[];
  mode?: string;
  size?: string;
  imageCount: number;
  hasVideo: boolean;
  thumbnailUrl?: string;
  createdAt: number;
  completedAt?: number;
  status: string;
}

interface HistoryStore {
  entries: HistoryEntry[];
}

const historyStore = new JsonStore<HistoryStore>(
  join(config.dbPath.replace('app.db', ''), 'history.json'),
  { entries: [] }
);

/**
 * 保存任务历史记录
 */
export function saveHistory(task: AssetPackage, scenes?: any[], mode?: string, size?: string) {
  const images = task.images || [];
  const productInfo = task.productInfo;

  const entry: HistoryEntry = {
    taskId: task.taskId,
    originalImageUrl: task.originalImageUrl,
    productInfo: productInfo ? {
      category: productInfo.category,
      color: productInfo.color,
      material: productInfo.material,
    } : undefined,
    scenes,
    mode,
    size,
    imageCount: images.length,
    hasVideo: !!task.video,
    thumbnailUrl: images[0]?.url,
    createdAt: task.createdAt,
    completedAt: task.completedAt,
    status: task.status,
  };

  historyStore.update((data) => {
    data.entries.unshift(entry);
    // 保留最近 50 条
    if (data.entries.length > MAX_HISTORY) {
      data.entries = data.entries.slice(0, MAX_HISTORY);
    }
    return data;
  });
}

/**
 * 获取历史记录列表
 */
export function getHistory(limit = 20): HistoryEntry[] {
  const data = historyStore.get();
  return data.entries.slice(0, limit);
}

/**
 * 获取单条历史记录
 */
export function getHistoryEntry(taskId: string): HistoryEntry | undefined {
  const data = historyStore.get();
  return data.entries.find((e) => e.taskId === taskId);
}
