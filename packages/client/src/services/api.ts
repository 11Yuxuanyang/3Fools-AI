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
  const { timeout = 30000, retries = 0, retryDelay = 1000, headers: customHeaders, ...fetchOptions } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...fetchOptions,
        headers: {
          'Content-Type': 'application/json',
          ...customHeaders,
        },
        signal: controller.signal,
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
 * 生成图片（文生图）
 * 支持可选的参考图进行融合生成
 */
export async function generateImage(params: {
  prompt: string;
  model?: string;
  aspectRatio?: string;
  size?: string;  // 图片尺寸
  watermark?: boolean;        // 是否添加水印
  referenceImage?: string;    // 参考图（base64）用于 AI 融合
}): Promise<string> {
  const { image } = await request<{ image: string }>('/ai/generate', {
    method: 'POST',
    body: JSON.stringify(params),
    timeout: 120000, // AI 生成需要更长时间，融合可能更久
    retries: 1,
    headers: {
      Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
    },
  });
  return image;
}

/**
 * 编辑图片（图生图）
 * 支持单张或多张参考图
 */
export async function editImage(params: {
  image: string | string[];  // 支持单张或多张参考图
  prompt: string;
  model?: string;
}): Promise<string> {
  const { image } = await request<{ image: string }>('/ai/edit', {
    method: 'POST',
    body: JSON.stringify(params),
    timeout: 60000,
    retries: 1,
    headers: {
      Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
    },
  });
  return image;
}

/**
 * 图片修复/擦除（Inpainting）
 * 使用遮罩指定要擦除的区域
 */
export async function inpaintImage(params: {
  image: string;  // 原始图片
  mask: string;   // 遮罩图片（白色区域表示要擦除的区域）
  prompt?: string; // 可选提示词
}): Promise<string> {
  const { image } = await request<{ image: string }>('/ai/inpaint', {
    method: 'POST',
    body: JSON.stringify(params),
    timeout: 60000,
    retries: 1,
    headers: {
      Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
    },
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
    headers: {
      Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
    },
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
  content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;
  attachments?: Array<{
    name?: string; // 文件名（用于 RAG 文档处理）
    type: string;
    content: string;
  }>;
}

// 画布元素上下文（用于 AI 对话）
export interface CanvasItemContext {
  id: string;
  type: 'image' | 'text' | 'rectangle' | 'circle' | 'brush' | 'line' | 'arrow' | 'connection';
  position: { x: number; y: number };
  size: { width: number; height: number };
  imageData?: string;  // base64
  prompt?: string;
  textContent?: string;
  fill?: string;
  stroke?: string;
}

export interface CanvasContext {
  items: CanvasItemContext[];
  selectedIds: string[];
}

/**
 * 聊天参数
 *
 * 支持两种模式：
 * 1. LangGraph 模式：{ message, threadId } - 服务端维护历史
 * 2. 传统模式：{ messages } - 客户端维护历史
 */
export interface ChatParams {
  // LangGraph 模式参数
  message?: string;
  threadId?: string;
  attachments?: Array<{  // 文档附件（用于 RAG）
    name?: string;
    type: string;
    content: string;
  }>;

  // 传统模式参数
  messages?: ChatMessageInput[];

  // 通用参数
  webSearchEnabled?: boolean;
  canvasContext?: CanvasContext;
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

// ============ Credits API ============

export interface CreditBalance {
  balance: number;
  totalEarned: number;
  totalSpent: number;
  membership: {
    planId: string;
    planName: string;
    status: string;
    expiresAt: string;
  } | null;
  hasSignedInToday: boolean;
}

export interface CreditTransaction {
  id: string;
  type: 'purchase' | 'consume' | 'daily_signin' | 'register_bonus' | 'refund' | 'monthly_grant';
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

export interface MembershipPlan {
  id: string;
  name: string;
  monthlyCredits: number;
  priceMonthly: number;           // 单月价（分）
  priceMonthlyContinuous: number; // 连续包月价（分）
  priceYearly: number;            // 年付价（分）
  originalPriceMonthly?: number;  // 单月原价（分）
  originalPriceYearly?: number;   // 年付原价（分）
  dailySigninBonus: number;
  features: string[];
}

export interface CreditRules {
  generate: {
    '720p': number;
    '1K': number;
    '2K': number;
    '4K': number;
  };
  edit: number;
  inpaint: number;
  upscale: {
    '2K': number;
    '4K': number;
  };
}

/**
 * 获取用户积分余额
 */
export async function getCreditsBalance(): Promise<CreditBalance> {
  return request('/credits/balance', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
    },
  });
}

/**
 * 获取积分交易记录
 */
export async function getCreditsTransactions(limit = 20, offset = 0): Promise<{
  transactions: CreditTransaction[];
  pagination: { limit: number; offset: number };
}> {
  return request(`/credits/transactions?limit=${limit}&offset=${offset}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
    },
  });
}

/**
 * 获取会员套餐列表
 */
export async function getMembershipPlans(): Promise<{
  plans: MembershipPlan[];
  freeUserDailySignin: number;
}> {
  return request('/credits/plans', { method: 'GET' });
}

/**
 * 预估操作消耗积分
 */
export async function estimateCreditCost(params: {
  action: 'generate' | 'edit' | 'inpaint' | 'upscale';
  resolution?: '720p' | '1K' | '2K' | '4K';
}): Promise<{ action: string; resolution: string; cost: number }> {
  return request('/credits/estimate', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * 每日签到
 */
export async function dailySignin(): Promise<{
  credits: number;
  message: string;
  newBalance: number;
}> {
  return request('/credits/signin', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
    },
  });
}

/**
 * 兑换邀请码
 */
export async function redeemInviteCode(code: string): Promise<{
  message: string;
  creditsGranted: number;
  newBalance: number;
}> {
  return request('/credits/invite/redeem', {
    method: 'POST',
    body: JSON.stringify({ code }),
    headers: {
      Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
    },
  });
}

/**
 * 获取积分消耗规则
 */
export async function getCreditRules(): Promise<{
  rules: CreditRules;
  freeUserDailySignin: number;
  memberDailySignin: number;
  registerBonus: number;
}> {
  return request('/credits/rules', { method: 'GET' });
}

/**
 * 获取用户会员信息
 */
export async function getMembershipStatus(): Promise<{
  membership: {
    planId: string;
    planName: string;
    status: string;
    billingCycle: string;
    expiresAt: string;
    autoRenew: boolean;
  } | null;
  isMember: boolean;
}> {
  return request('/credits/membership', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
    },
  });
}

// ============ 订单 API ============

export interface Order {
  orderId: string;
  orderNo: string;
  amount: number;
  amountYuan: string;
  planName: string;
  status?: string;
  paymentUrl?: string | null;
  message?: string;
}

/**
 * 创建支付订单
 */
export async function createOrder(params: {
  planId: 'standard' | 'advanced' | 'super';
  billingCycle?: 'monthly' | 'monthly_continuous' | 'yearly';
}): Promise<Order> {
  return request('/credits/orders', {
    method: 'POST',
    body: JSON.stringify(params),
    headers: {
      Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
    },
  });
}

/**
 * 获取订单详情
 */
export async function getOrder(orderNo: string): Promise<Order> {
  return request(`/credits/orders/${orderNo}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
    },
  });
}

/**
 * 获取用户订单列表
 */
export async function getUserOrders(limit = 10): Promise<{
  orders: Array<{
    id: string;
    orderNo: string;
    planName: string;
    amount: number;
    amountYuan: string;
    status: string;
    createdAt: string;
  }>;
}> {
  return request(`/credits/orders?limit=${limit}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
    },
  });
}

/**
 * 模拟支付完成（开发测试用）
 */
export async function simulatePayment(orderNo: string, paymentMethod = 'wechat'): Promise<{
  message: string;
  creditsGranted: number;
  membership: {
    planId: string;
    planName: string;
    status: string;
    expiresAt: string;
  };
  newBalance: number;
}> {
  return request(`/credits/orders/${orderNo}/pay`, {
    method: 'POST',
    body: JSON.stringify({ paymentMethod }),
    headers: {
      Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
    },
  });
}
