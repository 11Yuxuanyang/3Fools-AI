# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

三傻大闹AI圈 (CanvasAI Studio) - 前后端分离的 AI 图像生成和编辑画布应用。支持多 AI 模型提供商、实时协作、用户认证、云端存储。

## 项目进度

### ✅ 已完成
- [x] CI/CD 自动部署 (GitHub Actions + SSH + lint + test)
- [x] 强制登录功能（未登录弹出登录框）
- [x] 项目云端存储（Supabase PostgreSQL）
- [x] 用户认证系统（手机号 + 验证码）
- [x] 数据库配置（users, projects, verification_codes, usage_records）
- [x] AI 图片生成（豆包 Seedream）
- [x] AI 聊天（OpenRouter minimax-m2.1 + LangGraph 多轮对话）
- [x] 图片存储（火山引擎 TOS）
- [x] 积分系统（每日免费额度，自动重置）
- [x] AI 擦除/重绘功能优化
- [x] 积分显示组件（CreditDisplay）
- [x] 管理后台（用户管理、订单管理、数据统计）
- [x] AI 聊天 Token 计费（输入/输出分开计费、缓存命中跟踪）
- [x] 系统提示词优化（从 2365 字符精简到 328 字符）
- [x] Zustand 状态管理（canvasStore, viewportStore, generationStore, uiStore, interactionStore）
- [x] 组件拆分（ZoomControls, CameraModal, GenerationBar, ChatButton 等）
- [x] 测试体系（Vitest + Testing Library, 22 个测试用例）
- [x] 后端日志库（pino）

### ⏳ 待开发
- [ ] 短信验证码服务（接入阿里云/火山引擎短信）
- [ ] 微信扫码登录（需企业资质+备案域名）
- [ ] 域名 + HTTPS 配置
- [ ] 支付接入（微信/支付宝）
- [ ] 会员订阅体系（付费增加额度）

## 部署信息

### 生产环境
- **服务器**: 阿里云 ECS (47.97.103.6)
- **前端**: Nginx 静态文件 (`/www/wwwroot/canvasai/packages/client/dist`)
- **后端**: PM2 + tsx (`/www/wwwroot/canvasai/packages/server`)
- **数据库**: Supabase (PostgreSQL)
- **图片存储**: 火山引擎 TOS

### CI/CD
- **仓库**: https://github.com/11Yuxuanyang/3Fools-AI
- **部署方式**: GitHub Actions → SSH → 自动拉取构建重启
- **触发条件**: push 到 main 分支

### 服务器常用命令
```bash
# 进入项目目录
cd /www/wwwroot/canvasai

# 拉取最新代码
git pull origin main

# 构建前端
rm -rf packages/client/dist
npm run build:client

# 重启后端
pm2 restart canvasai
pm2 logs canvasai

# 查看服务状态
pm2 list
```

## 项目结构 (Monorepo)

```
├── .github/workflows/    # CI/CD 配置
│   └── deploy.yml
├── packages/
│   ├── client/          # 前端 (React + Vite, 端口 3000)
│   └── server/          # 后端 (Express + TypeScript, 端口 3001)
│       └── ecosystem.config.cjs  # PM2 配置
├── nginx.conf.example   # Nginx 配置示例
└── package.json         # workspace 配置
```

## 环境要求

- Node.js 20+ (服务器已升级)

## Commands

```bash
# 安装依赖
npm install

# 同时启动前后端
npm run dev

# 仅启动前端 (端口 3000)
npm run dev:client

# 仅启动后端 (端口 3001)
npm run dev:server

# 构建
npm run build

# 代码检查
npm run lint
npm run lint:fix

# 格式化
npm run format
npm run format:check

# 测试
npm run test              # 运行所有测试
npm run test:client       # 仅运行前端测试
```

## 后端配置

服务器 `.env` 文件位置: `/www/wwwroot/canvasai/packages/server/.env`

```env
# 服务配置
PORT=3001
NODE_ENV=production
CORS_ORIGIN=http://47.97.103.6

# 默认提供商
DEFAULT_IMAGE_PROVIDER=doubao
DEFAULT_CHAT_PROVIDER=openrouter

# 豆包 (火山引擎) - 图片生成
DOUBAO_API_KEY=xxx
DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
DOUBAO_IMAGE_MODEL=doubao-seedream-4-0-250828

# OpenRouter - 聊天
OPENROUTER_API_KEY=xxx
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_CHAT_MODEL=minimax/minimax-m2.1

# Supabase - 数据库
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# 火山引擎 TOS - 图片存储
TOS_ACCESS_KEY=xxx
TOS_SECRET_KEY=xxx
TOS_ENDPOINT=tos-cn-beijing.volces.com
TOS_REGION=cn-beijing
TOS_BUCKET=canvasai-studio

# JWT
JWT_SECRET=xxx
```

### 添加新的 AI 提供商

1. 图片生成: 在 `packages/server/src/providers/` 创建文件实现 `AIProvider` 接口 (定义在 `base.ts`)
2. 聊天对话: 创建文件实现 `ChatProvider` 接口 (定义在 `chat-base.ts`)
3. 在对应的 `index.ts` 或 `chat-index.ts` 注册提供商

## Architecture

### Tech Stack
- **前端**: React 19 + TypeScript + Vite + Tailwind CSS
- **后端**: Node.js + Express + TypeScript + Zod (验证)
- **数据库**: Supabase (PostgreSQL)
- **图片存储**: 火山引擎 TOS
- **实时协作**: Yjs + Socket.io

### 数据库表结构 (Supabase)

```sql
-- 用户表
users (id, phone, wechat_openid, nickname, avatar_url, membership_type, is_admin, status, ...)

-- 项目表
projects (id, user_id, name, items, viewport, thumbnail, is_deleted, ...)

-- 验证码表
verification_codes (id, phone, code, expires_at, used, ...)

-- 用量记录表（AI 图片）
usage_records (id, user_id, action_type, tokens_used, cost_cents, ...)

-- 聊天消费记录表
chat_consumptions (
  id, user_id, model, provider,
  prompt_tokens, completion_tokens, total_tokens,
  cache_read_tokens, cache_write_tokens,
  input_cost_cents, output_cost_cents,
  cache_read_cost_cents, cache_write_cost_cents, cache_savings_cents,
  cost_cents, credits_used, created_at
)

-- 管理员操作日志
admin_logs (id, admin_id, action, target_type, target_id, details, ip_address, created_at)
```

### 前端核心结构 (packages/client/src)
- `components/CanvasEditor.tsx` - 画布编辑器（核心组件）
- `components/HomePage.tsx` - 首页（项目列表、登录入口）
- `components/LoginModal.tsx` - 登录弹窗（手机号/微信）
- `components/chatbot/` - AI 对话面板
- `services/auth.ts` - 认证服务（Token 管理）
- `services/projectService.ts` - 项目服务（本地+云端存储）
- `services/api.ts` - 后端 API 调用

### 后端核心结构 (packages/server/src)
- `providers/` - AI 图片提供商 (OpenAI, 豆包, 千问)
- `providers/chat-*.ts` - 聊天提供商
- `routes/ai.ts` - 图片生成/编辑 API
- `routes/chat.ts` - 聊天 API（LangGraph 模式）
- `routes/auth.ts` - 认证 API（手机号、微信）
- `routes/projects.ts` - 项目云端同步 API
- `routes/admin.ts` - 管理后台 API
- `services/authService.ts` - 认证服务（JWT、验证码）
- `services/langGraphChat.ts` - LangGraph 多轮对话服务
- `services/chatUsageService.ts` - 聊天 Token 计费服务
- `services/adminService.ts` - 管理后台业务逻辑
- `services/tosUpload.ts` - TOS 图片上传
- `middleware/adminAuth.ts` - 管理员权限中间件
- `lib/supabase.ts` - Supabase 客户端

### API 端点

**图片**
- `POST /api/ai/generate` - 文生图
- `POST /api/ai/edit` - 图生图（多图参考）
- `POST /api/ai/inpaint` - 图片擦除/重绘（遮罩）
- `POST /api/ai/upscale` - 图片放大

**聊天**
- `POST /api/chat` - 聊天（支持流式、画布上下文、联网搜索）
- `GET /api/chat/health` - 聊天服务状态

**认证**
- `POST /api/auth/phone/send-code` - 发送手机验证码
- `POST /api/auth/phone/verify` - 验证码登录/注册
- `GET /api/auth/wechat/qrcode` - 获取微信登录二维码
- `GET /api/auth/wechat/status/:state` - 轮询微信登录状态
- `GET /api/auth/user` - 获取当前用户信息

**项目**
- `GET /api/projects` - 获取用户项目列表
- `GET /api/projects/:id` - 获取项目详情
- `POST /api/projects` - 创建项目
- `PUT /api/projects/:id` - 更新项目
- `DELETE /api/projects/:id` - 删除项目
- `POST /api/projects/:id/duplicate` - 复制项目

**通用**
- `GET /api/config` - 获取配置
- `GET /api/health` - 健康检查

**管理后台** (需要管理员权限)
- `GET /api/admin/stats/overview` - 概览统计
- `GET /api/admin/stats/users` - 用户趋势
- `GET /api/admin/stats/revenue` - 收入趋势
- `GET /api/admin/stats/usage` - AI 使用统计
- `GET /api/admin/stats/chat` - 聊天 Token 统计（含缓存命中率）
- `GET /api/admin/users` - 用户列表
- `GET /api/admin/users/:id` - 用户详情（含 Token 统计）
- `POST /api/admin/users/:id/credits` - 调整积分
- `POST /api/admin/users/:id/ban` - 封禁用户
- `GET /api/admin/orders` - 订单列表
- `POST /api/admin/orders/:id/refund` - 处理退款

### Key Patterns

**Canvas Rendering**: CSS transforms 实现 pan/zoom，viewport 以屏幕中心为原点

**多选行为**: 点击 = 单选替换，框选（拖动空白区域）= 多选

**内联遮罩编辑**: 图片擦除/重绘直接在图片上绘制遮罩，无弹窗

**前后端通信**: Vite 代理 `/api` 到后端 3001 端口

**聊天流式**: SSE (Server-Sent Events) 格式，心跳保活

**数据持久化**:
- 未登录用户: localStorage (`canvasai_projects`)
- 登录用户: Supabase 云端 + localStorage 双写

**路径别名**: 前端 `@/` → `packages/client/src/`

## 核心功能模块

### 画布工具 (ToolMode)
- SELECT - 选择/移动元素（单击选择，框选多选）
- PAN - 平移画布
- BRUSH - 自由绘制
- TEXT / RECTANGLE / CIRCLE / LINE / ARROW - 形状工具
- GENERATE - AI 生成模式

### 画布元素 (CanvasItem.type)
- `image` - 图片（支持 AI 生成、上传、摄像头、裁剪、遮罩编辑）
- `text` - 文字（双击编辑）
- `rectangle` / `circle` - 基础形状
- `brush` - 画笔路径（SVG path）
- `line` / `arrow` - 直线和箭头
- `connection` - 元素间溯源连接线

### AI 聊天画布上下文
- 聊天时自动传递画布元素信息
- 支持多模态消息（图片 + 文字）
- 系统提示词使用 XML 结构化格式

### AI 聊天 Token 计费
- **模型**: MiniMax M2.1 via OpenRouter
- **价格** (每百万 tokens):
  - 标准输入: $0.30
  - 标准输出: $1.20
  - 缓存读取: $0.03 (节省 90%)
  - 缓存写入: $0.375 (贵 25%)
- **汇率**: 1 USD = 7.03 CNY
- **缓存触发条件**: 需要 1024+ tokens
- **记录字段**: prompt_tokens, completion_tokens, cache_read_tokens, cache_write_tokens, 各项费用

### 管理后台
- **入口**: `/#/admin`
- **权限**: 需要 `users.is_admin = true`
- **功能**:
  - 仪表盘：用户统计、收入统计、AI 使用量、聊天 Token 统计（含缓存命中率）
  - 用户管理：列表、详情、积分调整、封禁/解封
  - 订单管理：列表、退款处理

## 开发注意事项

### 弹窗/模态框
- 需要覆盖全屏的弹窗使用 `createPortal(content, document.body)` 渲染到 body
- 避免父元素堆叠上下文导致 z-index 失效
- 推荐 z-index: 遮罩层 `z-[9998]}`, 弹窗内容 `z-[9999]`

### UI 组件
- 右上角按钮组（傻币、社群、分享）使用统一的圆角样式 `rounded-2xl`
- 颜色使用内联 style 而非 Tailwind 类名时，需同时处理 hover 状态
- 下拉面板居中对齐按钮: `left-1/2 -translate-x-1/2`

### 类型定义
- `CanvasItem.type` 包含 `connection` 类型，确保相关接口同步更新
- `packages/client/src/types.ts` 和 `packages/client/src/services/api.ts` 中有重复的类型定义，修改时需同步
