/**
 * 认证服务 - 使用 Supabase 存储
 */

import jwt from 'jsonwebtoken';
import { supabase, isSupabaseAvailable } from '../lib/supabase.js';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';
const JWT_EXPIRES_IN = '7d';

export interface JWTPayload {
  userId: string;
  phone?: string;
}

export interface User {
  id: string;
  phone?: string;
  nickname: string;
  avatar_url?: string;
  membership_type: string;
  daily_quota: number;
}

/**
 * 生成 JWT Token
 */
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * 验证 JWT Token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * 生成 6 位验证码
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 保存验证码到数据库
 */
export async function saveVerificationCode(phone: string, code: string): Promise<boolean> {
  if (!isSupabaseAvailable() || !supabase) {
    console.warn('[Auth] Supabase 不可用，使用内存存储');
    return false;
  }

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 分钟后过期

  const { error } = await supabase.from('verification_codes').insert({
    phone,
    code,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    console.error('[Auth] 保存验证码失败:', error.message);
    return false;
  }

  return true;
}

/**
 * 验证验证码
 */
export async function verifyCode(phone: string, code: string): Promise<boolean> {
  if (!isSupabaseAvailable() || !supabase) {
    return false;
  }

  const { data, error } = await supabase
    .from('verification_codes')
    .select('*')
    .eq('phone', phone)
    .eq('code', code)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return false;
  }

  // 标记为已使用
  await supabase.from('verification_codes').update({ used: true }).eq('id', data.id);

  return true;
}

/**
 * 检查验证码发送频率
 */
export async function canSendCode(phone: string): Promise<boolean> {
  if (!isSupabaseAvailable() || !supabase) {
    return true; // 如果数据库不可用，允许发送
  }

  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();

  const { data } = await supabase
    .from('verification_codes')
    .select('created_at')
    .eq('phone', phone)
    .gt('created_at', oneMinuteAgo)
    .limit(1)
    .single();

  return !data; // 如果没有最近的记录，可以发送
}

/**
 * 获取或创建用户（手机号）
 */
export async function getOrCreateUserByPhone(phone: string): Promise<User | null> {
  if (!isSupabaseAvailable() || !supabase) {
    return null;
  }

  // 查找现有用户
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone)
    .single();

  if (existingUser) {
    return existingUser as User;
  }

  // 创建新用户
  const { data: newUser, error } = await supabase
    .from('users')
    .insert({
      phone,
      nickname: `用户${phone.slice(-4)}`,
    })
    .select()
    .single();

  if (error) {
    console.error('[Auth] 创建用户失败:', error.message);
    return null;
  }

  console.log(`[Auth] 新用户注册: ${phone.slice(0, 3)}****${phone.slice(-4)}`);
  return newUser as User;
}

/**
 * 获取或创建用户（微信）
 */
export async function getOrCreateUserByWechat(
  openid: string,
  userInfo?: {
    nickname?: string;
    avatar_url?: string;
    unionid?: string;
  }
): Promise<User | null> {
  if (!isSupabaseAvailable() || !supabase) {
    return null;
  }

  // 查找现有用户
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('wechat_openid', openid)
    .single();

  if (existingUser) {
    return existingUser as User;
  }

  // 创建新用户
  const { data: newUser, error } = await supabase
    .from('users')
    .insert({
      wechat_openid: openid,
      wechat_unionid: userInfo?.unionid,
      nickname: userInfo?.nickname || '微信用户',
      avatar_url: userInfo?.avatar_url,
    })
    .select()
    .single();

  if (error) {
    console.error('[Auth] 创建微信用户失败:', error.message);
    return null;
  }

  return newUser as User;
}

/**
 * 根据 ID 获取用户
 */
export async function getUserById(userId: string): Promise<User | null> {
  if (!isSupabaseAvailable() || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, phone, nickname, avatar_url, membership_type, daily_quota')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as User;
}

/**
 * 记录用量
 */
export async function recordUsage(
  userId: string,
  actionType: string,
  tokensUsed = 0,
  metadata = {}
): Promise<void> {
  if (!isSupabaseAvailable() || !supabase) {
    return;
  }

  await supabase.from('usage_records').insert({
    user_id: userId,
    action_type: actionType,
    tokens_used: tokensUsed,
    metadata,
  });
}

/**
 * 获取用户今日用量
 */
export async function getTodayUsage(userId: string): Promise<number> {
  if (!isSupabaseAvailable() || !supabase) {
    return 0;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('usage_records')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', today.toISOString());

  return count || 0;
}
