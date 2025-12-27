# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

三傻大闹AI圈 (CanvasAI Studio) - 前后端分离的 AI 图像生成和编辑画布应用。支持多 AI 模型提供商、实时协作。

## 项目结构 (Monorepo)

```
├── packages/
│   ├── client/          # 前端 (React + Vite, 端口 3000)
│   └── server/          # 后端 (Express + TypeScript, 端口 3001)
└── package.json         # workspace 配置
```

## 环境要求

- Node.js 18+

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
```

## 后端配置

复制 `packages/server/.env.example` 为 `.env` 并配置 AI 提供商:

```env
# 默认提供商选择
DEFAULT_IMAGE_PROVIDER=openai    # openai, doubao, qwen, custom
DEFAULT_CHAT_PROVIDER=openrouter # openai, doubao, openrouter, custom

# OpenAI
OPENAI_API_KEY=
OPENAI_CHAT_MODEL=gpt-4o
OPENAI_IMAGE_MODEL=dall-e-3

# 豆包 (火山引擎)
DOUBAO_API_KEY=
DOUBAO_CHAT_API_KEY=           # 可选，聊天专用 Key
DOUBAO_CHAT_MODEL=
DOUBAO_IMAGE_MODEL=

# OpenRouter (推荐聊天)
OPENROUTER_API_KEY=
OPENROUTER_CHAT_MODEL=minimax/minimax-m2.1

# 通义千问 (阿里云百炼)
QWEN_API_KEY=
QWEN_IMAGE_MODEL=
QWEN_CHAT_MODEL=
```

### 添加新的 AI 提供商

1. 图片生成: 在 `packages/server/src/providers/` 创建文件实现 `AIProvider` 接口 (定义在 `base.ts`)
2. 聊天对话: 创建文件实现 `ChatProvider` 接口 (定义在 `chat-base.ts`)
3. 在对应的 `index.ts` 或 `chat-index.ts` 注册提供商

## Architecture

### Tech Stack
- **前端**: React 19 + TypeScript + Vite + Tailwind CSS
- **后端**: Node.js + Express + TypeScript + Zod (验证)
- **实时协作**: Yjs + Socket.io

### 前端核心结构 (packages/client/src)
- `components/CanvasEditor.tsx` - 画布编辑器（核心组件，内联遮罩编辑、多选、拖拽等）
- `components/chatbot/` - AI 对话面板（Markdown 渲染、流式响应、画布上下文）
- `components/Canvas/hooks/` - 画布状态管理 hooks (useCanvasState, useAutoSave)
- `components/Collaboration/` - 实时协作组件（在线用户、协作光标）
- `hooks/useMaskEditing.ts` - 图片遮罩擦除/重绘逻辑
- `services/api.ts` - 后端 API 调用（含流式聊天）

### 后端核心结构 (packages/server/src)
- `providers/` - AI 提供商（图片生成）
- `providers/chat-*.ts` - 聊天提供商（OpenRouter, 豆包等）
- `routes/ai.ts` - 图片生成/编辑 API
- `routes/chat.ts` - 聊天 API（流式/非流式）
- `services/webSearch.ts` - DuckDuckGo 联网搜索
- `middleware/validation.ts` - Zod 请求验证 schemas

### API 端点

**图片**
- `POST /api/ai/generate` - 文生图
- `POST /api/ai/edit` - 图生图（多图参考）
- `POST /api/ai/inpaint` - 图片擦除/重绘（遮罩）
- `POST /api/ai/upscale` - 图片放大

**聊天**
- `POST /api/chat` - 聊天（支持 `stream: true` 流式响应，`canvasContext` 画布上下文）
- `GET /api/chat/health` - 聊天服务状态

**通用**
- `GET /api/config` - 获取配置
- `GET /api/health` - 健康检查

### Key Patterns

**Canvas Rendering**: CSS transforms 实现 pan/zoom，viewport 以屏幕中心为原点

**多选行为**: 点击 = 单选替换，框选（拖动空白区域）= 多选

**内联遮罩编辑**: 图片擦除/重绘直接在图片上绘制遮罩，无弹窗

**前后端通信**: Vite 代理 `/api` 到后端 3001 端口

**聊天流式**: SSE (Server-Sent Events) 格式，心跳保活

**数据持久化**: localStorage (`canvasai_projects`)，500ms debounce 自动保存

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
