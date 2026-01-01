/**
 * 积分检查中间件
 * 在 AI 操作前检查用户积分是否足够
 */

import { Request, Response, NextFunction } from 'express';
import { creditService, calculateCost, inferResolution, ActionType, Resolution } from '../services/creditService.js';
import { verifyToken } from '../services/authService.js';
import { creditLogger } from '../lib/logger.js';

// 扩展 Request 类型（Express 类型扩展需要使用 namespace）
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        phone?: string;
      };
      creditCost?: number;
      creditAction?: ActionType;
      creditResolution?: Resolution;
    }
  }
}

/**
 * 从请求中提取用户 ID
 */
function extractUserId(req: Request): string | null {
  // 从 Authorization header 提取
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (payload) {
      return payload.userId;
    }
  }

  // 从已解析的 user 对象提取
  if (req.user?.userId) {
    return req.user.userId;
  }

  return null;
}

/**
 * 从请求路径和参数推断操作类型
 */
function inferActionType(req: Request): ActionType {
  const path = req.path.toLowerCase();

  if (path.includes('/generate')) return 'generate';
  if (path.includes('/edit')) return 'edit';
  if (path.includes('/inpaint')) return 'inpaint';
  if (path.includes('/upscale')) return 'upscale';

  return 'generate'; // 默认
}

/**
 * 从请求参数推断分辨率
 */
function inferResolutionFromRequest(req: Request, action: ActionType): Resolution {
  const { size, resolution, width, height } = req.body;

  // 放大操作使用目标分辨率
  if (action === 'upscale') {
    if (resolution === '4K' || resolution === '4k') return '4K';
    return '2K';
  }

  // 其他操作根据 size 或宽高推断
  return inferResolution(size, width, height);
}

/**
 * 积分检查中间件工厂
 * @param actionOverride 可选，强制指定操作类型
 */
export function creditCheckMiddleware(actionOverride?: ActionType) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = extractUserId(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '请先登录',
          code: 'UNAUTHORIZED',
        });
      }

      // 推断操作类型和分辨率
      const action = actionOverride || inferActionType(req);
      const resolution = inferResolutionFromRequest(req, action);

      // 计算消耗积分
      const cost = calculateCost({ action, resolution });

      // 检查余额
      const { balance } = await creditService.getBalance(userId);

      if (balance < cost) {
        return res.status(402).json({
          success: false,
          error: '积分不足',
          code: 'INSUFFICIENT_CREDITS',
          data: {
            required: cost,
            balance: balance,
            action: action,
            resolution: resolution,
          },
          message: `积分不足，本次操作需要 ${cost} 积分，当前余额 ${balance} 积分`,
        });
      }

      // 将信息挂载到 request 上，供后续使用
      req.user = { userId };
      req.creditCost = cost;
      req.creditAction = action;
      req.creditResolution = resolution;

      next();
    } catch (error) {
      creditLogger.error({ err: error }, '积分检查失败');
      return res.status(500).json({
        success: false,
        error: '积分检查失败',
        code: 'CREDIT_CHECK_ERROR',
      });
    }
  };
}

/**
 * 认证中间件（不检查积分，只验证登录）
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const userId = extractUserId(req);

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: '请先登录',
      code: 'UNAUTHORIZED',
    });
  }

  req.user = { userId };
  next();
}

/**
 * 可选认证中间件（不强制登录）
 */
export function optionalAuthMiddleware(req: Request, _res: Response, next: NextFunction) {
  const userId = extractUserId(req);

  if (userId) {
    req.user = { userId };
  }

  next();
}

/**
 * 扣除积分的辅助函数（在操作成功后调用）
 */
export async function deductCreditsAfterSuccess(req: Request, metadata?: Record<string, unknown>) {
  if (!req.user?.userId || !req.creditCost || !req.creditAction) {
    return;
  }

  const result = await creditService.deductCredits(
    req.user.userId,
    req.creditCost,
    req.creditAction,
    {
      resolution: req.creditResolution,
      ...metadata,
    }
  );

  return result;
}
