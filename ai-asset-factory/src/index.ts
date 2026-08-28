import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { apiRoutes } from './routes/api.js';
import { config } from './config.js';

const app = new Hono();

// CORS - allow Netlify frontend to access Render backend
app.use('*', cors({
  origin: process.env.FRONTEND_URL || '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
}));

// 挂载 API 路由
app.route('/api', apiRoutes);

// 上传文件静态服务（原图和生成素材）
app.use('/uploads/*', serveStatic({ root: './' }));

// 启动服务
serve({
  fetch: app.fetch,
  port: config.port,
}, (info) => {
  console.log(`🚀 AI Asset Factory running at http://localhost:${config.port}`);
});
