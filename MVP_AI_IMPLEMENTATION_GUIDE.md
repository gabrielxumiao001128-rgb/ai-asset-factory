# AI 营销素材工厂 — MVP 后端 AI 实现手册

> 本手册聚焦 MVP 阶段的后端核心链路实现，国内模型优先，目标是先跑通「上传商品图 → AI 识别 → 生成场景图 → 生成短视频 → 返回素材」的完整后端链路。

---

## 一、整体链路总览

```
用户上传商品白底图
        │
        ▼
┌───────────────────┐
│  1. 商品视觉理解   │  Qwen-VL（阿里云百炼）
│  提取品类/材质/    │  → 输出结构化 JSON
│  颜色/卖点         │
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│  2. Prompt 生成    │  模板引擎 + 商品信息填充
│  场景模板 + 商品   │  → 输出 3-5 组文生图 Prompt
│  信息 → Prompt    │
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│  3. 图像生成       │  通义万相（阿里云百炼）
│  文生图 × N 张     │  → 输出场景图 URL 列表
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│  4. 图生视频       │  可灵 AI / 通义万相视频
│  选取最佳图 → 视频 │  → 输出短视频 URL
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│  5. 结果组装       │  汇总所有素材 URL
│  返回素材包        │  + 下载到本地
└───────────────────┘
```

整个链路是异步的：步骤 1 是同步调用（几秒），步骤 3 和 4 是异步任务（10 秒到 2 分钟）。后端需要一个简单的任务队列来管理状态。

---

## 二、技术栈选型

| 层 | 选型 | 理由 |
|----|------|------|
| 运行时 | Node.js 20+ | 生态成熟，异步处理友好 |
| 语言 | TypeScript | 类型安全，IDE 补全 |
| Web 框架 | Hono.js | 轻量（~14KB），TS 原生，不绑前端 |
| AI 视觉理解 | Qwen-VL-Plus（阿里云百炼） | 国内可直接用，中文理解强 |
| AI 图像生成 | 通义万相 wanx2.1-t2i（阿里云百炼） | 国内可直接用，支持文生图 |
| AI 视频生成 | 可灵 AI 图生视频 API | 国内可直接用，图生视频效果好 |
| 备选视频 | 通义万相视频生成 | 同一平台，减少 API Key 管理 |
| 任务队列 | 内存 Map + 轮询 | MVP 不引入 Redis，够用 |
| 文件存储 | 本地 ./uploads 目录 | MVP 不引入 OSS/S3 |
| HTTP 客户端 | 原生 fetch（Node 20+） | 无额外依赖 |

---

## 三、环境准备

### 3.1 API Key 申请

**阿里云百炼平台**（Qwen-VL + 通义万相）：

1. 访问 https://bailian.console.aliyun.com/
2. 使用支付宝/阿里云账号登录
3. 左侧菜单 → 模型广场 → 找到 `qwen-vl-plus` 和 `wanx2.1-t2i-turbo`
4. 确认已开通模型权限（新用户有免费额度）
5. 右上角 → API-KEY 管理 → 创建新 Key → 复制保存

**可灵 AI 开放平台**（图生视频）：

1. 访问 https://open.klingai.com/
2. 登录（快手账号）
3. 实名认证后 → API 管理 → 创建应用 → 获取 Access Key + Secret Key
4. 文档：https://docs.qingque.cn/d/home/eZQDN5ejVE6kNbLm5tje2JbQk（可灵 API 文档）

> 如果可灵 API 申请审批较慢，MVP 可先用通义万相视频生成作为替代（同一阿里云百炼平台，同一个 Key）。

### 3.2 环境变量

在项目根目录创建 `.env` 文件：

```bash
# 阿里云百炼
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# 可灵 AI（可选，MVP 可先用通义万相视频替代）
KLING_ACCESS_KEY=xxxxxxxxxxxxxxxx
KLING_SECRET_KEY=xxxxxxxxxxxxxxxx

# 服务配置
PORT=3000
UPLOAD_DIR=./uploads
```

### 3.3 初始化项目

```bash
mkdir ai-asset-factory && cd ai-asset-factory
npm init -y
npm install hono @hono/node-server dotenv
npm install -D typescript @types/node tsx
npx tsc --init
```

`tsconfig.json` 关键配置：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

`package.json` scripts 补充：

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

---

## 四、项目结构

```
ai-asset-factory/
├── package.json
├── tsconfig.json
├── .env
├── .env.example
├── src/
│   ├── index.ts                  # 入口：启动 Hono server
│   ├── config.ts                 # 配置读取
│   ├── types.ts                  # 全局类型定义
│   ├── services/
│   │   ├── vision.ts             # 商品视觉理解（Qwen-VL）
│   │   ├── prompt-engine.ts       # Prompt 生成引擎
│   │   ├── image-gen.ts           # 图像生成（通义万相）
│   │   ├── video-gen.ts           # 图生视频（可灵/通义万相）
│   │   └── file-store.ts          # 文件下载与存储
│   ├── workflow/
│   │   └── pipeline.ts            # 工作流编排器（串联以上服务）
│   ├── queue/
│   │   └── task-manager.ts       # 简单内存任务队列 + 轮询
│   └── routes/
│       └── api.ts                # API 路由定义
├── uploads/                      # 生成的素材（自动创建）
└── MVP_AI_IMPLEMENTATION_GUIDE.md
```

---

## 五、核心模块实现

以下每个模块给出完整的代码骨架，可以直接复制使用。模块之间通过 `types.ts` 中的类型约束接口。

### 5.1 类型定义 — `src/types.ts`

```typescript
// ============ 商品信息 ============
export interface ProductInfo {
  category: string;        // 品类，如 "咖啡杯"
  material: string;        // 材质，如 "陶瓷"
  color: string;           // 主色调，如 "哑光黑"
  shape: string;           // 外形描述，如 "圆筒形带把手"
  sellingPoints: string[]; // 卖点列表，如 ["便携", "隔热", "大容量"]
  keywords: string[];      // 搜索关键词，用于 Prompt 组装
}

// ============ Prompt 生成结果 ============
export interface PromptGroup {
  sceneName: string;       // 场景名称，如 "户外露营"
  prompt: string;           // 完整文生图 Prompt
  negativePrompt: string;   // 负面提示词
  refImageIndex?: number;   // 使用哪张商品图作为参考（0 = 原图）
}

// ============ 图像生成结果 ============
export interface GeneratedImage {
  url: string;              // 图片 URL
  localPath: string;        // 本地存储路径
  promptUsed: string;       // 使用的 Prompt
  sceneName: string;         // 场景名称
}

// ============ 视频生成结果 ============
export interface GeneratedVideo {
  url: string;              // 视频 URL
  localPath: string;        // 本地存储路径
  sourceImageIndex: number;  // 基于哪张图生成的
  duration: number;          // 时长（秒）
}

// ============ 最终素材包 ============
export interface AssetPackage {
  taskId: string;
  status: TaskStatus;
  productInfo?: ProductInfo;
  images: GeneratedImage[];
  video?: GeneratedVideo;
  originalImageUrl: string;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

// ============ 任务状态 ============
export type TaskStatus =
  | 'pending'          // 等待开始
  | 'analyzing'        // 商品识别中
  | 'prompting'        // 生成 Prompt 中
  | 'generating_images' // 生成图片中
  | 'generating_video'  // 生成视频中
  | 'completed'        // 完成
  | 'failed';          // 失败

// ============ 任务队列事件 ============
export interface TaskEvent {
  taskId: string;
  status: TaskStatus;
  message: string;
  timestamp: number;
}
```

### 5.2 配置 — `src/config.ts`

```typescript
import 'dotenv/config';
import path from 'path';

export const config = {
  port: Number(process.env.PORT) || 3000,
  uploadDir: process.env.UPLOAD_DIR || './uploads',

  // 阿里云百炼
  dashscope: {
    apiKey: process.env.DASHSCOPE_API_KEY || '',
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    // 文生图模型：wanx2.1-t2i-turbo（速度快）或 wanx2.1-t2i-plus（质量高）
    imageModel: 'wanx2.1-t2i-turbo',
    // 视觉理解模型
    visionModel: 'qwen-vl-plus',
  },

  // 可灵 AI
  kling: {
    accessKey: process.env.KLING_ACCESS_KEY || '',
    secretKey: process.env.KLING_SECRET_KEY || '',
    baseUrl: 'https://api.klingai.com/v1',
  },
};

export const uploadPath = path.resolve(config.uploadDir);
```

### 5.3 商品视觉理解 — `src/services/vision.ts`

用 Qwen-VL 识别商品图，输出结构化信息。这是整条链路的起点。

```typescript
import { config } from '../config';
import type { ProductInfo } from '../types';

/**
 * 调用 Qwen-VL 分析商品图片
 * 输入：图片 URL
 * 输出：结构化商品信息
 */
export async function analyzeProduct(imageUrl: string): Promise<ProductInfo> {
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
                { image: imageUrl },
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
  const text = data.output?.text || data.output?.choices?.[0]?.message?.content || '';

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
```

**要点说明**：
- Qwen-VL 支持图片 URL 输入，所以用户上传的图需要先可通过本地 URL 或公网 URL 访问。MVP 阶段可以先用公网图片 URL 测试。
- Prompt 要求只返回 JSON，但 LLM 可能仍包裹 markdown 代码块，所以 `extractJson` 做了容错。
- 如果 Qwen-VL 返回格式不稳定，可以在 Prompt 中加 few-shot 示例增强稳定性。

### 5.4 Prompt 生成引擎 — `src/services/prompt-engine.ts`

根据商品信息和预设场景模板，生成多组文生图 Prompt。

```typescript
import type { ProductInfo, PromptGroup } from '../types';

// 预设场景模板
const SCENE_TEMPLATES = [
  {
    name: '家居生活',
    prompt: (p: ProductInfo) =>
      `A ${p.color} ${p.material} ${p.category} placed on a wooden dining table, ` +
      `warm morning sunlight through a window, soft shadows, cozy home interior, ` +
      `minimalist decoration, fresh flowers nearby, lifestyle photography, ` +
      `high quality, 4k, product showcase`,
    negative: 'text, watermark, logo, blurry, deformed, extra objects',
  },
  {
    name: '户外场景',
    prompt: (p: ProductInfo) =>
      `A ${p.color} ${p.material} ${p.category} on a picnic mat in a green park, ` +
      `bright natural daylight, shallow depth of field, outdoor lifestyle scene, ` +
      `trees and grass blurred in background, refreshing atmosphere, ` +
      `commercial product photography, 4k`,
    negative: 'text, watermark, logo, blurry, deformed, unnatural colors',
  },
  {
    name: '简约白底',
    prompt: (p: ProductInfo) =>
      `Professional e-commerce product photo of a ${p.color} ${p.material} ${p.category}, ` +
      `pure white background, studio lighting, soft shadow, centered composition, ` +
      `catalog quality, sharp focus, ${p.shape}, ${p.keywords.join(', ')}, ` +
      `high resolution product shot`,
    negative: 'text, watermark, cluttered background, blurry, distorted product',
  },
  {
    name: '创意特写',
    prompt: (p: ProductInfo) =>
      `Extreme close-up of a ${p.color} ${p.material} ${p.category}, ` +
      `highlighting texture and craftsmanship, macro photography, ` +
      `dramatic side lighting, dark background, ${p.sellingPoints.join(' and ')}, ` +
      `premium feel, 4k, artistic product photography`,
    negative: 'text, watermark, full product, wide shot, blurry',
  },
];

/**
 * 根据商品信息生成多组 Prompt
 */
export function generatePrompts(product: ProductInfo): PromptGroup[] {
  return SCENE_TEMPLATES.map((template, index) => ({
    sceneName: template.name,
    prompt: template.prompt(product),
    negativePrompt: template.negative,
    refImageIndex: 0, // MVP 阶段统一用原图
  }));
}

/**
 * 根据用户选择的场景生成单条 Prompt（用于交互式选择）
 */
export function generateSinglePrompt(
  product: ProductInfo,
  sceneName: string
): PromptGroup | null {
  const template = SCENE_TEMPLATES.find(t => t.name === sceneName);
  if (!template) return null;
  return {
    sceneName: template.name,
    prompt: template.prompt(product),
    negativePrompt: template.negative,
    refImageIndex: 0,
  };
}

/**
 * 获取所有可选场景名称（供前端展示选项）
 */
export function getAvailableScenes(): string[] {
  return SCENE_TEMPLATES.map(t => t.name);
}
```

**要点说明**：
- MVP 阶段用 4 个固定场景模板，迭代阶段可改为「LLM 动态生成场景」。
- Prompt 全英文（图像模型对英文理解更好），但商品关键词保留中文不影响。
- `negativePrompt` 用于排除常见翻车问题（文字水印、变形等）。
- 迭代阶段可以增加「风格迁移」（上传竞品图，LLM 拆解光影/构图/配色，生成新 Prompt）。

### 5.5 图像生成 — `src/services/image-gen.ts`

调用通义万相文生图 API。这个 API 是异步的：先提交任务拿到 task_id，然后轮询结果。

```typescript
import { config } from '../config';
import type { GeneratedImage, PromptGroup } from '../types';

/**
 * 提交通义万相文生图任务
 * 返回 task_id
 */
export async function submitImageTask(
  prompt: string,
  negativePrompt: string,
  n: number = 1,
  size: string = '1024*1024'
): Promise<string> {
  const response = await fetch(
    `${config.dashscope.baseUrl}/services/aigc/text2image/image-synthesis`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.dashscope.apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify({
        model: config.dashscope.imageModel,
        input: { prompt },
        parameters: {
          n,
          size,
          negative_prompt: negativePrompt,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`通义万相提交失败: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const taskId = data.output?.task_id;

  if (!taskId) {
    throw new Error(`通义万相未返回 task_id: ${JSON.stringify(data)}`);
  }

  return taskId;
}

/**
 * 轮询任务结果
 * 返回图片 URL 列表
 */
export async function pollImageTask(taskId: string, maxAttempts = 30): Promise<string[]> {
  for (let i = 0; i < maxAttempts; i++) {
    // 每次间隔 3 秒
    await sleep(3000);

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
      const results = data.output?.results || [];
      return results.map((r: any) => r.url).filter(Boolean);
    }

    if (status === 'FAILED') {
      throw new Error(`图像生成失败: ${data.output?.message || '未知错误'}`);
    }
    // PENDING / RUNNING 继续等待
  }

  throw new Error(`图像生成超时（${maxAttempts * 3}秒）`);
}

/**
 * 完整的图像生成流程：提交 → 轮询 → 下载
 */
export async function generateImages(
  prompts: PromptGroup[],
  onProgress?: (msg: string) => void
): Promise<GeneratedImage[]> {
  const allImages: GeneratedImage[] = [];

  for (const group of prompts) {
    onProgress?.(`正在生成场景图: ${group.sceneName}`);

    // 提交任务
    const taskId = await submitImageTask(
      group.prompt,
      group.negativePrompt,
      1, // 每个场景生成 1 张（可调）
      '1024*1024'
    );

    // 轮询等待
    const imageUrls = await pollImageTask(taskId);

    // 下载到本地
    for (const url of imageUrls) {
      const localPath = await downloadImage(url, group.sceneName);
      allImages.push({
        url,
        localPath,
        promptUsed: group.prompt,
        sceneName: group.sceneName,
      });
    }
  }

  return allImages;
}

// ============ 辅助函数 ============

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function downloadImage(url: string, sceneName: string): Promise<string> {
  const { uploadPath } = await import('../config');
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
```

**要点说明**：
- 通义万相 API 是异步的（`X-DashScope-Async: enable`），需要先提交再轮询。
- `pollImageTask` 默认最多轮询 30 次（90 秒），一般 10-30 秒内完成。
- `n` 参数控制每个 Prompt 生成几张图，MVP 设为 1（省额度），迭代时可设为 3-4 做择优。
- 4 个场景 = 4 次提交 + 4 次轮询 = 大约 1-2 分钟完成全部图片生成。
- 迭代阶段可以改为并发提交所有任务，再统一轮询，速度更快。

### 5.6 图生视频 — `src/services/video-gen.ts`

MVP 阶段提供两个方案：可灵 AI（推荐）和通义万相视频（备选）。

```typescript
import { config } from '../config';
import type { GeneratedImage, GeneratedVideo } from '../types';
import { downloadImage } from './image-gen'; // 复用下载函数

// ============================================================
// 方案 A：可灵 AI 图生视频（推荐，效果好）
// ============================================================

/**
 * 调用可灵 AI 图生视频
 * 文档：https://docs.qingque.cn/d/home/eZQDN5ejVE6kNbLm5tje2JbQk
 */
export async function generateVideoWithKling(
  image: GeneratedImage,
  onProgress?: (msg: string) => void
): Promise<GeneratedVideo> {
  onProgress?.('正在提交可灵图生视频任务...');

  // 步骤 1：提交任务
  const taskId = await submitKlingTask(image.url);
  onProgress?.(`可灵任务已提交，task_id: ${taskId}，正在生成视频...`);

  // 步骤 2：轮询结果
  const videoUrl = await pollKlingTask(taskId, onProgress);
  onProgress?.('视频生成完成，正在下载...');

  // 步骤 3：下载到本地
  const { uploadPath } = await import('../config');
  const { mkdirSync, writeFileSync } = await import('fs');
  const { join } = await import('path');
  mkdirSync(uploadPath, { recursive: true });

  const response = await fetch(videoUrl);
  const buffer = Buffer.from(await response.arrayBuffer());
  const filename = `video-${Date.now()}.mp4`;
  const localPath = join(uploadPath, filename);
  writeFileSync(localPath, buffer);

  return {
    url: videoUrl,
    localPath,
    sourceImageIndex: 0, // MVP 固定取第一张
    duration: 5, // 可灵默认 5 秒
  };
}

/**
 * 提交可灵图生视频任务
 */
async function submitKlingTask(imageUrl: string): Promise<string> {
  const response = await fetch(`${config.kling.baseUrl}/videos/image2video`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${generateKlingToken()}`,
    },
    body: JSON.stringify({
      model: 'kling-v1',       // 模型版本
      image: imageUrl,          // 输入图片 URL
      prompt: '产品展示，缓慢旋转，光线变化，商业广告风格',
      duration: '5',            // 视频时长（秒）
      cfg_scale: 0.5,          // 生成自由度
    }),
  });

  if (!response.ok) {
    throw new Error(`可灵提交失败: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const taskId = data.data?.task_id;

  if (!taskId) {
    throw new Error(`可灵未返回 task_id: ${JSON.stringify(data)}`);
  }

  return taskId;
}

/**
 * 轮询可灵任务结果
 */
async function pollKlingTask(
  taskId: string,
  onProgress?: (msg: string) => void
): Promise<string> {
  const maxAttempts = 60; // 最多轮询 60 次（5 分钟）

  for (let i = 0; i < maxAttempts; i++) {
    await sleep(5000); // 每 5 秒轮询一次

    const response = await fetch(
      `${config.kling.baseUrl}/videos/image2video/${taskId}`,
      {
        headers: {
          'Authorization': `Bearer ${generateKlingToken()}`,
        },
      }
    );

    if (!response.ok) continue;

    const data = await response.json();
    const status = data.data?.task_status;

    if (status === 'succeed') {
      const videoUrl = data.data?.videos?.[0]?.url;
      if (videoUrl) return videoUrl;
    }

    if (status === 'failed') {
      throw new Error(`可灵视频生成失败: ${data.data?.task_status_msg || '未知错误'}`);
    }

    if (i % 6 === 0) {
      onProgress?.(`视频生成中... 已等待 ${i * 5} 秒`);
    }
  }

  throw new Error(`可灵视频生成超时（${maxAttempts * 5}秒）`);
}

/**
 * 生成可灵 API JWT Token
 * 可灵使用 HS256 签名的 JWT
 */
function generateKlingToken(): string {
  // 简化版：实际需要用 jsonwebtoken 库签发 JWT
  // Header: {"alg": "HS256", "typ": "JWT"}
  // Payload: {
  //   "iss": accessKey,
  //   "exp": Math.floor(Date.now() / 1000) + 1800,  // 30 分钟有效期
  //   "nbf": Math.floor(Date.now() / 1000) - 5,
  // }
  // 签名：HMAC-SHA256(secretKey, base64url(header) + "." + base64url(payload))
  //
  // 实际实现需安装 jsonwebtoken：
  // npm install jsonwebtoken
  //
  // import jwt from 'jsonwebtoken';
  // return jwt.sign(
  //   { iss: config.kling.accessKey, exp: Math.floor(Date.now() / 1000) + 1800 },
  //   config.kling.secretKey,
  //   { algorithm: 'HS256' }
  // );

  // MVP 占位：实际使用时替换为 JWT 签发
  throw new Error('请安装 jsonwebtoken 并实现 generateKlingToken');
}

// ============================================================
// 方案 B：通义万相视频生成（备选，同一平台同一 Key）
// ============================================================

/**
 * 使用阿里云百炼的视频生成模型
 * 如果可灵 API 未开通，可用此方案
 */
export async function generateVideoWithWanx(
  image: GeneratedImage,
  onProgress?: (msg: string) => void
): Promise<GeneratedVideo> {
  onProgress?.('正在提交通义万相视频生成任务...');

  // 提交任务
  const response = await fetch(
    `${config.dashscope.baseUrl}/services/aigc/video-generation/generation`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.dashscope.apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify({
        model: 'wanx2.1-i2v-turbo', // 图生视频模型
        input: {
          image_url: image.url,
          prompt: '产品缓慢展示，光影变化，商业广告风格',
        },
        parameters: {
          resolution: '720P',
          duration: 5,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`通义万相视频提交失败: ${response.status}`);
  }

  const data = await response.json();
  const taskId = data.output?.task_id;

  if (!taskId) {
    throw new Error(`未返回 task_id: ${JSON.stringify(data)}`);
  }

  onProgress?.('视频生成中...');

  // 轮询（复用通义万相的轮询逻辑）
  const videoUrl = await pollVideoTask(taskId, onProgress);

  // 下载
  const { uploadPath } = await import('../config');
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
 * 轮询通义万相视频任务
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
```

**要点说明**：
- 可灵 AI 使用 JWT 鉴权，需要安装 `jsonwebtoken` 库签发 token。代码中已注明实现方式，使用时取消注释即可。
- 通义万相视频模型名称可能随版本更新变化，使用前请到百炼控制台确认最新模型名。
- 视频生成耗时较长（30 秒到 2 分钟），轮询间隔设为 5 秒，最多等 5 分钟。
- MVP 阶段只选取第一张场景图生成视频，迭代阶段可以让用户选择或 AI 自动选择最佳图。

### 5.7 文件存储 — `src/services/file-store.ts`

管理上传的商品图和生成的素材文件。

```typescript
import { uploadPath } from '../config';
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
 */
export function getLocalUrl(filepath: string): string {
  const filename = filepath.split('/').pop() || '';
  return `/uploads/${filename}`;
}

/**
 * 确保上传目录存在
 */
export function ensureUploadDir(): void {
  if (!existsSync(uploadPath)) {
    mkdirSync(uploadPath, { recursive: true });
  }
}
```

### 5.8 任务管理器 — `src/queue/task-manager.ts`

简单的内存任务队列，管理异步生成任务的生命周期。

```typescript
import type { AssetPackage, TaskStatus, TaskEvent } from '../types';

// 内存存储（MVP 够用，重启丢失）
const tasks = new Map<string, AssetPackage>();
const taskEvents = new Map<string, TaskEvent[]>();

let eventListeners = new Map<string, (event: TaskEvent) => void>();

/**
 * 创建新任务
 */
export function createTask(taskId: string, originalImageUrl: string): AssetPackage {
  const task: AssetPackage = {
    taskId,
    status: 'pending',
    images: [],
    originalImageUrl,
    createdAt: Date.now(),
  };
  tasks.set(taskId, task);
  taskEvents.set(taskId, []);
  return task;
}

/**
 * 更新任务状态
 */
export function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  message?: string
): void {
  const task = tasks.get(taskId);
  if (!task) return;

  task.status = status;

  const event: TaskEvent = {
    taskId,
    status,
    message: message || '',
    timestamp: Date.now(),
  };

  const events = taskEvents.get(taskId) || [];
  events.push(event);
  taskEvents.set(taskId, events);

  // 通知监听器
  const listener = eventListeners.get(taskId);
  if (listener) listener(event);

  if (status === 'completed' || status === 'failed') {
    task.completedAt = Date.now();
  }
}

/**
 * 获取任务完整信息
 */
export function getTask(taskId: string): AssetPackage | undefined {
  return tasks.get(taskId);
}

/**
 * 更新任务的素材数据
 */
export function updateTaskData(
  taskId: string,
  data: Partial<AssetPackage>
): void {
  const task = tasks.get(taskId);
  if (!task) return;
  Object.assign(task, data);
}

/**
 * 获取任务事件历史
 */
export function getTaskEvents(taskId: string): TaskEvent[] {
  return taskEvents.get(taskId) || [];
}

/**
 * 注册事件监听器（用于 SSE 实时推送）
 */
export function onTaskEvent(
  taskId: string,
  callback: (event: TaskEvent) => void
): void {
  eventListeners.set(taskId, callback);
}

/**
 * 移除事件监听器
 */
export function removeTaskListener(taskId: string): void {
  eventListeners.delete(taskId);
}

/**
 * 清理已完成超过 1 小时的任务（定期调用）
 */
export function cleanupOldTasks(): void {
  const oneHourAgo = Date.now() - 3600 * 1000;
  for (const [id, task] of tasks.entries()) {
    if (task.completedAt && task.completedAt < oneHourAgo) {
      tasks.delete(id);
      taskEvents.delete(id);
      eventListeners.delete(id);
    }
  }
}
```

### 5.9 工作流编排器 — `src/workflow/pipeline.ts`

这是核心编排逻辑，把以上所有服务串联起来。

```typescript
import { randomUUID } from 'crypto';
import { analyzeProduct } from '../services/vision';
import { generatePrompts } from '../services/prompt-engine';
import { generateImages } from '../services/image-gen';
import { generateVideoWithKling, generateVideoWithWanx } from '../services/video-gen';
import {
  createTask,
  updateTaskStatus,
  updateTaskData,
  getTask,
} from '../queue/task-manager';
import { config } from '../config';
import type { AssetPackage } from '../types';

/**
 * 完整的素材生成流水线
 * 从商品图到全套营销素材
 */
export async function runPipeline(
  taskId: string,
  imageUrl: string,
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
    const promptGroups = generatePrompts(productInfo);
    log('prompting', `已生成 ${promptGroups.length} 组场景 Prompt: ${promptGroups.map(p => p.sceneName).join(', ')}`);

    // ========== 步骤 3：生成场景图 ==========
    log('generating_images', '开始生成场景图...');
    const images = await generateImages(promptGroups, (msg) => {
      log('generating_images', msg);
    });
    updateTaskData(taskId, { images });
    log('generating_images', `场景图生成完成，共 ${images.length} 张`);

    // ========== 步骤 4：图生视频 ==========
    log('generating_video', '开始生成商品视频...');

    // 选取最佳场景图生成视频（MVP 取第一张非白底图）
    const bestImage = images.find(img => img.sceneName !== '简约白底') || images[0];

    let video;
    try {
      // 优先用可灵
      if (config.kling.accessKey) {
        video = await generateVideoWithKling(bestImage, (msg) => {
          log('generating_video', msg);
        });
      } else {
        // 降级到通义万相
        video = await generateVideoWithWanx(bestImage, (msg) => {
          log('generating_video', msg);
        });
      }
    } catch (videoError) {
      // 视频生成失败不阻塞整体流程，标记警告
      console.error(`[Task ${taskId}] 视频生成失败:`, videoError);
      log('generating_video', '视频生成失败，跳过（图片素材仍可用）');
    }

    if (video) {
      updateTaskData(taskId, { video });
    }

    // ========== 完成 ==========
    log('completed', `素材生成完成！图片 ${images.length} 张${video ? ' + 视频 1 个' : ''}`);

  } catch (error: any) {
    log('failed', `流程失败: ${error.message}`);
    throw error;
  }
}

/**
 * 创建并启动一个生成任务
 */
export function startTask(imageUrl: string): string {
  const taskId = randomUUID();
  createTask(taskId, imageUrl);

  // 异步启动，不阻塞 API 响应
  runPipeline(taskId, imageUrl).catch((err) => {
    console.error(`[Task ${taskId}] Pipeline error:`, err);
  });

  return taskId;
}
```

**要点说明**：
- `runPipeline` 是整条链路的核心，按顺序执行 4 个步骤。
- 每一步都通过 `updateTaskStatus` 更新状态，前端可以通过轮询或 SSE 获取实时进度。
- 视频生成失败不阻塞整体流程——图片素材仍然可用，只是没有视频。这是 MVP 阶段的降级策略。
- `bestImage` 的选择策略很简单：优先选非白底的场景图（因为白底图动起来不好看），迭代阶段可以用 AI 评分择优。

### 5.10 API 路由 — `src/routes/api.ts`

```typescript
import { Hono } from 'hono';
import { startTask } from '../workflow/pipeline';
import { getTask, getTaskEvents, onTaskEvent, removeTaskListener } from '../queue/task-manager';
import { saveUploadedImage, ensureUploadDir, getLocalUrl } from '../services/file-store';
import { serveStatic } from '@hono/node-server/serve-static';

export const apiRoutes = new Hono();

// 确保上传目录存在
ensureUploadDir();

// 静态文件服务（访问生成的素材）
apiRoutes.use('/uploads/*', serveStatic({ root: './' }));

/**
 * POST /api/generate
 * 上传商品图，触发生成流程
 * 
 * 支持两种方式：
 * 1. multipart 上传文件
 * 2. JSON 传 imageUrl
 */
apiRoutes.post('/generate', async (c) => {
  try {
    let imageUrl: string;

    const contentType = c.req.header('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // 方式 1：文件上传
      const body = await c.req.parseBody();
      const file = body['file'] as File;
      if (!file) {
        return c.json({ error: '缺少 file 字段' }, 400);
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const localPath = saveUploadedImage(buffer, file.name);
      imageUrl = getLocalUrl(localPath); // 本地 URL

      // 注意：Qwen-VL 需要公网可访问的 URL
      // MVP 阶段如果本地运行，需要用公网图床或 ngrok 暴露
      // 测试时可以直接传公网 imageUrl 走方式 2
    } else {
      // 方式 2：直接传 URL
      const body = await c.req.json();
      imageUrl = body.imageUrl;
      if (!imageUrl) {
        return c.json({ error: '缺少 imageUrl 字段' }, 400);
      }
    }

    const taskId = startTask(imageUrl);
    return c.json({ taskId, message: '生成任务已启动' });

  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /api/tasks/:taskId
 * 查询任务状态和结果
 */
apiRoutes.get('/tasks/:taskId', (c) => {
  const taskId = c.req.param('taskId');
  const task = getTask(taskId);

  if (!task) {
    return c.json({ error: '任务不存在' }, 404);
  }

  return c.json(task);
});

/**
 * GET /api/tasks/:taskId/events
 * SSE 实时推送任务进度
 */
apiRoutes.get('/tasks/:taskId/events', (c) => {
  const taskId = c.req.param('taskId');

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      // 发送已有事件历史
      const history = getTaskEvents(taskId);
      for (const event of history) {
        send(JSON.stringify(event));
      }

      // 注册监听器接收后续事件
      onTaskEvent(taskId, (event) => {
        send(JSON.stringify(event));
        if (event.status === 'completed' || event.status === 'failed') {
          controller.close();
        }
      });

      // 客户端断开时清理
      c.req.raw.signal.addEventListener('abort', () => {
        removeTaskListener(taskId);
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
});

/**
 * GET /api/health
 * 健康检查
 */
apiRoutes.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() });
});
```

### 5.11 入口 — `src/index.ts`

```typescript
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { apiRoutes } from './routes/api';
import { config } from './config';

const app = new Hono();

// 挂载 API 路由
app.route('/api', apiRoutes);

// 根路由
app.get('/', (c) => {
  return c.json({
    name: 'AI Asset Factory',
    version: '0.1.0',
    endpoints: {
      generate: 'POST /api/generate',
      task: 'GET /api/tasks/:taskId',
      events: 'GET /api/tasks/:taskId/events',
      health: 'GET /api/health',
    },
  });
});

// 启动服务
serve({
  fetch: app.fetch,
  port: config.port,
}, (info) => {
  console.log(`🚀 AI Asset Factory running at http://localhost:${config.port}`);
});
```

---

## 六、API 接口文档

### POST /api/generate — 触发生成

**方式 1：上传文件**

```bash
curl -X POST http://localhost:3000/api/generate \
  -F "file=@product.jpg"
```

**方式 2：传图片 URL（推荐 MVP 测试用）**

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"imageUrl": "https://example.com/product.jpg"}'
```

**响应**

```json
{
  "taskId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "生成任务已启动"
}
```

### GET /api/tasks/:taskId — 查询状态

```bash
curl http://localhost:3000/api/tasks/550e8400-e29b-41d4-a716-446655440000
```

**响应（进行中）**

```json
{
  "taskId": "550e8400-...",
  "status": "generating_images",
  "productInfo": {
    "category": "咖啡杯",
    "color": "哑光黑",
    "material": "陶瓷",
    "shape": "圆筒形带把手",
    "sellingPoints": ["便携", "隔热", "大容量"],
    "keywords": ["咖啡杯", "陶瓷", "黑色"]
  },
  "images": [],
  "originalImageUrl": "https://example.com/product.jpg",
  "createdAt": 1700000000000
}
```

**响应（完成）**

```json
{
  "taskId": "550e8400-...",
  "status": "completed",
  "productInfo": { ... },
  "images": [
    {
      "url": "https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/...",
      "localPath": "/uploads/家居生活-1700000001234.png",
      "promptUsed": "...",
      "sceneName": "家居生活"
    },
    // ... 共 4 张
  ],
  "video": {
    "url": "https://kling-result.com/...",
    "localPath": "/uploads/video-1700000005678.mp4",
    "sourceImageIndex": 0,
    "duration": 5
  },
  "createdAt": 1700000000000,
  "completedAt": 1700000120000
}
```

### GET /api/tasks/:taskId/events — SSE 实时进度

```bash
curl -N http://localhost:3000/api/tasks/550e8400-.../events
```

**SSE 流**

```
data: {"taskId":"...","status":"analyzing","message":"正在分析商品图片...","timestamp":1700000001000}

data: {"taskId":"...","status":"prompting","message":"商品识别完成: 咖啡杯 / 哑光黑 / 陶瓷","timestamp":1700000003000}

data: {"taskId":"...","status":"generating_images","message":"正在生成场景图: 家居生活","timestamp":1700000004000}

data: {"taskId":"...","status":"generating_video","message":"开始生成商品视频...","timestamp":1700000010000}

data: {"taskId":"...","status":"completed","message":"素材生成完成！图片 4 张 + 视频 1 个","timestamp":1700000120000}
```

---

## 七、本地运行与测试

### 7.1 安装依赖

```bash
cd ai-asset-factory
npm install hono @hono/node-server dotenv
npm install -D typescript @types/node tsx
# 如果使用可灵 API，还需要：
# npm install jsonwebtoken
```

### 7.2 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，填入 DASHSCOPE_API_KEY
```

### 7.3 启动服务

```bash
npm run dev
# 输出: 🚀 AI Asset Factory running at http://localhost:3000
```

### 7.4 测试完整链路

准备一张商品白底图的公网 URL（比如从淘宝/1688 复制一张商品图链接），然后：

```bash
# 触发生成
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"imageUrl": "https://img.alicdn.com/xxx/product.jpg"}'

# 拿到 taskId 后查询状态
curl http://localhost:3000/api/tasks/{taskId}

# 或者用 SSE 监听进度
curl -N http://localhost:3000/api/tasks/{taskId}/events
```

### 7.5 快速验证脚本

创建 `test.sh` 方便快速测试：

```bash
#!/bin/bash
# 用法: ./test.sh "https://图片URL"

IMAGE_URL=$1
BASE=http://localhost:3000

echo "1. 触发生成..."
RESULT=$(curl -s -X POST $BASE/api/generate \
  -H "Content-Type: application/json" \
  -d "{\"imageUrl\": \"$IMAGE_URL\"}")

TASK_ID=$(echo $RESULT | grep -o '"taskId":"[^"]*"' | cut -d'"' -f4)
echo "   taskId: $TASK_ID"

echo "2. 轮询状态..."
while true; do
  STATUS=$(curl -s $BASE/api/tasks/$TASK_ID | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  echo "   当前状态: $STATUS"
  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    break
  fi
  sleep 3
done

echo "3. 最终结果:"
curl -s $BASE/api/tasks/$TASK_ID | python3 -m json.tool
```

---

## 八、关键注意事项

### 8.1 图片 URL 公网可达性

Qwen-VL 和通义万相都需要**公网可访问的图片 URL**。如果你上传本地文件，需要通过 ngrok 或 Cloudflare Tunnel 暴露本地服务，或者直接用一个公网图片 URL 来测试。

MVP 测试建议直接用公网 URL（从电商平台复制商品图链接）。

### 8.2 API 额度与费用

| 模型 | 免费额度 | 超出后计费 |
|------|---------|-----------|
| Qwen-VL-Plus | 新用户有免费 token | 约 0.008 元/千 token |
| 通义万相文生图 | 新用户有免费额度 | 约 0.04 元/张 |
| 可灵 AI 图生视频 | 注册送额度 | 约 0.5-1 元/次 |

MVP 一次完整链路约消耗：1 次视觉理解 + 4 次文生图 + 1 次图生视频 ≈ 0.2-1 元。

### 8.3 错误处理策略

| 场景 | 处理方式 |
|------|---------|
| Qwen-VL 调用失败 | 重试 1 次，仍失败则标记 task failed |
| 通义万相单张图生成失败 | 跳过该场景，继续其他场景 |
| 全部图片生成失败 | 标记 task failed |
| 可灵视频生成失败 | 跳过视频，仅返回图片（降级） |
| 通义万相视频生成失败 | 同上降级 |
| 轮询超时 | 标记当前步骤 failed，但不阻塞已完成的结果 |

### 8.4 模型名可能变化

阿里云百炼的模型名会随版本更新。使用前请到百炼控制台 → 模型广场确认最新可用模型名。本手册写作时使用的模型名：

- 视觉理解：`qwen-vl-plus`（也有更强的 `qwen-vl-max`）
- 文生图：`wanx2.1-t2i-turbo`（速度优先）或 `wanx2.1-t2i-plus`（质量优先）
- 图生视频：`wanx2.1-i2v-turbo`

---

## 九、迭代路线图

MVP 跑通后的迭代方向，按优先级排序：

### 迭代 1：多模型路由（1 周）

- 新增「模型路由层」，根据任务类型选择最优模型
- 商品图用通义万相，创意风格图加 FLUX（通过 Replicate），视频优先可灵
- 用户可在 API 参数中指定 `quality: 'fast' | 'high'`

### 迭代 2：商品一致性增强（1-2 周）

- 接入通义万相的「图生图」模式（而非纯文生图），用商品原图做参考
- 增加 Inpainting（局部重绘），只换背景不动商品
- 后处理：商品原图叠加到生成图上（对齐 + 混合边缘）

### 迭代 3：批量 SKU（1 周）

- 支持一次上传多张商品图
- 统一风格批量处理
- 结果按 SKU 分组展示

### 迭代 4：平台尺寸适配（3 天）

- 自动裁剪/缩放为多平台标准尺寸
- Amazon 白底规范检查
- 淘宝/抖音/小红书尺寸预设

### 迭代 5：Copilot 对话式交互（2 周）

- 前端接入对话界面
- LLM 解析用户意图 → 自动选择场景模板 → 执行工作流
- 支持自然语言微调（「换成工业风」「加一张细节图」）

### 迭代 6：工作流可视化（2 周）

- React Flow 画布展示工作流节点
- 用户可手动拖拽调整节点顺序
- 每个节点可查看输入/输出
