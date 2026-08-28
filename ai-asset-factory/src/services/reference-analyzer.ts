import { config, uploadPath } from '../config';
import type { ReferenceAnalysis, ArtStyle, SizeOption } from '../types';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * 调用 Qwen-VL 分析参考图片的视觉风格
 * 输入：参考图 URL 或本地路径
 * 输出：结构化的风格分析结果，用于指导后续生成
 */
export async function analyzeReferenceImage(imageUrl: string): Promise<ReferenceAnalysis> {
  // 如果是本地路径，转为 base64
  let imageInput = imageUrl;
  if (imageUrl.startsWith('/uploads/') || imageUrl.startsWith('./uploads/')) {
    const filename = imageUrl.replace(/^\.?\/uploads\//, '');
    const filepath = resolve(uploadPath, filename);
    const buffer = readFileSync(filepath);
    const ext = filename.split('.').pop()?.toLowerCase() || 'png';
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
    imageInput = `data:${mime};base64,${buffer.toString('base64')}`;
  }

  const prompt = `请分析这张电商营销参考图的视觉风格，以 JSON 格式返回以下信息：
{
  "scene": "场景类型，中文简短描述，如'家居生活'、'户外场景'、'简约白底'、'创意特写'，或自定义场景描述",
  "style": "艺术风格，必须从以下选项中选择一个: realistic, watercolor, oil_painting, sketch, cyberpunk, ink_wash, minimalist, festive",
  "size": "图片比例，必须从以下选项中选择一个: 1024*1024, 1024*1365, 1365*1024, 1024*1792, 1792*1024",
  "lighting": "光照氛围描述，中文简短，如'柔和自然光'、'戏剧性侧光'、'明亮均匀光'",
  "composition": "构图描述，中文简短，如'居中对称'、'三分法构图'、'俯拍平铺'",
  "description": "整体视觉风格英文描述，50词以内，用于AI图像生成的prompt，包含背景、光线、色调、氛围等",
  "recommendedScenes": ["推荐的其他2-3个适合该商品的场景，中文场景名"]
}

要求：
1. 只返回 JSON，不要其他文字
2. style 字段必须严格使用给定的英文选项
3. size 字段必须严格使用给定的格式
4. description 字段用英文描述，将用于后续图像生成`;

  const response = await fetch(
    `${config.dashscope.baseUrl}/services/aigc/multimodal-generation/generation`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.dashscope.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.dashscope.visionModel,
        input: {
          messages: [
            {
              role: 'user',
              content: [
                { image: imageInput },
                { text: prompt },
              ],
            },
          ],
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`参考图分析失败: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();

  const content = data.output?.choices?.[0]?.message?.content;
  let text = '';
  if (Array.isArray(content)) {
    text = content.map((c: any) => c.text || '').join('');
  } else if (typeof content === 'string') {
    text = content;
  } else {
    text = data.output?.text || '';
  }

  const jsonStr = extractJson(text);
  const parsed = JSON.parse(jsonStr);

  // 校验并修正字段
  const validStyles: ArtStyle[] = ['realistic', 'watercolor', 'oil_painting', 'sketch', 'cyberpunk', 'ink_wash', 'minimalist', 'festive'];
  const validSizes: SizeOption[] = ['1024*1024', '1024*1365', '1365*1024', '1024*1792', '1792*1024'];

  const style = validStyles.includes(parsed.style) ? parsed.style : 'realistic';
  const size = validSizes.includes(parsed.size) ? parsed.size : '1024*1024';

  return {
    scene: parsed.scene || '家居生活',
    style,
    size,
    lighting: parsed.lighting || '柔和自然光',
    composition: parsed.composition || '居中构图',
    description: parsed.description || 'warm lifestyle photography, soft natural lighting, clean background, commercial quality',
    recommendedScenes: Array.isArray(parsed.recommendedScenes) ? parsed.recommendedScenes.slice(0, 3) : [],
  };
}

function extractJson(text: string): string {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) return jsonMatch[1].trim();

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);

  return text.trim();
}
