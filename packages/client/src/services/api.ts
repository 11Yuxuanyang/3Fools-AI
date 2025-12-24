/**
 * 后端 API 服务
 * 封装所有与后端的通信
 */

const API_BASE = '/api';

// API 错误类
export class APIError extends Error {
  statusCode: number;
  code?: string;

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.code = code;
  }

  static isAPIError(error: unknown): error is APIError {
    return error instanceof APIError;
  }
}

interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

interface RequestOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 带超时和重试的请求函数
 */
async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { timeout = 30000, retries = 0, retryDelay = 1000, ...fetchOptions } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        ...fetchOptions,
      });

      clearTimeout(timeoutId);

      // 处理非 JSON 响应
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        if (!response.ok) {
          throw new APIError('服务器返回了无效的响应', response.status);
        }
        return (await response.text()) as unknown as T;
      }

      const result: APIResponse<T> = await response.json();

      if (!result.success) {
        throw new APIError(result.error || '请求失败', response.status, result.code);
      }

      return result.data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          lastError = new APIError('请求超时', 408, 'TIMEOUT');
        } else if (APIError.isAPIError(error)) {
          // 不重试客户端错误 (4xx)
          if (error.statusCode >= 400 && error.statusCode < 500) {
            throw error;
          }
          lastError = error;
        } else {
          lastError = new APIError(error.message, 500);
        }
      }

      // 如果还有重试次数，等待后重试
      if (attempt < retries) {
        await delay(retryDelay * (attempt + 1)); // 指数退避
        continue;
      }
    }
  }

  throw lastError || new APIError('请求失败', 500);
}

/**
 * 生成图片
 */
export async function generateImage(params: {
  prompt: string;
  model?: string;
  aspectRatio?: string;
}): Promise<string> {
  const { image } = await request<{ image: string }>('/ai/generate', {
    method: 'POST',
    body: JSON.stringify(params),
    timeout: 60000, // AI 生成需要更长时间
    retries: 1,
  });
  return image;
}

/**
 * 编辑图片
 */
export async function editImage(params: {
  image: string;
  prompt: string;
  model?: string;
}): Promise<string> {
  const { image } = await request<{ image: string }>('/ai/edit', {
    method: 'POST',
    body: JSON.stringify(params),
    timeout: 60000,
    retries: 1,
  });
  return image;
}

/**
 * 放大图片
 */
export async function upscaleImage(params: { image: string; resolution?: '2K' | '4K' }): Promise<string> {
  const { image } = await request<{ image: string }>('/ai/upscale', {
    method: 'POST',
    body: JSON.stringify(params),
    timeout: 120000, // 放大可能需要更长时间
    retries: 1,
  });
  return image;
}

/**
 * 获取服务器配置
 */
export async function getConfig(): Promise<{
  provider: string;
  defaultModel: string;
}> {
  return request('/config', { method: 'GET' });
}

/**
 * 健康检查
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`, { method: 'GET' });
    const data = await response.json();
    return data.status === 'ok';
  } catch {
    return false;
  }
}

// ============ Chat API ============

export interface ChatMessageInput {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: Array<{
    type: string;
    content: string;
  }>;
}

export interface ChatParams {
  messages: ChatMessageInput[];
  webSearchEnabled?: boolean;
}

/**
 * 发送聊天消息（非流式）
 */
export async function chat(params: ChatParams): Promise<string> {
  const { message } = await request<{ message: string }>('/chat', {
    method: 'POST',
    body: JSON.stringify({ ...params, stream: false }),
    timeout: 60000,
  });
  return message;
}

/**
 * 发送聊天消息（流式）
 * 支持 AbortController 取消请求
 */
export async function* chatStream(
  params: ChatParams,
  options?: { signal?: AbortSignal; onChunk?: (chunk: string) => void }
): AsyncGenerator<string, void, unknown> {
  const { signal, onChunk } = options || {};

  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, stream: true }),
    signal,
  });

  if (!response.ok) {
    let errorMessage = '请求失败';
    try {
      const error = await response.json();
      errorMessage = error.error || errorMessage;
    } catch {
      // 忽略 JSON 解析错误
    }
    throw new APIError(errorMessage, response.status);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) {
    throw new APIError('无法读取响应', 500);
  }

  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();

        // 忽略心跳和空行
        if (!trimmedLine || trimmedLine.startsWith(':')) continue;
        if (!trimmedLine.startsWith('data: ')) continue;

        const data = trimmedLine.slice(6);
        if (data === '[DONE]') return;

        try {
          const json = JSON.parse(data);
          if (json.error) {
            throw new APIError(json.error, 500);
          }
          if (json.content) {
            onChunk?.(json.content);
            yield json.content;
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * 创建可取消的聊天请求
 */
export function createChatRequest(params: ChatParams, onChunk?: (chunk: string) => void) {
  const controller = new AbortController();

  return {
    generator: chatStream(params, { signal: controller.signal, onChunk }),
    cancel: () => controller.abort(),
  };
}
