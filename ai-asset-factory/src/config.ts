import 'dotenv/config';
import path from 'path';

export const config = {
  port: Number(process.env.PORT) || 3000,
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  baseUrl: process.env.BASE_URL || '',
  dbPath: process.env.DB_PATH || './data/app.db',

  // 阿里云百炼
  dashscope: {
    apiKey: process.env.DASHSCOPE_API_KEY || '',
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    // 视觉理解模型
    visionModel: 'qwen-vl-plus',
    // 图像编辑模型（图生图换背景）
    editModel: 'wan2.7-image',
    editEndpoint: '/services/aigc/multimodal-generation/generation',
  },

  // 可灵 AI
  kling: {
    apiKey: process.env.KLING_API_KEY || '',
    baseUrl: 'https://api.klingai.com/v1',
  },
};

export const uploadPath = path.resolve(config.uploadDir);
export const dbPath = path.resolve(config.dbPath);
