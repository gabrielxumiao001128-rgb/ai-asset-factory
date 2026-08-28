import { config } from '../config.js';
import type { ProductInfo, CopywritingSet, CopyStyle } from '../types.js';

/**
 * 基于商品信息生成 AI 营销文案
 * 调用 Qwen 文本模型，输出结构化文案
 * @param copyStyle 文案风格（卖点型/情感型/功能型/促销型）
 */
export async function generateCopywriting(
  product: ProductInfo,
  sceneNames: string[],
  copyStyle?: CopyStyle
): Promise<CopywritingSet> {
  const sceneList = sceneNames.length > 0 ? sceneNames : ['家居生活', '户外场景', '简约白底', '创意特写'];

  const prompt = buildCopywritingPrompt(product, sceneList, copyStyle);

  const styleGuide = copyStyle ? COPY_STYLE_GUIDES[copyStyle] : null;
  const systemMessage = styleGuide
    ? `${styleGuide.system} 请严格按用户要求的 JSON 格式输出，不要包含任何额外文字。`
    : '你是一位资深电商文案策划，擅长撰写高转化率的商品营销文案。请严格按用户要求的 JSON 格式输出，不要包含任何额外文字。';

  const response = await fetch(
    `${config.dashscope.baseUrl}/services/aigc/text-generation/generation`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.dashscope.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen-turbo',
        input: {
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: prompt },
          ],
        },
        parameters: {
          result_format: 'message',
          temperature: 0.8,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`文案生成失败: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const content = data.output?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('文案生成未返回内容');
  }

  return parseCopywriting(content, sceneList);
}

const COPY_STYLE_GUIDES: Record<CopyStyle, { label: string; system: string; tone: string }> = {
  selling: {
    label: '卖点型',
    system: '你是一位资深电商文案策划，擅长用精准的卖点提炼打动消费者，文案突出产品核心优势。',
    tone: '突出核心卖点，用数据和对比强化说服力，标题强调产品功能优势，bullets 聚焦3-5个差异化卖点',
  },
  emotional: {
    label: '情感型',
    system: '你是一位资深情感营销文案师，擅长用故事和场景共鸣打动消费者，文案富有温度和情感。',
    tone: '用故事和场景共鸣打动人心，标题走心有温度，bullets 用情感化场景描述代替生硬卖点，小红书文案偏治愈系',
  },
  functional: {
    label: '功能型',
    system: '你是一位严谨的产品文案专家，擅长用清晰的功能说明和使用场景帮助消费者决策。',
    tone: '清晰罗列功能参数和使用场景，标题突出实用价值，bullets 聚焦功能特性与使用效果，文案风格专业可信',
  },
  promotional: {
    label: '促销型',
    system: '你是一位促销文案专家，擅长用紧迫感和利益驱动促成下单，文案充满行动号召力。',
    tone: '强调限时优惠和稀缺性，标题带利益钩子和紧迫感，bullets 突出优惠力度和赠品，抖音文案强促下单',
  },
};

function buildCopywritingPrompt(product: ProductInfo, sceneNames: string[], copyStyle?: CopyStyle): string {
  const styleGuide = copyStyle ? COPY_STYLE_GUIDES[copyStyle] : null;
  const styleHint = styleGuide ? `\n\n文案风格要求：${styleGuide.tone}` : '';

  const sceneCopyTemplate: Record<string, string> = {};
  for (const name of sceneNames) {
    sceneCopyTemplate[name] = `30字以内的"${name}"场景描述文案`;
  }

  return `请根据以下商品信息，生成完整的营销文案素材包：

商品类别：${product.category}
材质：${product.material}
颜色：${product.color}
外形：${product.shape || '未描述'}
核心卖点：${product.sellingPoints.join('、')}${styleHint}

请严格按照以下 JSON 格式输出（不要包含 markdown 代码块标记，只输出纯 JSON）：

{
  "shortTitle": "15字以内的吸睛短标题",
  "longTitle": "30字以内的搜索优化长标题",
  "bullets": ["卖点1（不超过20字）", "卖点2", "卖点3", "卖点4", "卖点5"],
  "sceneCopy": ${JSON.stringify(sceneCopyTemplate)},
  "xiaohongshu": "200字以内的小红书风格带货文案，带emoji，语气亲切",
  "douyin": "100字以内的抖音口播文案，口语化、有钩子、促下单"
}`;
}

function parseCopywriting(content: string, sceneNames: string[]): CopywritingSet {
  // 尝试提取 JSON（模型可能包裹在 markdown 代码块中）
  let jsonStr = content.trim();

  // 去掉 markdown 代码块标记
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // 尝试从文本中提取 JSON
    const match = jsonStr.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        parsed = {};
      }
    } else {
      parsed = {};
    }
  }

  // 确保 sceneCopy 包含所有需要的场景
  const sceneCopy: Record<string, string> = {};
  for (const name of sceneNames) {
    sceneCopy[name] = parsed.sceneCopy?.[name] || `${name}，${parsed.shortTitle || '高品质商品'}，值得拥有`;
  }

  return {
    shortTitle: parsed.shortTitle || `${productNameFromContext(parsed)}`,
    longTitle: parsed.longTitle || parsed.shortTitle || '高品质商品推荐',
    bullets: Array.isArray(parsed.bullets) ? parsed.bullets.slice(0, 5) : ['品质保证', '设计精美', '实用耐用'],
    sceneCopy,
    xiaohongshu: parsed.xiaohongshu || '这款商品真的太棒了！推荐给大家～',
    douyin: parsed.douyin || '家人们谁懂啊，这个商品真的好用！',
  };
}

function productNameFromContext(parsed: any): string {
  if (parsed.shortTitle) return parsed.shortTitle;
  if (parsed.longTitle) return parsed.longTitle.slice(0, 15);
  return '高品质好物';
}
