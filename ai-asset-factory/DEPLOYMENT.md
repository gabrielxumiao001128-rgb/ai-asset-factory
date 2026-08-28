# AI Asset Factory - 部署指南

本指南介绍如何将 AI 营销素材工厂部署到 **GitHub + Netlify + Render** 的组合架构。

---

## 架构概览

```
┌─────────────────┐         ┌─────────────────────┐
│   Netlify       │  HTTPS  │   Render            │
│  (Frontend)     │◄────────┤  (Backend API)      │
│  React + Vite   │  CORS   │  Node.js + Hono     │
│  Static Hosting │         │  AI API Proxy       │
└─────────────────┘         └─────────────────────┘
         │                             │
         │                             │
    GitHub Push                  File Storage
    Auto Deploy                  (uploads/)
```

| 组件 | 平台 | 用途 |
|------|------|------|
| 代码仓库 | GitHub | 版本控制 + 触发自动部署 |
| 前端托管 | Netlify | React 静态页面托管，自动 CDN |
| 后端服务 | Render | Node.js API 服务，AI 调用 |

---

## 前置准备

1. **GitHub 账号** - 用于代码仓库
2. **Netlify 账号** - [netlify.com](https://netlify.com)（免费额度足够）
3. **Render 账号** - [render.com](https://render.com)（免费 Web Service）
4. **AI API Keys** - 阿里云百炼 + 可灵 AI

---

## 第一步：准备代码仓库

### 1.1 初始化 Git 仓库（如尚未初始化）

```bash
cd ai-asset-factory
git init
git add .
git commit -m "Initial commit"
```

### 1.2 创建 GitHub 仓库并推送

在 GitHub 创建新仓库（如 `ai-asset-factory`），然后：

```bash
git remote add origin https://github.com/YOUR_USERNAME/ai-asset-factory.git
git branch -M main
git push -u origin main
```

---

## 第二步：部署后端到 Render

### 2.1 创建 Render Web Service

1. 登录 [Render Dashboard](https://dashboard.render.com)
2. 点击 **New +** → **Web Service**
3. 连接你的 GitHub 仓库
4. 填写配置：

| 配置项 | 值 |
|--------|-----|
| Name | `ai-asset-factory-api` |
| Root Directory | `ai-asset-factory`（如果仓库根不是项目根）|
| Runtime | Node |
| Build Command | `npm install && npm run build` |
| Start Command | `npm run start` |
| Plan | Free |

5. 点击 **Advanced** 添加环境变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `NODE_ENV` | `production` | 生产环境 |
| `PORT` | `3000` | 服务端口 |
| `BASE_URL` | `https://ai-asset-factory-api.onrender.com` | 你的 Render 域名 |
| `FRONTEND_URL` | `https://ai-asset-factory.netlify.app` | 你的 Netlify 域名（先占位，后面改） |
| `DASHSCOPE_API_KEY` | `sk-xxx` | 阿里云百炼 API Key |
| `KLING_API_KEY` | `xxx` | 可灵 AI API Key |

> **注意**：`BASE_URL` 必须设置，否则上传的图片链接会是相对路径，前端无法访问。

6. 点击 **Create Web Service**

Render 会自动构建并部署。等待部署完成，记录下你的后端 URL（如 `https://ai-asset-factory-api.onrender.com`）。

---

## 第三步：部署前端到 Netlify

### 3.1 配置生产环境 API 地址

修改 `frontend/.env.production`：

```env
VITE_API_BASE_URL=https://ai-asset-factory-api.onrender.com
```

将 `your-app.onrender.com` 替换为你实际的 Render 域名。

提交更改：

```bash
git add frontend/.env.production
git commit -m "Update production API URL"
git push
```

### 3.2 创建 Netlify Site

**方式一：通过 Netlify UI（推荐）**

1. 登录 [Netlify](https://app.netlify.com)
2. 点击 **Add new site** → **Import an existing project**
3. 选择 GitHub，授权并选择你的仓库
4. 配置构建：

| 配置项 | 值 |
|--------|-----|
| Base directory | `ai-asset-factory/frontend` |
| Build command | `npm run build` |
| Publish directory | `dist` |

5. 点击 **Deploy site**

**方式二：通过 Netlify CLI**

```bash
# 安装 Netlify CLI
npm install -g netlify-cli

# 登录
cd ai-asset-factory/frontend
netlify login

# 初始化并部署
netlify init
netlify deploy --prod --dir=dist
```

### 3.3 更新 Render CORS 配置（可选但推荐）

部署完成后，拿到 Netlify 域名（如 `https://ai-asset-factory.netlify.app`），回到 Render Dashboard：

1. 进入你的 Web Service
2. 点击 **Environment** → **Edit**
3. 将 `FRONTEND_URL` 更新为你的实际 Netlify 域名
4. 保存，Render 会自动重新部署

---

## 第四步：验证部署

### 4.1 测试后端健康检查

```bash
curl https://your-app.onrender.com/api/health
```

应返回：`{"status":"ok","timestamp":...}`

### 4.2 测试前端访问

打开你的 Netlify 域名，尝试：
1. 上传一张商品图
2. 观察进度面板是否有 SSE 实时推送
3. 检查生成的图片是否能正常显示

### 4.3 检查 CORS

如果浏览器控制台出现 CORS 错误：
- 确认 Render 的 `FRONTEND_URL` 环境变量已设置
- 或者临时设为 `*`（不推荐长期使用）

---

## 环境变量速查表

### 后端 (`Render`)

| 变量 | 必填 | 说明 |
|------|------|------|
| `PORT` | 是 | 服务端口，Render 会自动注入 |
| `BASE_URL` | 是 | 后端公网地址，用于生成文件绝对 URL |
| `FRONTEND_URL` | 推荐 | 前端地址，用于 CORS 限制 |
| `DASHSCOPE_API_KEY` | 是 | 阿里云百炼 API Key |
| `KLING_API_KEY` | 是 | 可灵 AI API Key |
| `DB_PATH` | 否 | SQLite 数据库路径，默认 `./data/app.db` |
| `UPLOAD_DIR` | 否 | 文件存储路径，默认 `./uploads` |

### 前端 (`Netlify` / 构建时)

| 变量 | 必填 | 说明 |
|------|------|------|
| `VITE_API_BASE_URL` | 是 | 后端 API 地址，生产环境必须设置 |

---

## 已知限制

### 1. Render 免费版休眠

Render Free Plan 的 Web Service 会在 **15 分钟无请求后休眠**。首次访问可能需要等待 30 秒左右唤醒。

**影响**：
- SSE 长连接可能在休眠时被切断
- 代码已有 SSE 断开自动 fallback 到轮询的机制，用户体验尚可

**缓解**：
- 使用 [UptimeRobot](https://uptimerobot.com) 等免费服务每 5 分钟 ping 一次 `/api/health`
- 或升级到 Render Starter Plan（$7/月，无休眠）

### 2. 数据库与文件存储

**历史记录（SQLite）**：
任务历史记录现在使用 SQLite 数据库存储（默认 `./data/app.db`）。在服务运行期间，历史记录完全持久化，重启服务后数据仍然保留。

**文件存储（uploads/）**：
生成的图片和视频文件仍然存储在本地磁盘。Render Free Plan 的文件系统是 **临时的**，每次重新部署代码后 `uploads/` 中的文件会丢失。

**影响**：
- 历史记录列表可以正常显示（文字信息持久化）
- 但历史记录中的图片/视频链接在重新部署后会失效
- 已生成的素材文件无法长期保存

**缓解方案**（后续优化）：
- 迁移文件存储到 **Cloudflare R2**（免费 10GB/月）或 **AWS S3**
- 或升级到 Render 的 Persistent Disk

### 3. AI API 费用

阿里云百炼和可灵 AI 按调用量计费，与部署方式无关。请留意：
- 万相2.7 图像编辑：约 ¥0.1-0.3/张
- 可灵 AI 视频生成：约 ¥0.5-2/个

---

## 故障排查

### 前端无法连接后端

1. 检查浏览器控制台 Network 面板，确认请求 URL 是否正确
2. 确认 `VITE_API_BASE_URL` 已设置且没有尾部斜杠
3. 确认 Render 服务已启动且健康检查通过

### CORS 错误

```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```

1. 检查 Render 的 `FRONTEND_URL` 是否匹配你的 Netlify 域名
2. 临时将 `FRONTEND_URL` 设为 `*` 测试
3. 确认请求方法在 `allowMethods` 列表中

### 图片不显示

1. 检查图片 URL 是绝对路径还是相对路径
2. 确认 `BASE_URL` 环境变量已设置
3. 直接访问图片 URL 测试（如 `https://backend.onrender.com/uploads/xxx.png`）

### SSE 连接失败

1. Render Free Plan 可能因休眠导致 SSE 断开
2. 代码已集成自动 fallback 到轮询，正常情况下用户无感知
3. 检查浏览器控制台是否有 EventSource 错误

---

## 后续优化建议

1. **文件存储迁移**：使用 Cloudflare R2 / AWS S3 替代本地磁盘
2. **数据库持久化**：添加 PostgreSQL/MongoDB 存储任务历史和配置
3. **用户认证**：添加 JWT/OAuth 防止 API 被滥用
4. **队列升级**：使用 Redis + Bull 替代内存队列，支持多实例
5. **自定义域名**：Netlify 和 Render 都支持绑定自定义域名

---

## 一键部署脚本（可选）

```bash
#!/bin/bash
# deploy.sh - 手动构建并部署前端

cd frontend
npm install
npm run build

# 部署到 Netlify（需提前安装 netlify-cli）
netlify deploy --prod --dir=dist

echo "Frontend deployed!"
```
