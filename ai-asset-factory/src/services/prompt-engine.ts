import type { ProductInfo, PromptGroup, SceneSelection, ArtStyle } from '../types.js';

// 风格描述词映射
const STYLE_SUFFIXES: Record<ArtStyle, string> = {
  realistic: '', // 默认写实，不加风格词
  watercolor: 'in watercolor painting style, soft brushstrokes, artistic texture, delicate color palette, dreamy atmosphere',
  oil_painting: 'in oil painting style, rich colors, textured brushwork, classical art, canvas texture',
  sketch: 'in pencil sketch style, monochrome, hand-drawn lines, artistic illustration, paper texture',
  cyberpunk: 'in cyberpunk style, neon lights, futuristic city, high tech atmosphere, glowing accents, dark moody',
  ink_wash: 'in Chinese ink wash painting style, monochrome ink tones, flowing brushwork, traditional art, rice paper texture',
  minimalist: 'in minimalist art style, clean geometric shapes, flat design, bold colors, modern aesthetic',
  festive: 'in festive celebration style, warm holiday decorations, sparkling lights, joyful atmosphere, golden accents',
};

// 预设场景模板 — 用于万相2.7图像编辑(img2img)
const PRESET_TEMPLATES: Record<string, (productDesc: string, styleSuffix: string) => string> = {
  '家居生活': (productDesc: string, styleSuffix: string) => {
    let prompt = `Replace the background with a warm Scandinavian home interior, wooden dining table, ` +
      `soft morning sunlight streaming through a nearby window, gentle shadows, ` +
      `cozy atmosphere, minimalist decor, fresh white flowers in a vase, ` +
      `lifestyle photography, warm tones, inviting atmosphere, high quality. `;
    if (styleSuffix) prompt += `${styleSuffix}. `;
    prompt += `Keep the ${productDesc} completely unchanged, same position, same size, same lighting direction.`;
    return prompt;
  },

  '户外场景': (productDesc: string, styleSuffix: string) => {
    let prompt = `Replace the background with a lush green meadow, woven picnic blanket, ` +
      `bright golden hour sunlight, shallow depth of field, trees blurred in background, ` +
      `refreshing outdoor atmosphere, summer picnic vibe, wildflowers, warm tones, commercial photography. `;
    if (styleSuffix) prompt += `${styleSuffix}. `;
    prompt += `Keep the ${productDesc} completely unchanged, same position, same size, same lighting direction.`;
    return prompt;
  },

  '简约白底': (productDesc: string, styleSuffix: string) => {
    let prompt = `Replace the background with pure white seamless background, ` +
      `professional studio lighting, soft shadow beneath, clean minimal composition, ` +
      `catalog quality, sharp focus, e-commerce ready, high resolution. `;
    if (styleSuffix) prompt += `${styleSuffix}. `;
    prompt += `Keep the ${productDesc} completely unchanged, same position, same size.`;
    return prompt;
  },

  '创意特写': (productDesc: string, styleSuffix: string) => {
    let prompt = `Replace the background with dark moody atmosphere, dramatic side lighting, ` +
      `cinematic feel, premium luxury vibe, shallow depth of field, bokeh lights. `;
    if (styleSuffix) prompt += `${styleSuffix}. `;
    prompt += `Keep the ${productDesc} completely unchanged, same position, same size, same lighting direction.`;
    return prompt;
  },
};

function buildProductDesc(product: ProductInfo): string {
  const parts: string[] = [];
  if (product.color) parts.push(product.color);
  if (product.material) parts.push(product.material);
  if (product.category) parts.push(product.category);
  if (product.shape) parts.push(product.shape);
  return parts.join('') || 'product';
}

/**
 * 生成万相2.7图像编辑用的Prompt组
 * @param product 商品信息
 * @param scenes 用户选择的场景（不传则默认全部预设）
 * @param style 艺术风格（默认 realistic）
 */
export function generatePrompts(
  product: ProductInfo,
  scenes?: SceneSelection[],
  style: ArtStyle = 'realistic'
): PromptGroup[] {
  const productDesc = buildProductDesc(product);
  const styleSuffix = STYLE_SUFFIXES[style] || '';

  // 如果没传 scenes，默认生成全部预设
  const selections = scenes && scenes.length > 0
    ? scenes
    : Object.keys(PRESET_TEMPLATES).map(name => ({ type: 'preset' as const, name }));

  const groups: PromptGroup[] = [];

  for (const selection of selections) {
    if (selection.type === 'preset') {
      const template = PRESET_TEMPLATES[selection.name];
      if (!template) continue;
      groups.push({
        sceneName: selection.name,
        prompt: template(productDesc, styleSuffix),
        negativePrompt: '',
      });
    } else {
      // 自定义场景
      let prompt = `Replace the background with ${selection.description}. `;
      if (styleSuffix) prompt += `${styleSuffix}. `;
      prompt += `Keep the ${productDesc} completely unchanged, same position, same size, same lighting direction.`;
      groups.push({
        sceneName: '自定义',
        prompt,
        negativePrompt: '',
      });
    }
  }

  return groups;
}

/**
 * 获取所有预设场景名称
 */
export function getAvailableScenes(): string[] {
  return Object.keys(PRESET_TEMPLATES);
}

/**
 * 检查字符串是否包含商品相关敏感词（用于前端校验）
 */
export function containsProductWords(text: string): boolean {
  const sensitiveWords = ['保温杯', '杯子', '水瓶', '瓶子', '商品', '产品', '物品'];
  return sensitiveWords.some(w => text.includes(w));
}
