/**
 * 管理员认证中间件
 */

import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/authService.js';
import { supabase, isSupabaseAvailable } from '../lib/supabase.js';
import { adminLogger } from '../lib/logger.js';

// 扩展 Request 类型
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: {
        userId: string;
        phone?: string;
        isAdmin: boolean;
      };
    }
  }
}

/**
 * 管理员认证中间件
 * 验证用户是否为管理员
 */
export async function adminAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // 1. 提取 Token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: '未登录',
      });
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (!payload || !payload.userId) {
      return res.status(401).json({
        success: false,
        error: 'Token 无效或已过期',
      });
    }

    // 2. 从数据库验证管理员身份
    if (!isSupabaseAvailable()) {
      return res.status(500).json({
        success: false,
        error: '数据库服务不可用',
      });
    }

    const { data: user, error } = await supabase!
      .from('users')
      .select('id, phone, is_admin, status')
      .eq('id', payload.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: '用户不存在',
      });
    }

    // 3. 检查用户状态
    if (user.status === 'banned') {
      return res.status(403).json({
        success: false,
        error: '账户已被封禁',
      });
    }

    // 4. 检查管理员权限
    if (!user.is_admin) {
      return res.status(403).json({
        success: false,
        error: '无管理员权限',
      });
    }

    // 5. 设置管理员信息到请求对象
    req.admin = {
      userId: user.id,
      phone: user.phone,
      isAdmin: true,
    };

    next();
  } catch (error) {
    adminLogger.error({ err: error }, '认证错误');
    return res.status(500).json({
      success: false,
      error: '认证服务错误',
    });
  }
}

/**
 * 记录管理员操作日志
 */
export async function logAdminAction(
  adminId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  details?: Record<string, unknown>,
  ipAddress?: string
) {
  if (!isSupabaseAvailable()) {
    adminLogger.warn('Supabase 不可用，跳过日志记录');
    return;
  }

  try {
    await supabase!.from('admin_logs').insert({
      admin_id: adminId,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
      ip_address: ipAddress,
    });
  } catch (error) {
    adminLogger.error({ err: error }, '日志记录失败');
  }
}
