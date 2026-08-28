import { config } from '../config.js';
import type { GeneratedImage, GeneratedVideo } from '../types.js';

// ============================================================
// 图生视频：使用阿里云百炼/千问AI平台的 wan2.6-i2v-flash
// 同一个百炼 Key 即可调用
// ============================================================

/**
 * 调用 wan2.6-i2v-flash 图生视频
 * 文档：https://platform.qianwenai.com/docs/developer-guides/video-generation/image-to-video
 */
export async function generateVideoWithWanx(
  image: GeneratedImage,
  onProgress?: (msg: string) => void
): Promise<GeneratedVideo> {
  onProgress?.('正在提交图生视频任务...');

  const response = await fetch(
    `${config.dashscope.baseUrl}/services/aigc/video-generation/video-synthesis`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.dashscope.apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify({
        model: 'wan2.6-i2v-flash',
        input: {
          prompt: '产品展示，缓慢旋转，光线变化，商业广告风格',
          img_url: image.url,
        },
        parameters: {
          resolution: '720P',
          duration: 5,
          prompt_extend: true,
          watermark: false,
          audio: false, // MVP 阶段不需要音频
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`视频提交失败: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const taskId = data.output?.task_id;

  if (!taskId) {
    throw new Error(`未返回 task_id: ${JSON.stringify(data)}`);
  }

  onProgress?.('视频生成中...');

  // 轮询
  const videoUrl = await pollVideoTask(taskId, onProgress);

  // 下载到本地
  const { uploadPath } = await import('../config.js');
  const { mkdirSync, writeFileSync } = await import('fs');
  const { join } = await import('path');
  mkdirSync(uploadPath, { recursive: true });

  const videoResponse = await fetch(videoUrl);
  const buffer = Buffer.from(await videoResponse.arrayBuffer());
  const filename = `video-${Date.now()}.mp4`;
  const localPath = join(uploadPath, filename);
  writeFileSync(localPath, buffer);

  return {
    url: videoUrl,
    localPath,
    sourceImageIndex: 0,
    duration: 5,
  };
}

/**
 * 轮询视频任务结果
 */
async function pollVideoTask(
  taskId: string,
  onProgress?: (msg: string) => void
): Promise<string> {
  const maxAttempts = 60;

  for (let i = 0; i < maxAttempts; i++) {
    await sleep(5000);

    const response = await fetch(
      `${config.dashscope.baseUrl}/tasks/${taskId}`,
      {
        headers: {
          'Authorization': `Bearer ${config.dashscope.apiKey}`,
        },
      }
    );

    if (!response.ok) continue;

    const data = await response.json();
    const status = data.output?.task_status;

    if (status === 'SUCCEEDED') {
      const url = data.output?.video_url || data.output?.videos?.[0]?.url;
      if (url) return url;
    }

    if (status === 'FAILED') {
      throw new Error(`视频生成失败: ${data.output?.message}`);
    }

    if (i % 6 === 0 && onProgress) {
      onProgress(`视频生成中... 已等待 ${i * 5} 秒`);
    }
  }

  throw new Error(`视频生成超时`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
