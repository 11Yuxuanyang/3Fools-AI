/**
 * OpenRouter 聊天提供商
 * 支持访问多种大模型（OpenAI, Claude, Gemini, Llama 等）
 * API 文档: https://openrouter.ai/docs
 */

import { config } from '../config.js';
import { ChatProvider, ChatRequest, ChatResponse, ChatMessageInput, CanvasContext } from './chat-base.js';

const isDev = config.nodeEnv === 'development';

// 多模态内容类型
type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

// OpenRouter API 消息格式 (OpenAI 兼容，支持多模态)
interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | ContentPart[] | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

// 工具定义
interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

// 画布查看工具定义
const CANVAS_TOOLS: Tool[] = [
  {
    type: 'function',
    function: {
      name: 'view_canvas',
      description: '查看当前画布上的所有元素。当用户询问关于画布内容、图片、形状、文字等问题时调用此工具。例如："画布上有什么？"、"帮我分析这张图片"、"选中的是什么？"',
      parameters: {
        type: 'object',
        properties: {
          include_images: {
            type: 'boolean',
            description: '是否包含图片的视觉内容（用于图片分析）',
          },
        },
        required: [],
      },
    },
  },
];

/**
 * 获取元素类型的中文名称
 */
function getItemTypeName(type: string): string {
  const typeNames: Record<string, string> = {
    image: '图片',
    text: '文字',
    rectangle: '矩形',
    circle: '圆形',
    brush: '画笔',
    line: '直线',
    arrow: '箭头',
  };
  return typeNames[type] || type;
}

/**
 * 格式化画布上下文为文本描述
 */
function formatCanvasContextAsText(canvasContext: CanvasContext): string {
  if (!canvasContext || canvasContext.items.length === 0) {
    return '画布上目前没有任何元素。';
  }

  let result = `画布上共有 ${canvasContext.items.length} 个元素：\n\n`;

  canvasContext.items.forEach((item, index) => {
    const isSelected = canvasContext.selectedIds.includes(item.id);
    const selectedMark = isSelected ? ' [已选中]' : '';

    result += `${index + 1}. ${getItemTypeName(item.type)}${selectedMark}\n`;
    result += `   位置: (${Math.round(item.position.x)}, ${Math.round(item.position.y)})\n`;
    result += `   尺寸: ${Math.round(item.size.width)} × ${Math.round(item.size.height)}\n`;

    if (item.type === 'image' && item.prompt) {
      result += `   生成提示词: "${item.prompt}"\n`;
    }
    if (item.type === 'text' && item.textContent) {
      result += `   文字内容: "${item.textContent}"\n`;
    }
    if (['rectangle', 'circle', 'line', 'arrow'].includes(item.type)) {
      if (item.fill) result += `   填充色: ${item.fill}\n`;
      if (item.stroke) result += `   描边色: ${item.stroke}\n`;
    }
    result += '\n';
  });

  if (canvasContext.selectedIds.length > 0) {
    result += `\n当前选中了 ${canvasContext.selectedIds.length} 个元素。`;
  }

  return result;
}

/**
 * 构建包含图片的多模态工具结果
 */
function buildMultimodalToolResult(
  canvasContext: CanvasContext,
  includeImages: boolean
): ContentPart[] {
  const result: ContentPart[] = [];

  // 添加文本描述
  result.push({
    type: 'text',
    text: formatCanvasContextAsText(canvasContext),
  });

  // 如果需要包含图片
  if (includeImages) {
    const imageItems = canvasContext.items.filter(
      (item) => item.type === 'image' && item.imageData
    );

    // 优先选中的图片，否则取前3张
    const selectedImages = imageItems.filter((item) =>
      canvasContext.selectedIds.includes(item.id)
    );
    const imagesToInclude = selectedImages.length > 0 ? selectedImages : imageItems.slice(0, 3);

    for (const item of imagesToInclude) {
      if (item.imageData) {
        result.push({
          type: 'image_url',
          image_url: { url: item.imageData },
        });
      }
    }
  }

  return result;
}

export class OpenRouterChatProvider implements ChatProvider {
  name = 'openrouter-chat';

  private get cfg() {
    return config.providers.openrouter;
  }

  private get apiKey(): string {
    return this.cfg?.apiKey || '';
  }

  private get baseUrl(): string {
    return this.cfg?.baseUrl || 'https://openrouter.ai/api/v1';
  }

  private get model(): string {
    return this.cfg?.chatModel || 'minimax/minimax-m2.1';
  }

  /**
   * 转换消息格式（支持多模态）
   */
  private convertMessages(messages: ChatMessageInput[]): OpenRouterMessage[] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  /**
   * 处理工具调用
   */
  private async handleToolCall(
    toolName: string,
    args: Record<string, unknown>,
    canvasContext?: CanvasContext
  ): Promise<ContentPart[] | string> {
    if (toolName === 'view_canvas') {
      if (!canvasContext) {
        return '画布上目前没有任何元素。';
      }
      const includeImages = args.include_images === true;
      return buildMultimodalToolResult(canvasContext, includeImages);
    }
    return '未知的工具调用';
  }

  /**
   * 普通聊天（非流式，支持工具调用）
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const { messages, canvasContext } = request;

    if (!this.apiKey) {
      throw new Error('未配置 OpenRouter API Key，请在 .env 中设置 OPENROUTER_API_KEY');
    }

    console.log(`[OpenRouter Chat] 开始对话: model=${this.model}, messages=${messages.length}, hasCanvas=${!!canvasContext}`);

    const conversationMessages = this.convertMessages(messages);
    const totalUsage = { promptTokens: 0, completionTokens: 0 };

    // 最多进行 3 轮工具调用
    for (let round = 0; round < 3; round++) {
      const requestBody: Record<string, unknown> = {
        model: this.model,
        messages: conversationMessages,
      };

      // 如果有画布上下文，添加工具定义
      if (canvasContext && canvasContext.items.length > 0) {
        requestBody.tools = CANVAS_TOOLS;
        requestBody.tool_choice = 'auto';
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'CanvasAI Studio',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (isDev) {
          console.error('[OpenRouter Chat] API 错误:', errorText);
        } else {
          console.error('[OpenRouter Chat] API 错误:', response.status);
        }
        throw new Error(`OpenRouter API 失败: ${response.status}`);
      }

      const data = await response.json() as {
        choices?: Array<{
          message?: {
            content?: string;
            tool_calls?: Array<{
              id: string;
              type: 'function';
              function: { name: string; arguments: string };
            }>;
          };
          finish_reason?: string;
        }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      // 累计 token 使用量
      if (data.usage) {
        totalUsage.promptTokens += data.usage.prompt_tokens || 0;
        totalUsage.completionTokens += data.usage.completion_tokens || 0;
      }

      const choice = data.choices?.[0];
      const assistantMessage = choice?.message;

      // 检查是否有工具调用
      if (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
        console.log(`[OpenRouter Chat] 检测到工具调用: ${assistantMessage.tool_calls.map(t => t.function.name).join(', ')}`);

        // 添加助手消息（包含工具调用）
        conversationMessages.push({
          role: 'assistant',
          content: assistantMessage.content || null,
          tool_calls: assistantMessage.tool_calls,
        });

        // 处理每个工具调用
        for (const toolCall of assistantMessage.tool_calls) {
          const args = JSON.parse(toolCall.function.arguments || '{}');
          const toolResult = await this.handleToolCall(toolCall.function.name, args, canvasContext);

          // 添加工具结果消息
          conversationMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolResult,
          });
        }

        // 继续下一轮对话
        continue;
      }

      // 没有工具调用，返回最终结果
      console.log('[OpenRouter Chat] 响应成功');
      return {
        message: assistantMessage?.content || '',
        usage: totalUsage.promptTokens > 0 ? totalUsage : undefined,
      };
    }

    throw new Error('工具调用轮次超过限制');
  }

  /**
   * 流式聊天（支持工具调用）
   */
  async *chatStream(request: ChatRequest): AsyncGenerator<string, void, unknown> {
    const { messages, canvasContext } = request;

    if (!this.apiKey) {
      throw new Error('未配置 OpenRouter API Key，请在 .env 中设置 OPENROUTER_API_KEY');
    }

    console.log(`[OpenRouter Chat] 开始流式对话: model=${this.model}, messages=${messages.length}, hasCanvas=${!!canvasContext}`);

    const conversationMessages = this.convertMessages(messages);

    // 最多进行 3 轮工具调用
    for (let round = 0; round < 3; round++) {
      const requestBody: Record<string, unknown> = {
        model: this.model,
        messages: conversationMessages,
        stream: true,
      };

      // 如果有画布上下文，添加工具定义
      if (canvasContext && canvasContext.items.length > 0) {
        requestBody.tools = CANVAS_TOOLS;
        requestBody.tool_choice = 'auto';
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'CanvasAI Studio',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (isDev) {
          console.error('[OpenRouter Chat] 流式 API 错误:', errorText);
        } else {
          console.error('[OpenRouter Chat] 流式 API 错误:', response.status);
        }
        throw new Error(`OpenRouter API 失败: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('无法读取响应流');
      }

      let buffer = '';
      let fullContent = '';
      const toolCalls: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }> = [];
      let currentToolCallIndex = -1;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

            const data = trimmedLine.slice(6);
            if (data === '[DONE]') {
              break;
            }

            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta;

              // 处理普通内容
              if (delta?.content) {
                fullContent += delta.content;
                yield delta.content;
              }

              // 处理工具调用（流式累积）
              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  if (tc.index !== undefined) {
                    if (tc.index !== currentToolCallIndex) {
                      currentToolCallIndex = tc.index;
                      toolCalls[tc.index] = {
                        id: tc.id || '',
                        type: 'function',
                        function: { name: '', arguments: '' },
                      };
                    }
                    if (tc.id) {
                      toolCalls[tc.index].id = tc.id;
                    }
                    if (tc.function?.name) {
                      toolCalls[tc.index].function.name = tc.function.name;
                    }
                    if (tc.function?.arguments) {
                      toolCalls[tc.index].function.arguments += tc.function.arguments;
                    }
                  }
                }
              }
            } catch {
              // 忽略 JSON 解析错误
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // 检查是否有工具调用
      if (toolCalls.length > 0 && toolCalls[0]?.function?.name) {
        console.log(`[OpenRouter Chat] 检测到工具调用: ${toolCalls.map(t => t.function.name).join(', ')}`);

        // 添加助手消息（包含工具调用）
        conversationMessages.push({
          role: 'assistant',
          content: fullContent || null,
          tool_calls: toolCalls,
        });

        // 处理每个工具调用
        for (const toolCall of toolCalls) {
          const args = JSON.parse(toolCall.function.arguments || '{}');
          const toolResult = await this.handleToolCall(toolCall.function.name, args, canvasContext);

          // 添加工具结果消息
          conversationMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolResult,
          });
        }

        // 给用户一个提示正在分析画布
        yield '\n\n*正在分析画布内容...*\n\n';

        // 继续下一轮对话
        continue;
      }

      // 没有工具调用，流式响应已完成
      console.log('[OpenRouter Chat] 流式响应完成');
      return;
    }

    throw new Error('工具调用轮次超过限制');
  }
}
