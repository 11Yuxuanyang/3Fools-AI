/**
 * 积分 API 路由
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  creditService,
  calculateCost,
  CREDIT_COST_RULES,
  FREE_DAILY_CREDITS,
  ActionType,
  Resolution,
} from '../services/creditService';
import { authMiddleware } from '../middleware/creditCheck';

const router = Router();

// ============ 验证 Schemas ============

const estimateSchema = z.object({
  action: z.enum(['generate', 'edit', 'inpaint', 'upscale']),
  resolution: z.enum(['720p', '1K', '2K', '4K']).optional(),
});

// ============ API 端点 ============

/**
 * GET /api/credits/balance
 * 获取当前用户积分余额
 */
router.get('/balance', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const balance = await creditService.getBalance(userId);
    const membership = await creditService.getUserMembership(userId);
    const hasSignedIn = await creditService.hasSignedInToday(userId);

    res.json({
      success: true,
      data: {
        ...balance,
        membership: membership ? {
          planId: membership.planId,
          planName: membership.planName,
          status: membership.status,
          expiresAt: membership.expiresAt,
        } : null,
        hasSignedInToday: hasSignedIn,
      },
    });
  } catch (error) {
    console.error('获取积分余额失败:', error);
    res.status(500).json({
      success: false,
      error: '获取积分余额失败',
    });
  }
});

/**
 * GET /api/credits/transactions
 * 获取积分交易记录
 */
router.get('/transactions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const transactions = await creditService.getTransactions(userId, limit, offset);

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          limit,
          offset,
        },
      },
    });
  } catch (error) {
    console.error('获取交易记录失败:', error);
    res.status(500).json({
      success: false,
      error: '获取交易记录失败',
    });
  }
});

/**
 * GET /api/credits/plans
 * 获取会员套餐列表
 */
router.get('/plans', async (_req: Request, res: Response) => {
  try {
    const plans = await creditService.getMembershipPlans();

    res.json({
      success: true,
      data: {
        plans,
        freeUserDailySignin: FREE_DAILY_CREDITS,
      },
    });
  } catch (error) {
    console.error('获取套餐列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取套餐列表失败',
    });
  }
});

/**
 * POST /api/credits/estimate
 * 预估操作消耗积分
 */
router.post('/estimate', async (req: Request, res: Response) => {
  try {
    const { action, resolution = '1K' } = estimateSchema.parse(req.body);

    const cost = calculateCost({
      action: action as ActionType,
      resolution: resolution as Resolution,
    });

    res.json({
      success: true,
      data: {
        action,
        resolution,
        cost,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: '参数错误',
        details: error.issues,
      });
    }
    res.status(500).json({
      success: false,
      error: '预估失败',
    });
  }
});

/**
 * POST /api/credits/signin
 * 每日签到
 */
router.post('/signin', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const result = await creditService.dailySignin(userId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.message,
      });
    }

    // 获取最新余额
    const balance = await creditService.getBalance(userId);

    res.json({
      success: true,
      data: {
        credits: result.credits,
        message: result.message,
        newBalance: balance.balance,
      },
    });
  } catch (error) {
    console.error('签到失败:', error);
    res.status(500).json({
      success: false,
      error: '签到失败',
    });
  }
});

/**
 * GET /api/credits/rules
 * 获取积分消耗规则（供前端显示）
 */
router.get('/rules', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      rules: CREDIT_COST_RULES,
      freeUserDailySignin: FREE_DAILY_CREDITS,
      memberDailySignin: 100,
      registerBonus: 50,
    },
  });
});

/**
 * GET /api/credits/membership
 * 获取用户会员信息
 */
router.get('/membership', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const membership = await creditService.getUserMembership(userId);

    res.json({
      success: true,
      data: {
        membership,
        isMember: membership !== null && membership.status === 'active',
      },
    });
  } catch (error) {
    console.error('获取会员信息失败:', error);
    res.status(500).json({
      success: false,
      error: '获取会员信息失败',
    });
  }
});

// ============ 订单和购买 API ============

const createOrderSchema = z.object({
  planId: z.enum(['standard', 'advanced', 'super']),
  billingCycle: z.enum(['monthly', 'monthly_continuous', 'yearly']).default('monthly'),
});

/**
 * POST /api/credits/orders
 * 创建支付订单
 */
router.post('/orders', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { planId, billingCycle } = createOrderSchema.parse(req.body);

    const order = await creditService.createOrder(userId, planId, billingCycle);

    res.json({
      success: true,
      data: {
        orderId: order.orderId,
        orderNo: order.orderNo,
        amount: order.amount,
        amountYuan: (order.amount / 100).toFixed(2),
        planName: order.planName,
        // TODO: 接入真实支付时返回支付链接/二维码
        paymentUrl: null,
        message: '订单创建成功，请完成支付',
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: '参数错误',
        details: error.issues,
      });
    }
    console.error('创建订单失败:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '创建订单失败',
    });
  }
});

/**
 * GET /api/credits/orders/:orderNo
 * 获取订单详情
 */
router.get('/orders/:orderNo', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { orderNo } = req.params;
    const order = await creditService.getOrder(orderNo);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: '订单不存在',
      });
    }

    res.json({
      success: true,
      data: {
        ...order,
        amountYuan: (order.amount / 100).toFixed(2),
      },
    });
  } catch (error) {
    console.error('获取订单失败:', error);
    res.status(500).json({
      success: false,
      error: '获取订单失败',
    });
  }
});

/**
 * GET /api/credits/orders
 * 获取用户订单列表
 */
router.get('/orders', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const orders = await creditService.getUserOrders(userId, limit);

    res.json({
      success: true,
      data: {
        orders: orders.map(order => ({
          ...order,
          amountYuan: (order.amount / 100).toFixed(2),
        })),
      },
    });
  } catch (error) {
    console.error('获取订单列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取订单列表失败',
    });
  }
});

/**
 * POST /api/credits/orders/:orderNo/pay
 * 模拟支付完成（开发测试用）
 * 生产环境应由支付回调触发
 */
router.post('/orders/:orderNo/pay', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { orderNo } = req.params;
    const { paymentMethod = 'wechat' } = req.body;

    const result = await creditService.completePayment(orderNo, paymentMethod);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    // 获取最新余额
    const userId = req.user!.userId;
    const balance = await creditService.getBalance(userId);

    res.json({
      success: true,
      data: {
        message: '支付成功',
        creditsGranted: result.creditsGranted,
        membership: result.membership,
        newBalance: balance.balance,
      },
    });
  } catch (error) {
    console.error('支付处理失败:', error);
    res.status(500).json({
      success: false,
      error: '支付处理失败',
    });
  }
});

export default router;
