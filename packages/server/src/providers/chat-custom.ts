/**
 * Custom Chat Provider - 连接外部 AI API
 */

import { config } from '../config.js';
import { ChatProvider, ChatRequest, ChatResponse } from './chat-base.js';

export class CustomChatProvider implements ChatProvider {
  name = 'custom-chat';

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const { messages, webSearchEnabled } = request;

    const response = await fetch(`${config.ai.apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.ai.apiKey}`,
      },
      body: JSON.stringify({
        model: config.ai.defaultModel,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        ...(webSearchEnabled && { web_search: true }),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Chat API failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      message?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    return {
      message: data.choices?.[0]?.message?.content || data.message || '',
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens || 0,
        completionTokens: data.usage.completion_tokens || 0,
      } : undefined,
    };
  }

  async *chatStream(request: ChatRequest): AsyncGenerator<string, void, unknown> {
    const { messages, webSearchEnabled } = request;

    const response = await fetch(`${config.ai.apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.ai.apiKey}`,
      },
      body: JSON.stringify({
        model: config.ai.defaultModel,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        stream: true,
        ...(webSearchEnabled && { web_search: true }),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Chat API failed: ${response.status} - ${errorText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('No response body');
    }

    let buffer = '';

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
        if (data === '[DONE]') return;

        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch {
          // 忽略解析错误
        }
      }
    }
  }
}
