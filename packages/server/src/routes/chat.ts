/**
 * Chat API 路由
 */

import { Router, Request, Response } from 'express';
import { getChatProvider } from '../providers/chat-index.js';
import { ChatMessageInput } from '../providers/chat-base.js';
import { asyncHandler, validateBody, schemas } from '../middleware/index.js';
import { searchWeb, formatSearchResultsForContext } from '../services/webSearch.js';
import { ragService, IndexedDocument } from '../services/rag/index.js';
import { documentParser } from '../services/documentParser.js';

export const chatRouter = Router();

// 注意：画布上下文类型通过工具调用（Function Calling）处理
// CanvasItemContext 和 CanvasContext 定义在 chat-base.ts 中

/**
 * 从用户消息中提取搜索关键词
 */
function extractSearchQuery(messages: ChatMessageInput[]): string {
  // 获取最后一条用户消息
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
  if (!lastUserMessage) return '';

  // 处理多模态内容：提取文本部分
  let query: string;
  if (typeof lastUserMessage.content === 'string') {
    query = lastUserMessage.content;
  } else {
    // 多模态消息：提取第一个文本内容
    const textPart = lastUserMessage.content.find(p => p.type === 'text');
    query = textPart && 'text' in textPart ? textPart.text : '';
  }

  // 限制长度
  if (query.length > 100) {
    query = query.substring(0, 100);
  }

  return query.trim();
}

/**
 * 构建系统提示词
 */
function buildSystemPrompt(webSearchEnabled: boolean): string {
  let prompt = `<assistant>
  <identity>
    <name>三傻</name>
    <personality>充满创意和灵感的 AI 助手，名字虽"傻"但很聪明，热爱创作</personality>
  </identity>

  <capabilities>
    <skill name="剧本创作">故事大纲、分镜脚本、场景描写、人物塑造</skill>
    <skill name="对白设计">角色台词、情感表达、语言风格</skill>
    <skill name="视觉构思">场景画面、镜头语言、AI绘图提示词</skill>
    <skill name="创意激发">头脑风暴、灵感碰撞、打破创作瓶颈</skill>
  </capabilities>

  <output_format>
    <rule>模块化输出，每个模块有清晰边界</rule>
    <elements>
      <element name="模块标题">用 ### 开始每个模块，简短有力</element>
      <element name="列表">- 无序列表列举要点，简洁明了</element>
      <element name="强调">**粗体** 标记关键词</element>
      <element name="术语">\`反引号\` 包裹专业名词</element>
      <element name="对白">角色名：「台词内容」的格式</element>
      <element name="空行">模块之间用空行分隔，不用 --- 分隔线</element>
    </elements>
    <structure>
      <principle>每个回复分2-4个小模块，每模块聚焦一个点</principle>
      <principle>模块标题直接点明内容，如"核心想法"、"具体方案"、"延展思路"</principle>
      <principle>每模块3-5行，避免大段落</principle>
    </structure>
    <forbidden>
      <item>不用 > 引用块（竖线）</item>
      <item>不用 --- 分隔线</item>
      <item>不用过长的段落</item>
    </forbidden>
  </output_format>

  <style>
    <trait>热情有活力，但不失专业</trait>
    <trait>语言简洁，直击要点</trait>
    <trait>善于用比喻和例子解释复杂概念</trait>
    <trait>适度幽默，让创作更有趣</trait>
    <trait>主动提供延展思路和创意建议</trait>
  </style>

  <guidelines>
    <do>主动分模块组织内容，每模块一个小标题</do>
    <do>为视觉场景提供 AI 绘图提示词</do>
    <do>对白用「」括起来，前面加角色名</do>
    <dont>不要过于冗长啰嗦，每模块控制在3-5行</dont>
    <dont>不要生硬机械，要有温度</dont>
    <dont>不用 emoji</dont>
  </guidelines>
</assistant>`;

  if (webSearchEnabled) {
    prompt += `
<web_search enabled="true">
  <instruction>联网搜索已启用，可引用最新信息辅助创作</instruction>
  <requirement>引用时请标注来源</requirement>
</web_search>`;
  }

  return prompt;
}

/**
 * 处理消息中的文档附件
 * 使用 RAG：索引文档到向量数据库，返回文档 ID 列表
 */
async function processDocumentAttachments(messages: ChatMessageInput[]): Promise<IndexedDocument[]> {
  const indexedDocs: IndexedDocument[] = [];

  for (const msg of messages) {
    if (!msg.attachments) continue;

    for (const attachment of msg.attachments) {
      // 检查是否为文档类型（使用文件名和 MIME 类型）
      const mimeType = attachment.type || '';
      const fileName = attachment.name || `document.${mimeType.split('/').pop() || 'bin'}`;
      const isDocument = documentParser.isSupported(fileName, attachment.type);

      if (isDocument) {
        try {
          // 使用 RAG 服务索引文档
          const indexed = await ragService.indexDocumentFromBase64(
            attachment.content,
            fileName,
            attachment.type
          );
          indexedDocs.push(indexed);
          console.log(`[Chat] 已索引文档: ${indexed.fileName}, ${indexed.chunkCount} 个片段`);
        } catch (error) {
          console.error(`[Chat] 文档索引失败:`, error);
        }
      }
    }
  }

  return indexedDocs;
}

/**
 * 使用 RAG 检索相关文档内容
 */
async function retrieveDocumentContext(
  query: string,
  documentIds: string[]
): Promise<string> {
  if (documentIds.length === 0) return '';

  try {
    const context = await ragService.retrieve(query, {
      documentIds,
      limit: 8, // 检索最相关的 8 个片段
      minScore: 0.3, // 最低相似度阈值
    });

    return ragService.buildContextPrompt(context);
  } catch (error) {
    console.error('[Chat] RAG 检索失败:', error);
    return '';
  }
}

/**
 * POST /api/chat
 * 聊天对话端点
 */
chatRouter.post(
  '/',
  validateBody(schemas.chatMessage),
  asyncHandler(async (req: Request, res: Response) => {
    const { messages, webSearchEnabled, stream, canvasContext } = req.body;

    const provider = getChatProvider();

    // 构建系统提示词
    let systemPrompt = buildSystemPrompt(webSearchEnabled);

    // 如果有画布上下文，添加提示让模型知道可以使用工具
    if (canvasContext && canvasContext.items.length > 0) {
      systemPrompt += `\n\n<canvas_available>
  <instruction>用户正在使用画布编辑器，画布上有 ${canvasContext.items.length} 个元素。</instruction>
  <tool>如果用户询问关于画布内容的问题，请使用 view_canvas 工具查看画布详情。</tool>
</canvas_available>`;
      console.log(`[Chat] 画布上下文可用: ${canvasContext.items.length} 个元素, ${canvasContext.selectedIds.length} 个选中`);
    }

    // 如果启用了联网搜索，先执行搜索
    if (webSearchEnabled) {
      const searchQuery = extractSearchQuery(messages);
      if (searchQuery) {
        try {
          const searchResults = await searchWeb(searchQuery, 5);
          const searchContext = formatSearchResultsForContext(searchResults);
          if (searchContext) {
            systemPrompt += searchContext;
          }
        } catch (error) {
          console.error('[Chat] 搜索失败:', error);
          // 搜索失败不影响对话继续
        }
      }
    }

    // 处理文档附件 (使用 RAG)
    let indexedDocumentIds: string[] = [];
    try {
      const indexedDocs = await processDocumentAttachments(messages);
      if (indexedDocs.length > 0) {
        indexedDocumentIds = indexedDocs.map(d => d.id);
        console.log(`[Chat] 已索引 ${indexedDocs.length} 个文档，共 ${indexedDocs.reduce((sum, d) => sum + d.chunkCount, 0)} 个片段`);
      }
    } catch (error) {
      console.error('[Chat] 文档索引失败:', error);
      // 文档索引失败不影响对话继续
    }

    // 如果有文档，使用 RAG 检索相关内容
    if (indexedDocumentIds.length > 0) {
      const userQuery = extractSearchQuery(messages);
      if (userQuery) {
        try {
          const ragContext = await retrieveDocumentContext(userQuery, indexedDocumentIds);
          if (ragContext) {
            systemPrompt += ragContext;
            console.log(`[Chat] RAG 检索完成，已注入相关上下文`);
          }
        } catch (error) {
          console.error('[Chat] RAG 检索失败:', error);
        }
      }
    }

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
        for await (const chunk of provider.chatStream({ messages: fullMessages, webSearchEnabled, canvasContext })) {
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
      const response = await provider.chat({ messages: fullMessages, webSearchEnabled, canvasContext });

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
