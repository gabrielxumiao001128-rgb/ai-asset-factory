import { Hono } from 'hono';
import { startTask } from '../workflow/pipeline.js';
import { getTask, getTaskEvents, onTaskEvent, removeTaskListener } from '../queue/task-manager.js';
import { getHistory, getHistoryEntry } from '../services/history.js';
import { saveUploadedImage, ensureUploadDir, getLocalUrl } from '../services/file-store.js';
import { serveStatic } from '@hono/node-server/serve-static';
import type { GenerateMode, SceneSelection, SizeOption, ArtStyle, CopyStyle } from '../types.js';
import { analyzeReferenceImage } from '../services/reference-analyzer.js';

export const apiRoutes = new Hono();

// 确保上传目录存在
ensureUploadDir();

// 静态文件服务（访问生成的素材）
apiRoutes.use('/uploads/*', serveStatic({ root: './' }));

/**
 * POST /api/generate
 * 上传商品图，触发生成流程
 *
 * 参数：
 * - mode: 'images' | 'video' | 'all'（默认 all）
 * - scenes: 场景选择数组
 * - size: 图片尺寸（默认 1024*1024）
 * - style: 艺术风格（默认 realistic）
 */
apiRoutes.post('/generate', async (c) => {
  try {
    let imageUrl: string;
    let mode: GenerateMode = 'all';
    let scenes: SceneSelection[] | undefined;
    let size: SizeOption = '1024*1024';
    let style: ArtStyle = 'realistic';
    let copyStyle: CopyStyle | undefined;

    const contentType = c.req.header('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const body = await c.req.parseBody();
      const file = body['file'] as File;
      if (!file) {
        return c.json({ error: '缺少 file 字段' }, 400);
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const localPath = saveUploadedImage(buffer, file.name);
      imageUrl = getLocalUrl(localPath);
      mode = (body['mode'] as GenerateMode) || 'all';
      const scenesJson = body['scenes'] as string;
      if (scenesJson) {
        try { scenes = JSON.parse(scenesJson); } catch { /* ignore */ }
      }
      const sizeParam = body['size'] as string;
      if (sizeParam && ['1024*1024', '1024*1365', '1365*1024', '1024*1792', '1792*1024'].includes(sizeParam)) {
        size = sizeParam as SizeOption;
      }
      const styleParam = body['style'] as string;
      if (styleParam && ['realistic', 'watercolor', 'oil_painting', 'sketch', 'cyberpunk', 'ink_wash', 'minimalist', 'festive'].includes(styleParam)) {
        style = styleParam as ArtStyle;
      }
      const copyStyleParam = body['copyStyle'] as string;
      if (copyStyleParam && ['selling', 'emotional', 'functional', 'promotional'].includes(copyStyleParam)) {
        copyStyle = copyStyleParam as CopyStyle;
      }
    } else {
      const body = await c.req.json();
      imageUrl = body.imageUrl;
      mode = body.mode || 'all';
      scenes = body.scenes;
      if (body.size && ['1024*1024', '1024*1365', '1365*1024', '1024*1792', '1792*1024'].includes(body.size)) {
        size = body.size;
      }
      if (body.style && ['realistic', 'watercolor', 'oil_painting', 'sketch', 'cyberpunk', 'ink_wash', 'minimalist', 'festive'].includes(body.style)) {
        style = body.style;
      }
      if (body.copyStyle && ['selling', 'emotional', 'functional', 'promotional'].includes(body.copyStyle)) {
        copyStyle = body.copyStyle;
      }
      if (!imageUrl) {
        return c.json({ error: '缺少 imageUrl 字段' }, 400);
      }
    }

    if (!['images', 'video', 'all'].includes(mode)) {
      return c.json({ error: 'mode 必须是 images、video 或 all' }, 400);
    }

    const taskId = startTask(imageUrl, mode, scenes, size, style, copyStyle);
    return c.json({ taskId, message: '生成任务已启动', mode });

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

      const history = getTaskEvents(taskId);
      for (const event of history) {
        send(JSON.stringify(event));
      }

      onTaskEvent(taskId, (event) => {
        send(JSON.stringify(event));
        if (event.status === 'completed' || event.status === 'failed') {
          controller.close();
        }
      });

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
 * GET /api/history
 * 获取历史记录列表
 */
apiRoutes.get('/history', (c) => {
  const limit = parseInt(c.req.query('limit') || '20');
  return c.json(getHistory(limit));
});

/**
 * GET /api/history/:taskId
 * 获取单条历史记录
 */
apiRoutes.get('/history/:taskId', (c) => {
  const taskId = c.req.param('taskId');
  const entry = getHistoryEntry(taskId);
  if (!entry) {
    return c.json({ error: '记录不存在' }, 404);
  }
  return c.json(entry);
});

/**
 * POST /api/history/:taskId/regenerate
 * 基于历史记录重新生成
 */
apiRoutes.post('/history/:taskId/regenerate', (c) => {
  const taskId = c.req.param('taskId');
  const entry = getHistoryEntry(taskId);

  if (!entry) {
    return c.json({ error: '记录不存在' }, 404);
  }

  const mode = (entry.mode || 'all') as GenerateMode;
  const scenes = entry.scenes as SceneSelection[] | undefined;
  const size = (entry.size as SizeOption) || '1024*1024';

  // 原图路径可能在 /uploads/ 下，需要确认文件是否存在
  const newTaskId = startTask(entry.originalImageUrl, mode, scenes, size);
  return c.json({ taskId: newTaskId, message: '重新生成任务已启动', mode });
});

/**
 * POST /api/analyze-reference
 * 上传参考图，AI 分析视觉风格，返回推荐配置
 */
apiRoutes.post('/analyze-reference', async (c) => {
  try {
    let imageUrl: string;

    const contentType = c.req.header('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const body = await c.req.parseBody();
      const file = body['file'] as File;
      if (!file) {
        return c.json({ error: '缺少 file 字段' }, 400);
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const localPath = saveUploadedImage(buffer, file.name);
      imageUrl = getLocalUrl(localPath);
    } else {
      const body = await c.req.json();
      imageUrl = body.imageUrl;
      if (!imageUrl) {
        return c.json({ error: '缺少 imageUrl 字段' }, 400);
      }
    }

    const analysis = await analyzeReferenceImage(imageUrl);
    return c.json({ analysis, imageUrl });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /api/health
 * 健康检查
 */
apiRoutes.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() });
});
