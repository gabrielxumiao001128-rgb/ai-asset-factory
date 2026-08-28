import { getDb } from '../db/index.js';
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

/**
 * 保存任务历史记录
 */
export function saveHistory(task: AssetPackage, scenes?: any[], mode?: string, size?: string) {
  const db = getDb();

  // 将历史记录字段存储到 tasks 表的扩展字段中
  db.prepare(`
    UPDATE tasks SET
      mode = @mode,
      size = @size,
      scenes_json = @scenes_json
    WHERE id = @id
  `).run({
    id: task.taskId,
    mode: mode || null,
    size: size || null,
    scenes_json: scenes && scenes.length > 0 ? JSON.stringify(scenes) : null,
  });
}

/**
 * 获取历史记录列表
 */
export function getHistory(limit = 20): HistoryEntry[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      id as taskId,
      original_image_url as originalImageUrl,
      product_info_json,
      mode,
      size,
      images_json,
      video_json,
      created_at as createdAt,
      completed_at as completedAt,
      status,
      scenes_json
    FROM tasks
    ORDER BY created_at DESC
    LIMIT @limit
  `).all({ limit }) as any[];

  return rows.map(row => {
    const images = row.images_json ? JSON.parse(row.images_json) : [];
    const productInfo = row.product_info_json ? JSON.parse(row.product_info_json) : undefined;

    return {
      taskId: row.taskId,
      originalImageUrl: row.originalImageUrl,
      productInfo: productInfo ? {
        category: productInfo.category,
        color: productInfo.color,
        material: productInfo.material,
      } : undefined,
      scenes: row.scenes_json ? JSON.parse(row.scenes_json) : undefined,
      mode: row.mode,
      size: row.size,
      imageCount: images.length,
      hasVideo: !!row.video_json,
      thumbnailUrl: images[0]?.url,
      createdAt: row.createdAt,
      completedAt: row.completedAt || undefined,
      status: row.status,
    };
  });
}

/**
 * 获取单条历史记录
 */
export function getHistoryEntry(taskId: string): HistoryEntry | undefined {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      id as taskId,
      original_image_url as originalImageUrl,
      product_info_json,
      mode,
      size,
      images_json,
      video_json,
      created_at as createdAt,
      completed_at as completedAt,
      status,
      scenes_json
    FROM tasks
    WHERE id = @id
  `).get({ id: taskId }) as any;

  if (!row) return undefined;

  const images = row.images_json ? JSON.parse(row.images_json) : [];
  const productInfo = row.product_info_json ? JSON.parse(row.product_info_json) : undefined;

  return {
    taskId: row.taskId,
    originalImageUrl: row.originalImageUrl,
    productInfo: productInfo ? {
      category: productInfo.category,
      color: productInfo.color,
      material: productInfo.material,
    } : undefined,
    scenes: row.scenes_json ? JSON.parse(row.scenes_json) : undefined,
    mode: row.mode,
    size: row.size,
    imageCount: images.length,
    hasVideo: !!row.video_json,
    thumbnailUrl: images[0]?.url,
    createdAt: row.createdAt,
    completedAt: row.completedAt || undefined,
    status: row.status,
  };
}
