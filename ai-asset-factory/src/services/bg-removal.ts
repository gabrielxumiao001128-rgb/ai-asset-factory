import sharp from 'sharp';
import { existsSync } from 'fs';
import { join } from 'path';
import { uploadPath } from '../config.js';

/**
 * 纯 Node.js 抠图（洪水填充法）
 * 从图片四角开始，把与背景色相近的连通区域设为透明
 * 适用于白底/纯色背景的商品图
 */
export async function removeProductBackground(imagePath: string): Promise<{ path: string; removedPercent: number }> {
  console.log(`[抠图] 开始处理: ${imagePath}`);

  // 读取图片为 raw 像素数据（确保有 alpha 通道）
  const { data, info } = await sharp(imagePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels; // 4 = RGBA
  const width = info.width;
  const height = info.height;

  // 获取四角像素作为背景色参考
  const getPixel = (x: number, y: number): [number, number, number] => {
    const idx = (y * width + x) * channels;
    return [data[idx], data[idx + 1], data[idx + 2]];
  };

  const corners = [
    getPixel(0, 0),
    getPixel(width - 1, 0),
    getPixel(0, height - 1),
    getPixel(width - 1, height - 1),
  ];

  // 计算平均背景色
  const bgR = Math.round(corners.reduce((s, c) => s + c[0], 0) / 4);
  const bgG = Math.round(corners.reduce((s, c) => s + c[1], 0) / 4);
  const bgB = Math.round(corners.reduce((s, c) => s + c[2], 0) / 4);

  console.log(`[抠图] 背景色: RGB(${bgR}, ${bgG}, ${bgB}), 图片: ${width}x${height}`);

  // 洪水填充：从四角开始，把与背景色相近的连通区域设为透明
  const threshold = 35; // 颜色容差
  const visited = new Uint8Array(width * height);
  const stack: number[] = [
    0,                              // 左上
    width - 1,                       // 右上
    (height - 1) * width,            // 左下
    (height - 1) * width + width - 1 // 右下
  ];

  let removedPixels = 0;

  while (stack.length > 0) {
    const idx = stack.pop()!;
    if (visited[idx]) continue;
    visited[idx] = 1;

    const px = idx * channels;
    const r = data[px];
    const g = data[px + 1];
    const b = data[px + 2];

    // 检查是否与背景色相近
    const diff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
    if (diff <= threshold * 3) {
      data[px + 3] = 0; // 设为透明
      removedPixels++;

      const x = idx % width;
      const y = Math.floor(idx / width);
      if (x > 0 && !visited[idx - 1]) stack.push(idx - 1);
      if (x < width - 1 && !visited[idx + 1]) stack.push(idx + 1);
      if (y > 0 && !visited[idx - width]) stack.push(idx - width);
      if (y < height - 1 && !visited[idx + width]) stack.push(idx + width);
    }
  }

  const totalPixels = width * height;
  const removedPercent = ((removedPixels / totalPixels) * 100).toFixed(1);
  console.log(`[抠图] 移除了 ${removedPixels} 像素 (${removedPercent}%)`);

  // 保存为透明 PNG
  const outputFilename = `product-cutout-${Date.now()}.png`;
  const outputPath = join(uploadPath, outputFilename);

  await sharp(data, { raw: { width, height, channels } })
    .png()
    .toFile(outputPath);

  console.log(`[抠图] 完成: ${outputPath}`);
  return { path: outputPath, removedPercent: parseFloat(removedPercent) };
}
