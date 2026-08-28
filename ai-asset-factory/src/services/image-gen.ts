import { config, uploadPath } from '../config.js';
import type { GeneratedImage, PromptGroup } from '../types.js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * 将图片路径转为 base64 data URL
 */
function imageToBase64(imagePath: string): string {
  if (imagePath.startsWith('/uploads/') || imagePath.startsWith('./uploads/')) {
    const filename = imagePath.replace(/^\.?\/uploads\//, '');
    const filepath = resolve(uploadPath, filename);
    const buffer = readFileSync(filepath);
    const ext = filename.split('.').pop()?.toLowerCase() || 'png';
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
    return `data:${mime};base64,${buffer.toString('base64')}`;
  }
  return imagePath;
}

/**
 * 使用万相2.7图像编辑(img2img)生成场景图
 * 同步调用，直接返回结果
 */
async function editImageWithWanx(
  baseImage: string,
  prompt: string,
  size: string = '1024*1024'
): Promise<string> {
  const base64Image = imageToBase64(baseImage);

  const response = await fetch(
    `${config.dashscope.baseUrl}${config.dashscope.editEndpoint}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.dashscope.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.dashscope.editModel,
        input: {
          messages: [
            {
              role: 'user',
              content: [
                { image: base64Image },
                { text: prompt },
              ],
            },
          ],
        },
        parameters: {
          size,
          n: 1,
          watermark: false,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`图像编辑失败: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const imageUrl = data.output?.choices?.[0]?.message?.content?.[0]?.image;

  if (!imageUrl) {
    throw new Error(`图像编辑未返回图片: ${JSON.stringify(data)}`);
  }

  return imageUrl;
}

/**
 * 下载图片到本地
 */
async function downloadImage(url: string, sceneName: string): Promise<string> {
  const { mkdirSync, writeFileSync } = await import('fs');
  const { join } = await import('path');

  mkdirSync(uploadPath, { recursive: true });

  const response = await fetch(url);
  const buffer = Buffer.from(await response.arrayBuffer());

  const filename = `${sceneName}-${Date.now()}.png`;
  const filepath = join(uploadPath, filename);
  writeFileSync(filepath, buffer);

  return filepath;
}

/**
 * 完整的图像生成流程：对每个场景调用 img2img
 * @param prompts Prompt组
 * @param baseImage 原图路径/URL（作为编辑基础）
 */
export async function generateImages(
  prompts: PromptGroup[],
  baseImage: string,
  size: string = '1024*1024',
  onProgress?: (msg: string) => void
): Promise<GeneratedImage[]> {
  const allImages: GeneratedImage[] = [];

  for (const group of prompts) {
    onProgress?.(`正在生成场景图: ${group.sceneName}`);

    const imageUrl = await editImageWithWanx(baseImage, group.prompt, size);
    const localPath = await downloadImage(imageUrl, group.sceneName);

    allImages.push({
      url: imageUrl,
      localPath,
      promptUsed: group.prompt,
      sceneName: group.sceneName,
    });
  }

  return allImages;
}
