import sharp from 'sharp';
import { join } from 'path';
import { writeFileSync } from 'fs';
import { uploadPath } from '../config.js';

/**
 * 把抠好的商品叠加到场景图上
 * @param sceneImagePath 场景图路径（AI 生成的背景）
 * @param productImagePath 商品图路径（透明背景 PNG）
 * @param sceneName 场景名称（用于命名输出文件）
 * @returns 合成后的图片路径
 */
export async function compositeProduct(
  sceneImagePath: string,
  productImagePath: string,
  sceneName: string
): Promise<string> {
  console.log(`[合成] ${sceneName}: 场景=${sceneImagePath}, 商品=${productImagePath}`);

  // 读取场景图信息
  const scene = sharp(sceneImagePath);
  const sceneMeta = await scene.metadata();
  const sceneWidth = sceneMeta.width || 1024;
  const sceneHeight = sceneMeta.height || 1024;

  // 读取商品图信息
  const product = sharp(productImagePath);
  const productMeta = await product.metadata();
  const productWidth = productMeta.width || 1;
  const productHeight = productMeta.height || 1;

  // 计算商品在场景中的目标大小（占场景宽度的 35-50%，根据场景调整）
  let targetScale: number;
  if (sceneName === '创意特写') {
    targetScale = 0.65; // 特写占画面更大
  } else if (sceneName === '简约白底') {
    targetScale = 0.45; // 白底居中，适中
  } else {
    targetScale = 0.40; // 其他场景，偏小一点
  }

  const targetWidth = Math.round(sceneWidth * targetScale);
  const scale = targetWidth / productWidth;
  const targetHeight = Math.round(productHeight * scale);

  // 缩放商品（保持比例）
  const resizedProduct = await product
    .resize(targetWidth, targetHeight, { fit: 'inside' })
    .png()
    .toBuffer();

  // 计算放置位置（水平居中，垂直偏下）
  const left = Math.round((sceneWidth - targetWidth) / 2);
  const top = Math.round(sceneHeight * 0.52 - targetHeight / 2);

  console.log(`[合成] 商品大小: ${targetWidth}x${targetHeight}, 位置: (${left}, ${top})`);

  // 合成图像
  const outputBuffer = await scene
    .composite([{ input: resizedProduct, left, top }])
    .png()
    .toBuffer();

  // 保存
  const filename = `${sceneName}-final-${Date.now()}.png`;
  const outputPath = join(uploadPath, filename);
  writeFileSync(outputPath, outputBuffer);

  console.log(`[合成] 完成: ${outputPath}`);
  return outputPath;
}
