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
export async function saveHistory(task: AssetPackage, scenes?: any[], mode?: string, size?: string) {
  const db = await getDb();

  await db.run(
    `UPDATE tasks SET
      mode = ?,
      size = ?,
      scenes_json = ?
    WHERE id = ?`,
    [mode || null, size || null, scenes && scenes.length > 0 ? JSON.stringify(scenes) : null, task.taskId]
  );
}

/**
 * 获取历史记录列表
 */
export async function getHistory(limit = 20): Promise<HistoryEntry[]> {
  const db = await getDb();
  const rows = await db.all(
    `SELECT
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
    LIMIT ?`,
    [limit]
  );

  return rows.map((row: any) => {
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
export async function getHistoryEntry(taskId: string): Promise<HistoryEntry | undefined> {
  const db = await getDb();
  const row = await db.get(
    `SELECT
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
    WHERE id = ?`,
    [taskId]
  );

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
