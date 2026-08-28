import { config, uploadPath } from '../config.js';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, extname } from 'path';

/**
 * 保存用户上传的商品原图
 */
export function saveUploadedImage(buffer: Buffer, originalName: string): string {
  if (!existsSync(uploadPath)) {
    mkdirSync(uploadPath, { recursive: true });
  }

  const ext = extname(originalName) || '.png';
  const filename = `original-${Date.now()}${ext}`;
  const filepath = join(uploadPath, filename);
  writeFileSync(filepath, buffer);

  return filepath;
}

/**
 * 生成本地文件的服务器访问 URL
 * MVP 阶段通过 Hono 静态文件服务提供访问
 * Production: returns absolute URL if BASE_URL is set
 */
export function getLocalUrl(filepath: string): string {
  const filename = filepath.split('/').pop() || '';
  const path = `/uploads/${filename}`;
  if (config.baseUrl) {
    return `${config.baseUrl}${path}`;
  }
  return path;
}

/**
 * 确保上传目录存在
 */
export function ensureUploadDir(): void {
  if (!existsSync(uploadPath)) {
    mkdirSync(uploadPath, { recursive: true });
  }
}
