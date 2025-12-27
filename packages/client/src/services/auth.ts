/**
 * 认证服务 - 管理用户登录状态
 */

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export interface User {
  id: string;
  phone?: string;
  nickname: string;
  avatar?: string;
  membership_type: 'free' | 'monthly' | 'yearly';
}

/**
 * 保存登录信息
 */
export function saveAuth(token: string, user: User): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * 获取 Token
 */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * 获取用户信息
 */
export function getUser(): User | null {
  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * 是否已登录
 */
export function isLoggedIn(): boolean {
  return !!getToken();
}

/**
 * 退出登录
 */
export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  // 兼容旧的 user key
  localStorage.removeItem('user');
}

/**
 * 获取带认证的 headers
 */
export function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * 发送验证码
 */
export async function sendCode(phone: string): Promise<{ success: boolean; error?: string; devCode?: string }> {
  const response = await fetch('/api/auth/phone/send-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });

  return response.json();
}

/**
 * 手机号登录
 */
export async function loginWithPhone(
  phone: string,
  code: string,
  mode: 'login' | 'register' = 'login'
): Promise<{ success: boolean; user?: User; token?: string; error?: string }> {
  const response = await fetch('/api/auth/phone/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code, mode }),
  });

  const data = await response.json();

  if (data.success && data.data?.token && data.data?.user) {
    saveAuth(data.data.token, data.data.user);
    return { success: true, user: data.data.user, token: data.data.token };
  }

  return { success: false, error: data.error || '登录失败' };
}

/**
 * 获取当前用户（从服务器验证）
 */
export async function fetchCurrentUser(): Promise<User | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const response = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await response.json();
    if (data.success && data.data?.user) {
      // 更新本地存储
      localStorage.setItem(USER_KEY, JSON.stringify(data.data.user));
      return data.data.user;
    }

    // Token 无效，清理登录状态
    logout();
    return null;
  } catch {
    return null;
  }
}

/**
 * 带认证的 fetch
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, { ...options, headers });
}
