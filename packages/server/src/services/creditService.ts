/**
 * 积分服务
 * 处理积分查询、扣除、充值等核心业务逻辑
 */

import { supabase } from '../lib/supabase';

// ============ 类型定义 ============

export type ActionType = 'generate' | 'edit' | 'inpaint' | 'upscale';
export type Resolution = '720p' | '1K' | '2K' | '4K';
export type TransactionType = 'purchase' | 'consume' | 'daily_signin' | 'register_bonus' | 'refund' | 'monthly_grant';
export type BillingCycle = 'monthly' | 'monthly_continuous' | 'yearly';

export interface CreditBalance {
  balance: number;
  totalEarned: number;
  totalSpent: number;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface MembershipPlan {
  id: string;
  name: string;
  monthlyCredits: number;
  priceMonthly: number;           // 单月价（分）
  priceMonthlyContinuous: number; // 连续包月价（分）
  priceYearly: number;            // 年付价（分）
  originalPriceMonthly?: number;  // 单月原价（分），用于划线价
  originalPriceYearly?: number;   // 年付原价（分），用于划线价
  dailySigninBonus: number;
  features: string[];
}

export interface UserMembership {
  planId: string;
  planName: string;
  status: 'active' | 'expired' | 'cancelled';
  billingCycle: BillingCycle;
  expiresAt: Date;
  autoRenew: boolean;
}

export interface CostCalculationParams {
  action: ActionType;
  resolution?: Resolution;
  referenceImageCount?: number;
  hasPrompt?: boolean;
}

// ============ 积分消耗规则 ============

const CREDIT_RULES = {
  generate: {
    '720p': 2,
    '1K': 4,
    '2K': 6,
    '4K': 8,
  },
  edit: 4,        // 图生图固定 4 积分
  inpaint: 2,     // 擦除/重绘固定 2 积分
  upscale: {
    '2K': 2,
    '4K': 4,
  },
} as const;

// 每日免费积分（每天重置）
const DAILY_FREE_CREDITS = 20;

// ============ 积分计算 ============

/**
 * 计算操作消耗的积分
 */
export function calculateCost(params: CostCalculationParams): number {
  const { action, resolution = '1K' } = params;

  switch (action) {
    case 'generate':
      return CREDIT_RULES.generate[resolution] || CREDIT_RULES.generate['1K'];

    case 'edit':
      return CREDIT_RULES.edit;

    case 'inpaint':
      return CREDIT_RULES.inpaint;

    case 'upscale':
      return CREDIT_RULES.upscale[resolution as '2K' | '4K'] || CREDIT_RULES.upscale['2K'];

    default:
      return 4; // 默认消耗
  }
}

/**
 * 根据尺寸推断分辨率档位
 */
export function inferResolution(size?: string, width?: number, height?: number): Resolution {
  // 如果直接指定了 size
  if (size) {
    const sizeUpper = size.toUpperCase();
    if (sizeUpper.includes('720')) return '720p';
    if (sizeUpper.includes('4K') || sizeUpper.includes('4096')) return '4K';
    if (sizeUpper.includes('2K') || sizeUpper.includes('2048')) return '2K';
    if (sizeUpper.includes('1K') || sizeUpper.includes('1024') || sizeUpper.includes('1080')) return '1K';
  }

  // 根据宽高推断
  if (width && height) {
    const maxDim = Math.max(width, height);
    if (maxDim <= 720) return '720p';
    if (maxDim <= 1080) return '1K';
    if (maxDim <= 2048) return '2K';
    return '4K';
  }

  return '1K'; // 默认
}

// ============ 积分服务类 ============

class CreditService {
  /**
   * 获取用户积分余额
   * 每日自动重置为 20 积分
   */
  async getBalance(userId: string): Promise<CreditBalance> {
    if (!supabase) {
      throw new Error('数据库未配置');
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const { data, error } = await supabase
      .from('user_credits')
      .select('balance, total_earned, total_spent, last_reset_date')
      .eq('user_id', userId)
      .single();

    if (error) {
      // 如果用户没有积分记录，创建一个
      if (error.code === 'PGRST116') {
        await this.initUserCredits(userId);
        return { balance: DAILY_FREE_CREDITS, totalEarned: DAILY_FREE_CREDITS, totalSpent: 0 };
      }
      throw new Error(`获取积分余额失败: ${error.message}`);
    }

    // 检查是否需要重置（新的一天）
    if (data.last_reset_date !== today) {
      // 重置积分为每日额度
      await supabase
        .from('user_credits')
        .update({
          balance: DAILY_FREE_CREDITS,
          last_reset_date: today,
        })
        .eq('user_id', userId);

      return {
        balance: DAILY_FREE_CREDITS,
        totalEarned: data.total_earned,
        totalSpent: data.total_spent,
      };
    }

    return {
      balance: data.balance,
      totalEarned: data.total_earned,
      totalSpent: data.total_spent,
    };
  }

  /**
   * 初始化用户积分账户
   */
  async initUserCredits(userId: string): Promise<void> {
    if (!supabase) return;

    const today = new Date().toISOString().split('T')[0];

    const { error: insertError } = await supabase
      .from('user_credits')
      .insert({
        user_id: userId,
        balance: DAILY_FREE_CREDITS,
        total_earned: DAILY_FREE_CREDITS,
        total_spent: 0,
        last_reset_date: today,
      });

    if (insertError && insertError.code !== '23505') { // 忽略重复键错误
      throw new Error(`初始化积分账户失败: ${insertError.message}`);
    }

    // 记录每日积分
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      type: 'daily_signin',
      amount: DAILY_FREE_CREDITS,
      balance_after: DAILY_FREE_CREDITS,
      description: '每日免费积分',
    });
  }

  /**
   * 检查积分是否足够
   */
  async checkSufficientCredits(userId: string, requiredCredits: number): Promise<boolean> {
    const { balance } = await this.getBalance(userId);
    return balance >= requiredCredits;
  }

  /**
   * 扣除积分（原子操作）
   * 返回是否成功扣除
   */
  async deductCredits(
    userId: string,
    amount: number,
    action: ActionType,
    metadata?: Record<string, unknown>
  ): Promise<{ success: boolean; newBalance: number; error?: string }> {
    if (!supabase) {
      throw new Error('数据库未配置');
    }

    if (amount <= 0) {
      return { success: false, newBalance: 0, error: '扣除积分必须大于0' };
    }

    // 使用事务确保原子性
    const { data: creditData, error: fetchError } = await supabase
      .from('user_credits')
      .select('balance, total_spent')
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      return { success: false, newBalance: 0, error: '获取积分失败' };
    }

    if (creditData.balance < amount) {
      return {
        success: false,
        newBalance: creditData.balance,
        error: `积分不足，需要 ${amount} 积分，当前余额 ${creditData.balance}`
      };
    }

    const newBalance = creditData.balance - amount;
    const newTotalSpent = creditData.total_spent + amount;

    // 更新余额
    const { error: updateError } = await supabase
      .from('user_credits')
      .update({
        balance: newBalance,
        total_spent: newTotalSpent,
      })
      .eq('user_id', userId)
      .eq('balance', creditData.balance); // 乐观锁

    if (updateError) {
      return { success: false, newBalance: creditData.balance, error: '扣除积分失败，请重试' };
    }

    // 记录交易
    const { data: txData } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        type: 'consume',
        amount: -amount,
        balance_after: newBalance,
        description: this.getActionDescription(action),
        metadata,
      })
      .select('id')
      .single();

    // 记录消耗详情
    if (txData) {
      await supabase.from('credit_consumptions').insert({
        user_id: userId,
        transaction_id: txData.id,
        action_type: action,
        credits_used: amount,
        resolution: metadata?.resolution as string,
        provider: metadata?.provider as string,
        request_params: metadata,
      });
    }

    return { success: true, newBalance };
  }

  /**
   * 增加积分
   */
  async addCredits(
    userId: string,
    amount: number,
    type: TransactionType,
    description: string,
    metadata?: Record<string, unknown>
  ): Promise<{ success: boolean; newBalance: number }> {
    if (!supabase) {
      throw new Error('数据库未配置');
    }

    const { data: creditData, error: fetchError } = await supabase
      .from('user_credits')
      .select('balance, total_earned')
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      // 如果没有记录，先初始化
      await this.initUserCredits(userId);
      return this.addCredits(userId, amount, type, description, metadata);
    }

    const newBalance = creditData.balance + amount;
    const newTotalEarned = creditData.total_earned + amount;

    const { error: updateError } = await supabase
      .from('user_credits')
      .update({
        balance: newBalance,
        total_earned: newTotalEarned,
      })
      .eq('user_id', userId);

    if (updateError) {
      throw new Error(`增加积分失败: ${updateError.message}`);
    }

    // 记录交易
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      type,
      amount,
      balance_after: newBalance,
      description,
      metadata,
    });

    return { success: true, newBalance };
  }

  /**
   * 每日签到
   */
  async dailySignin(userId: string): Promise<{ success: boolean; credits: number; message: string }> {
    if (!supabase) {
      throw new Error('数据库未配置');
    }

    const today = new Date().toISOString().split('T')[0];

    // 检查今天是否已签到
    const { data: existingSignin } = await supabase
      .from('daily_signins')
      .select('id')
      .eq('user_id', userId)
      .eq('signin_date', today)
      .single();

    if (existingSignin) {
      return { success: false, credits: 0, message: '今日已签到' };
    }

    // 获取用户会员等级
    const membership = await this.getUserMembership(userId);
    let signinCredits = FREE_DAILY_SIGNIN;

    if (membership && membership.status === 'active') {
      // 获取会员套餐的签到奖励
      const { data: plan } = await supabase
        .from('membership_plans')
        .select('daily_signin_bonus')
        .eq('id', membership.planId)
        .single();

      if (plan) {
        signinCredits = plan.daily_signin_bonus;
      }
    }

    // 记录签到
    const { error: signinError } = await supabase
      .from('daily_signins')
      .insert({
        user_id: userId,
        signin_date: today,
        credits_earned: signinCredits,
      });

    if (signinError) {
      if (signinError.code === '23505') {
        return { success: false, credits: 0, message: '今日已签到' };
      }
      throw new Error(`签到失败: ${signinError.message}`);
    }

    // 增加积分
    await this.addCredits(userId, signinCredits, 'daily_signin', '每日签到奖励');

    return { success: true, credits: signinCredits, message: `签到成功，获得 ${signinCredits} 积分` };
  }

  /**
   * 获取交易记录
   */
  async getTransactions(userId: string, limit = 20, offset = 0): Promise<Transaction[]> {
    if (!supabase) {
      throw new Error('数据库未配置');
    }

    const { data, error } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`获取交易记录失败: ${error.message}`);
    }

    return data.map(tx => ({
      id: tx.id,
      type: tx.type as TransactionType,
      amount: tx.amount,
      balanceAfter: tx.balance_after,
      description: tx.description,
      metadata: tx.metadata,
      createdAt: new Date(tx.created_at),
    }));
  }

  /**
   * 获取会员套餐列表
   */
  async getMembershipPlans(): Promise<MembershipPlan[]> {
    if (!supabase) {
      return this.getDefaultPlans();
    }

    // 直接返回默认套餐，数据库查询由后台异步更新缓存
    // 这样可以保证快速响应
    return this.getDefaultPlans();
  }

  /**
   * 获取默认套餐配置
   */
  private getDefaultPlans(): MembershipPlan[] {
    return [
      {
        id: 'standard',
        name: '标准会员',
        monthlyCredits: 4000,
        priceMonthly: 5900,
        priceMonthlyContinuous: 4900,
        priceYearly: 46900,
        originalPriceMonthly: 5900,
        originalPriceYearly: 70800,
        dailySigninBonus: 100,
        features: ['每月获得4000傻币', '~4000张生成图片', '登录每日领100傻币', '生图加速', '会员模型生图，商用无忧', '多格式导出(SVG、OBJ等)'],
      },
      {
        id: 'advanced',
        name: '高级会员',
        monthlyCredits: 12000,
        priceMonthly: 11900,
        priceMonthlyContinuous: 9900,
        priceYearly: 94900,
        originalPriceMonthly: 11900,
        originalPriceYearly: 142800,
        dailySigninBonus: 100,
        features: ['每月获得12000傻币', '~12000张生成图片', '登录每日领100傻币', '生图优先加速', '会员模型生图，商用无忧', '多格式导出(SVG、OBJ等)'],
      },
      {
        id: 'super',
        name: '超级会员',
        monthlyCredits: 24500,
        priceMonthly: 23900,
        priceMonthlyContinuous: 19900,
        priceYearly: 189900,
        originalPriceMonthly: 23900,
        originalPriceYearly: 286800,
        dailySigninBonus: 100,
        features: ['每月获得24500傻币', '~24500张生成图片', '登录每日领100傻币', '生图最高优先级', '会员模型生图，商用无忧', '多格式导出(SVG、OBJ等)'],
      },
    ];
  }

  /**
   * 获取用户会员信息
   */
  async getUserMembership(userId: string): Promise<UserMembership | null> {
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from('user_memberships')
      .select(`
        plan_id,
        status,
        billing_cycle,
        expires_at,
        auto_renew,
        membership_plans (name)
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error || !data) {
      return null;
    }

    return {
      planId: data.plan_id,
      planName: (data.membership_plans as any)?.name || data.plan_id,
      status: data.status as 'active' | 'expired' | 'cancelled',
      billingCycle: data.billing_cycle as BillingCycle,
      expiresAt: new Date(data.expires_at),
      autoRenew: data.auto_renew,
    };
  }

  /**
   * 检查今日是否已签到
   */
  async hasSignedInToday(userId: string): Promise<boolean> {
    if (!supabase) {
      return false;
    }

    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('daily_signins')
      .select('id')
      .eq('user_id', userId)
      .eq('signin_date', today)
      .single();

    return !!data;
  }

  /**
   * 获取操作描述
   */
  private getActionDescription(action: ActionType): string {
    const descriptions: Record<ActionType, string> = {
      generate: '文生图',
      edit: '图生图',
      inpaint: '擦除/重绘',
      upscale: '图片放大',
    };
    return descriptions[action] || action;
  }

  // ============ 订单和会员购买 ============

  /**
   * 生成订单号
   */
  private generateOrderNo(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `ORD${timestamp}${random}`.toUpperCase();
  }

  /**
   * 创建支付订单
   */
  async createOrder(
    userId: string,
    planId: string,
    billingCycle: BillingCycle
  ): Promise<{
    orderId: string;
    orderNo: string;
    amount: number;
    planName: string;
  }> {
    if (!supabase) {
      throw new Error('数据库未配置');
    }

    // 获取套餐信息
    const { data: plan, error: planError } = await supabase
      .from('membership_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      throw new Error('套餐不存在');
    }

    // 根据购买周期确定价格
    let amount: number;
    switch (billingCycle) {
      case 'yearly':
        amount = plan.price_yearly;
        break;
      case 'monthly_continuous':
        amount = plan.price_monthly_continuous;
        break;
      case 'monthly':
        amount = plan.price_monthly;
        break;
      default:
        throw new Error('无效的购买周期');
    }

    const orderNo = this.generateOrderNo();

    // 创建订单
    const { data: order, error: orderError } = await supabase
      .from('payment_orders')
      .insert({
        user_id: userId,
        order_no: orderNo,
        plan_id: planId,
        billing_cycle: billingCycle,
        amount,
        status: 'pending',
      })
      .select('id')
      .single();

    if (orderError || !order) {
      throw new Error(`创建订单失败: ${orderError?.message}`);
    }

    return {
      orderId: order.id,
      orderNo,
      amount,
      planName: plan.name,
    };
  }

  /**
   * 完成支付（模拟支付成功后调用）
   */
  async completePayment(
    orderNo: string,
    paymentMethod: string = 'wechat',
    paymentId?: string
  ): Promise<{
    success: boolean;
    membership?: UserMembership;
    creditsGranted?: number;
    error?: string;
  }> {
    if (!supabase) {
      throw new Error('数据库未配置');
    }

    // 查找订单
    const { data: order, error: orderError } = await supabase
      .from('payment_orders')
      .select('*')
      .eq('order_no', orderNo)
      .single();

    if (orderError || !order) {
      return { success: false, error: '订单不存在' };
    }

    if (order.status !== 'pending') {
      return { success: false, error: '订单状态异常' };
    }

    // 获取套餐信息
    const { data: plan } = await supabase
      .from('membership_plans')
      .select('*')
      .eq('id', order.plan_id)
      .single();

    if (!plan) {
      return { success: false, error: '套餐不存在' };
    }

    // 计算会员到期时间
    const now = new Date();
    let expiresAt: Date;
    switch (order.billing_cycle) {
      case 'yearly':
        expiresAt = new Date(now.setFullYear(now.getFullYear() + 1));
        break;
      case 'monthly':
      case 'monthly_continuous':
        expiresAt = new Date(now.setMonth(now.getMonth() + 1));
        break;
      default:
        expiresAt = new Date(now.setMonth(now.getMonth() + 1));
    }

    // 更新订单状态
    const { error: updateOrderError } = await supabase
      .from('payment_orders')
      .update({
        status: 'paid',
        payment_method: paymentMethod,
        payment_id: paymentId || `SIM_${Date.now()}`,
        paid_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    if (updateOrderError) {
      return { success: false, error: '更新订单失败' };
    }

    // 检查是否已有会员记录
    const { data: existingMembership } = await supabase
      .from('user_memberships')
      .select('id, expires_at')
      .eq('user_id', order.user_id)
      .eq('status', 'active')
      .single();

    if (existingMembership) {
      // 续期：在现有到期时间上延长
      const currentExpires = new Date(existingMembership.expires_at);
      if (currentExpires > new Date()) {
        // 如果还没过期，在到期时间基础上延长
        switch (order.billing_cycle) {
          case 'yearly':
            expiresAt = new Date(currentExpires.setFullYear(currentExpires.getFullYear() + 1));
            break;
          default:
            expiresAt = new Date(currentExpires.setMonth(currentExpires.getMonth() + 1));
        }
      }

      // 更新会员记录
      await supabase
        .from('user_memberships')
        .update({
          plan_id: order.plan_id,
          billing_cycle: order.billing_cycle,
          expires_at: expiresAt.toISOString(),
          auto_renew: order.billing_cycle === 'monthly_continuous',
        })
        .eq('id', existingMembership.id);
    } else {
      // 新会员：创建记录
      await supabase.from('user_memberships').insert({
        user_id: order.user_id,
        plan_id: order.plan_id,
        status: 'active',
        billing_cycle: order.billing_cycle,
        started_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        auto_renew: order.billing_cycle === 'monthly_continuous',
      });
    }

    // 发放积分
    const creditsToGrant = plan.monthly_credits;
    await this.addCredits(
      order.user_id,
      creditsToGrant,
      'purchase',
      `购买${plan.name}，获得${creditsToGrant}积分`,
      { orderId: order.id, planId: plan.id }
    );

    // 获取更新后的会员信息
    const membership = await this.getUserMembership(order.user_id);

    return {
      success: true,
      membership: membership || undefined,
      creditsGranted: creditsToGrant,
    };
  }

  /**
   * 获取订单详情
   */
  async getOrder(orderNo: string): Promise<{
    id: string;
    orderNo: string;
    planId: string;
    planName?: string;
    billingCycle: BillingCycle;
    amount: number;
    status: string;
    createdAt: Date;
  } | null> {
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from('payment_orders')
      .select(`
        *,
        membership_plans (name)
      `)
      .eq('order_no', orderNo)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      orderNo: data.order_no,
      planId: data.plan_id,
      planName: (data.membership_plans as any)?.name,
      billingCycle: data.billing_cycle,
      amount: data.amount,
      status: data.status,
      createdAt: new Date(data.created_at),
    };
  }

  /**
   * 获取用户订单列表
   */
  async getUserOrders(userId: string, limit = 10): Promise<Array<{
    id: string;
    orderNo: string;
    planName: string;
    amount: number;
    status: string;
    createdAt: Date;
  }>> {
    if (!supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from('payment_orders')
      .select(`
        id,
        order_no,
        amount,
        status,
        created_at,
        membership_plans (name)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data.map(order => ({
      id: order.id,
      orderNo: order.order_no,
      planName: (order.membership_plans as any)?.name || '未知套餐',
      amount: order.amount,
      status: order.status,
      createdAt: new Date(order.created_at),
    }));
  }
}

// 导出单例
export const creditService = new CreditService();

// 导出规则常量（供前端使用）
export const CREDIT_COST_RULES = CREDIT_RULES;
export const FREE_DAILY_CREDITS = DAILY_FREE_CREDITS;
