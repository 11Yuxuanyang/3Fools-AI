/**
 * Chat API 路由
 */

import { Router, Request, Response } from 'express';
import { getChatProvider } from '../providers/chat-index.js';
import { ChatMessageInput } from '../providers/chat-base.js';
import { asyncHandler, validateBody, schemas } from '../middleware/index.js';

export const chatRouter = Router();

/**
 * 构建系统提示词
 */
function buildSystemPrompt(webSearchEnabled: boolean): string {
  let prompt = `你是 CanvasAI Studio 的智能助手，专注于剧本和脚本编写。

你的主要职责：
1. 帮助用户创作剧本、脚本、故事大纲
2. 提供场景描述、对白建议、人物设定
3. 解答用户关于创作的问题
4. 提供视觉创意建议

回答风格：
- 专业但友好
- 简洁明了
- 提供实际可用的内容
- 适时使用格式化（标题、列表、分段）提高可读性
- 使用 Markdown 格式
`;

  if (webSearchEnabled) {
    prompt += `\n联网搜索已启用，你可以引用最新的信息来辅助创作。`;
  }

  return prompt;
}

/**
 * POST /api/chat
 * 聊天对话端点
 */
chatRouter.post(
  '/',
  validateBody(schemas.chatMessage),
  asyncHandler(async (req: Request, res: Response) => {
    const { messages, webSearchEnabled, stream } = req.body;

    const provider = getChatProvider();

    // 构建系统提示词
    const systemPrompt = buildSystemPrompt(webSearchEnabled);

    // 添加系统消息
    const fullMessages: ChatMessageInput[] = [{ role: 'system', content: systemPrompt }, ...messages];

    if (stream) {
      // 流式响应
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      // 处理客户端断开连接
      let isClientConnected = true;
      res.on('close', () => {
        isClientConnected = false;
      });

      // 心跳定时器
      const heartbeat = setInterval(() => {
        if (isClientConnected) {
          res.write(': heartbeat\n\n');
        }
      }, 15000);

      try {
        for await (const chunk of provider.chatStream({ messages: fullMessages, webSearchEnabled })) {
          if (!isClientConnected) break;
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        }
        if (isClientConnected) {
          res.write('data: [DONE]\n\n');
        }
      } catch (error) {
        if (isClientConnected) {
          const errorMessage = error instanceof Error ? error.message : '流式响应失败';
          res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
        }
      } finally {
        clearInterval(heartbeat);
      }
      res.end();
    } else {
      // 普通响应
      const response = await provider.chat({ messages: fullMessages, webSearchEnabled });

      res.json({
        success: true,
        data: {
          message: response.message,
          usage: response.usage,
        },
      });
    }
  })
);

/**
 * GET /api/chat/health
 * Chat 服务健康检查
 */
chatRouter.get('/health', (_req: Request, res: Response) => {
  const provider = getChatProvider();
  res.json({
    success: true,
    data: {
      provider: provider.name,
      status: 'ok',
    },
  });
});
