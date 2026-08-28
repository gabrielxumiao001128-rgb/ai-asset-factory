import { config } from '../config';
import type { ProductInfo } from '../types';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { uploadPath } from '../config';

/**
 * 调用 Qwen-VL 分析商品图片
 * 输入：图片 URL 或本地路径
 * 输出：结构化商品信息
 */
export async function analyzeProduct(imageUrl: string): Promise<ProductInfo> {
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

  const prompt = `请分析这张商品图片，以 JSON 格式返回以下信息：
{
  "category": "商品品类名称",
  "material": "主要材质",
  "color": "主色调",
  "shape": "外形描述（简短）",
  "sellingPoints": ["卖点1", "卖点2", "卖点3"],
  "keywords": ["关键词1", "关键词2", "关键词3"]
}

要求：
1. 只返回 JSON，不要其他文字
2. 卖点从视觉特征推断（如便携、环保、高颜值等）
3. 关键词用于后续生成场景图的 Prompt 组装`;

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
    throw new Error(`Qwen-VL 调用失败: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();

  // Qwen-VL 返回格式: data.output.choices[0].message.content = [{text: "..."}, ...]
  const content = data.output?.choices?.[0]?.message?.content;
  let text = '';
  if (Array.isArray(content)) {
    text = content.map((c: any) => c.text || '').join('');
  } else if (typeof content === 'string') {
    text = content;
  } else {
    text = data.output?.text || '';
  }

  // Qwen-VL 返回的文本里可能包含 markdown 代码块，提取 JSON
  const jsonStr = extractJson(text);
  const productInfo = JSON.parse(jsonStr) as ProductInfo;

  return productInfo;
}

/**
 * 从文本中提取 JSON 字符串
 * 处理 ```json ... ``` 包裹的情况
 */
function extractJson(text: string): string {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) return jsonMatch[1].trim();

  // 尝试直接找 { ... }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);

  return text.trim();
}
