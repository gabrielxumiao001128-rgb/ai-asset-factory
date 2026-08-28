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

// ============ AI 文案 ============
export interface CopywritingSet {
  shortTitle: string;              // 15字短标题
  longTitle: string;               // 30字长标题
  bullets: string[];               // 卖点 bullet points（3-5条）
  sceneCopy: Record<string, string>; // 场景配文，key为场景名
  xiaohongshu: string;             // 小红书风格带货文案
  douyin: string;                  // 抖音风格带货文案
}

// ============ 最终素材包 ============
export interface AssetPackage {
  taskId: string;
  status: TaskStatus;
  productInfo?: ProductInfo;
  copywriting?: CopywritingSet;
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

// ============ 生成模式 ============
export type GenerateMode = 'images' | 'video' | 'all';

// ============ 尺寸选项 ============
export type SizeOption = '1024*1024' | '1024*1365' | '1365*1024' | '1024*1792' | '1792*1024';

// ============ 艺术风格 ============
export type ArtStyle =
  | 'realistic'
  | 'watercolor'
  | 'oil_painting'
  | 'sketch'
  | 'cyberpunk'
  | 'ink_wash'
  | 'minimalist'
  | 'festive';

// ============ 场景选择 ============
export interface PresetScene {
  type: 'preset';
  name: string;
}

export interface CustomScene {
  type: 'custom';
  description: string;
}

export type SceneSelection = PresetScene | CustomScene;

// ============ 文案风格 ============
export type CopyStyle = 'selling' | 'emotional' | 'functional' | 'promotional';

// ============ 参考图分析结果 ============
export interface ReferenceAnalysis {
  scene: string;              // 推荐场景，如 "家居生活" 或自定义描述
  style: ArtStyle;            // 推荐艺术风格
  size: SizeOption;          // 推荐尺寸比例
  lighting: string;           // 光照氛围描述
  composition: string;        // 构图描述
  description: string;        // 整体视觉描述（英文，用于 prompt 组装）
  recommendedScenes: string[]; // 推荐的多个场景
}

// ============ 任务队列事件 ============
export interface TaskEvent {
  taskId: string;
  status: TaskStatus;
  message: string;
  timestamp: number;
}
