import { randomUUID } from 'crypto';
import { analyzeProduct } from '../services/vision';
import { generatePrompts } from '../services/prompt-engine';
import { generateImages } from '../services/image-gen';
import { generateVideoWithWanx } from '../services/video-gen';
import { generateCopywriting } from '../services/copywriting';
import { saveHistory } from '../services/history';
import {
  createTask,
  updateTaskStatus,
  updateTaskData,
  getTask,
} from '../queue/task-manager';
import type { GenerateMode, SceneSelection, SizeOption, ArtStyle, CopyStyle } from '../types';

/**
 * 完整的素材生成流水线
 * @param mode images=只生成图片, video=只生成视频, all=全生成
 * @param scenes 用户选择的场景列表（不传则默认全部预设）
 * @param size 输出图片尺寸
 * @param style 艺术风格（默认 realistic）
 * @param copyStyle 文案风格（可选）
 */
export async function runPipeline(
  taskId: string,
  imageUrl: string,
  mode: GenerateMode,
  scenes?: SceneSelection[],
  size: SizeOption = '1024*1024',
  style: ArtStyle = 'realistic',
  copyStyle?: CopyStyle,
  onProgress?: (msg: string) => void
): Promise<void> {
  const log = (status: any, msg: string) => {
    console.log(`[Task ${taskId}] ${status}: ${msg}`);
    updateTaskStatus(taskId, status, msg);
    onProgress?.(msg);
  };

  try {
    // ========== 步骤 1：商品视觉理解 ==========
    log('analyzing', '正在分析商品图片...');
    const productInfo = await analyzeProduct(imageUrl);
    updateTaskData(taskId, { productInfo });
    log('prompting', `商品识别完成: ${productInfo.category} / ${productInfo.color} / ${productInfo.material}`);

    // ========== 步骤 2：生成 Prompt ==========
    const promptGroups = generatePrompts(productInfo, scenes, style);
    const sceneNames = promptGroups.map(p => p.sceneName);
    log('prompting', `已生成 ${promptGroups.length} 组场景 Prompt: ${sceneNames.join(', ')}`);

    let images: any[] = [];
    let copywriting: any = null;

    // ========== 步骤 3：文案生成（与图片生成并行） ==========
    log('prompting', '正在生成营销文案...');
    const copywritingPromise = generateCopywriting(productInfo, sceneNames, copyStyle)
      .then(cw => {
        copywriting = cw;
        updateTaskData(taskId, { copywriting: cw });
        log('prompting', '营销文案生成完成');
        return cw;
      })
      .catch(err => {
        console.error(`[Task ${taskId}] 文案生成失败:`, err);
        log('prompting', '文案生成失败，跳过');
        return null;
      });

    // ========== 步骤 4：生成场景图 ==========
    if (mode === 'images' || mode === 'all') {
      log('generating_images', style === 'realistic'
        ? '开始生成场景图（万相2.7图像编辑）...'
        : `开始生成场景图（${getStyleLabel(style)}风格）...`
      );
      images = await generateImages(promptGroups, imageUrl, size, (msg) => {
        log('generating_images', msg);
      });
      updateTaskData(taskId, { images });
      log('generating_images', `场景图生成完成，共 ${images.length} 张`);
    }

    // 确保文案也完成了
    await copywritingPromise;

    // ========== 步骤 5：生成视频 ==========
    if (mode === 'video' || mode === 'all') {
      log('generating_video', '开始生成商品视频...');

      let videoInputImage;
      if (mode === 'video' && images.length === 0) {
        log('generating_images', '先生成1张场景图作为视频素材...');
        const singlePrompt = promptGroups.find(p => p.sceneName !== '简约白底') || promptGroups[0];
        const singleImages = await generateImages([singlePrompt], imageUrl, size);
        images = singleImages;
        updateTaskData(taskId, { images });
        videoInputImage = singleImages[0];
      } else {
        videoInputImage = images.find(img => img.sceneName !== '简约白底') || images[0];
      }

      let video;
      try {
        video = await generateVideoWithWanx(videoInputImage, (msg) => {
          log('generating_video', msg);
        });
      } catch (videoError) {
        console.error(`[Task ${taskId}] 视频生成失败:`, videoError);
        log('generating_video', '视频生成失败，跳过');
      }

      if (video) {
        updateTaskData(taskId, { video });
      }
    }

    // ========== 完成 ==========
    const parts: string[] = [];
    if (copywriting) parts.push('文案');
    if (images.length > 0) parts.push(`图片 ${images.length} 张`);
    if (mode === 'video' || mode === 'all') {
      parts.push('视频');
    }
    log('completed', `素材生成完成！${parts.join(' + ')}`);

    // 保存历史记录
    const finalTask = getTask(taskId);
    if (finalTask) {
      saveHistory(finalTask as any, scenes, mode, size);
    }

  } catch (error: any) {
    log('failed', `流程失败: ${error.message}`);
    throw error;
  }
}

/**
 * 创建并启动一个生成任务
 */
export function startTask(
  imageUrl: string,
  mode: GenerateMode = 'all',
  scenes?: SceneSelection[],
  size: SizeOption = '1024*1024',
  style: ArtStyle = 'realistic',
  copyStyle?: CopyStyle
): string {
  const taskId = randomUUID();
  createTask(taskId, imageUrl);

  // 异步启动，不阻塞 API 响应
  runPipeline(taskId, imageUrl, mode, scenes, size, style, copyStyle).catch((err) => {
    console.error(`[Task ${taskId}] Pipeline error:`, err);
  });

  return taskId;
}

function getStyleLabel(style: ArtStyle): string {
  const labels: Record<ArtStyle, string> = {
    realistic: '写实',
    watercolor: '水彩',
    oil_painting: '油画',
    sketch: '素描',
    cyberpunk: '赛博朋克',
    ink_wash: '水墨',
    minimalist: '极简',
    festive: '节日',
  };
  return labels[style] || style;
}
