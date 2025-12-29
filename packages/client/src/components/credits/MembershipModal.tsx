/**
 * 傻币充值弹窗
 * 支持三种计费周期：单年购买(6.6折)、连续包月(8.3折)、单月购买
 */

import { useState, useEffect } from 'react';
import { getMembershipPlans, createOrder, simulatePayment, redeemInviteCode, MembershipPlan, Order } from '@/services/api';

type BillingCycle = 'yearly' | 'monthly_continuous' | 'monthly';

interface MembershipModalProps {
  currentBalance: number;
  currentMembership: {
    planId: string;
    planName: string;
    status: string;
    expiresAt: string;
  } | null;
  onClose: () => void;
  onPurchaseSuccess: () => void;
}

// 免费套餐配置
const FREE_PLAN = {
  features: [
    '每日免费20傻币',
    '免费模型随心选',
    '畅享使用基础模型',
  ],
};

export function MembershipModal({
  currentBalance,
  currentMembership,
  onClose,
  onPurchaseSuccess,
}: MembershipModalProps) {
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [freeUserDailySignin, setFreeUserDailySignin] = useState(20);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [paymentStep, setPaymentStep] = useState<'select' | 'paying' | 'success'>('select');
  const [paymentResult, setPaymentResult] = useState<{
    creditsGranted: number;
    newBalance: number;
  } | null>(null);

  // 当前选择的计费周期
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('yearly');

  // 邀请码相关状态
  const [inviteCode, setInviteCode] = useState('');
  const [inviteCodeLoading, setInviteCodeLoading] = useState(false);
  const [inviteCodeMessage, setInviteCodeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const data = await getMembershipPlans();
        setPlans(data.plans);
        setFreeUserDailySignin(data.freeUserDailySignin);
      } catch (error) {
        console.error('获取套餐列表失败:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, []);

  // 兑换邀请码
  const handleRedeemInviteCode = async () => {
    if (!inviteCode.trim() || inviteCodeLoading) return;

    setInviteCodeLoading(true);
    setInviteCodeMessage(null);

    try {
      const result = await redeemInviteCode(inviteCode.trim());
      setInviteCodeMessage({ type: 'success', text: result.message });
      setInviteCode('');
      // 通知父组件刷新余额
      onPurchaseSuccess();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '兑换失败';
      setInviteCodeMessage({ type: 'error', text: errorMessage });
    } finally {
      setInviteCodeLoading(false);
    }
  };

  // 格式化价格（分转元）
  const formatPrice = (cents: number): string => {
    return (cents / 100).toFixed(0);
  };

  // 获取当前计费周期的价格
  const getPrice = (plan: MembershipPlan): number => {
    switch (billingCycle) {
      case 'yearly':
        return plan.priceYearly;
      case 'monthly_continuous':
        return plan.priceMonthlyContinuous;
      case 'monthly':
        return plan.priceMonthly;
    }
  };

  // 获取原价（用于划线显示）
  const getOriginalPrice = (plan: MembershipPlan): number | undefined => {
    switch (billingCycle) {
      case 'yearly':
        return plan.originalPriceYearly;
      case 'monthly_continuous':
        return plan.priceMonthly; // 连续包月对比单月原价
      case 'monthly':
        return undefined; // 单月无划线价
    }
  };

  // 获取价格单位
  const getPriceUnit = (): string => {
    switch (billingCycle) {
      case 'yearly':
        return '/年';
      case 'monthly_continuous':
      case 'monthly':
        return '/月';
    }
  };

  // 获取价格说明
  const getPriceDescription = (plan: MembershipPlan): string => {
    switch (billingCycle) {
      case 'yearly':
        return `低至¥${formatPrice(plan.priceYearly / 12)}/月`;
      case 'monthly_continuous':
        return `次月按¥${formatPrice(plan.priceMonthlyContinuous)}/月自动续费，可取消`;
      case 'monthly':
        return '';
    }
  };

  const handlePurchase = async (planId: string) => {
    setPurchasing(true);
    try {
      const order = await createOrder({
        planId: planId as 'standard' | 'advanced' | 'super',
        billingCycle: billingCycle === 'yearly' ? 'yearly' : billingCycle === 'monthly_continuous' ? 'monthly_continuous' : 'monthly',
      });
      setCurrentOrder(order);
      setPaymentStep('paying');
    } catch (error) {
      console.error('创建订单失败:', error);
      alert('创建订单失败，请重试');
    } finally {
      setPurchasing(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!currentOrder) return;

    setPurchasing(true);
    try {
      const result = await simulatePayment(currentOrder.orderNo);
      setPaymentResult({
        creditsGranted: result.creditsGranted,
        newBalance: result.newBalance,
      });
      setPaymentStep('success');
    } catch (error) {
      console.error('支付失败:', error);
      alert('支付处理失败，请重试');
    } finally {
      setPurchasing(false);
    }
  };

  // 支付确认页面
  if (paymentStep === 'paying' && currentOrder) {
    return (
      <div className="fixed inset-0 z-[9998] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative z-[9999] w-full max-w-md bg-white rounded-2xl shadow-2xl m-4 p-6">
          <h2 className="text-xl font-bold text-center mb-6">确认支付</h2>

          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <div className="flex justify-between mb-2">
              <span className="text-gray-500">套餐</span>
              <span className="font-medium">{currentOrder.planName}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-500">订单号</span>
              <span className="font-mono text-sm">{currentOrder.orderNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">支付金额</span>
              <span className="text-xl font-bold text-orange-500">¥{currentOrder.amountYuan}</span>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-700">
              当前为开发测试模式，点击"确认支付"将模拟支付成功并立即激活会员。
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setPaymentStep('select');
                setCurrentOrder(null);
              }}
              className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={handleConfirmPayment}
              disabled={purchasing}
              className="flex-1 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium disabled:opacity-50"
            >
              {purchasing ? '处理中...' : '确认支付'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 支付成功页面
  if (paymentStep === 'success' && paymentResult) {
    return (
      <div className="fixed inset-0 z-[9998] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <div className="relative z-[9999] w-full max-w-md bg-white rounded-2xl shadow-2xl m-4 p-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h2 className="text-xl font-bold mb-2">支付成功</h2>
          <p className="text-gray-500 mb-6">恭喜您成为会员！</p>

          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 mb-6">
            <div className="text-3xl font-bold text-orange-500 mb-1">
              +{paymentResult.creditsGranted.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500">傻币已到账</div>
            <div className="mt-2 text-sm text-gray-600">
              当前余额：<span className="font-medium text-orange-500">{paymentResult.newBalance.toLocaleString()}</span> 傻币
            </div>
          </div>

          <button
            onClick={onPurchaseSuccess}
            className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium"
          >
            开始创作
          </button>
        </div>
      </div>
    );
  }

  // 套餐选择页面
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-[9999] w-full max-w-5xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl m-4">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            {/* 三傻 Logo */}
            <div className="w-10 h-10 flex items-center justify-center">
              <svg width="40" height="36" viewBox="0 0 24 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* 顶部幽灵 - 紫色 */}
                <g>
                  <path d="M12 0C9 0 7 2 7 4.5V8C7 8 7.4 7.4 8 8C8.6 8.6 9 8 9.5 8C10 8 10.3 8.6 12 8C13.7 8.6 14 8 14.5 8C15 8 15.4 8.6 16 8C16.6 7.4 17 8 17 8V4.5C17 2 15 0 12 0Z" fill="#8B5CF6"/>
                  <circle cx="10" cy="3.5" r="1" fill="white"/>
                  <circle cx="14" cy="4" r="1" fill="white"/>
                  <circle cx="10.3" cy="3.8" r="0.5" fill="#1a1a1a"/>
                  <circle cx="14.3" cy="4.3" r="0.5" fill="#1a1a1a"/>
                  <path d="M9.5 6Q12 7.5 14.5 6" stroke="#1a1a1a" strokeWidth="0.8" strokeLinecap="round"/>
                </g>
                {/* 左下幽灵 - 橙色 斗鸡眼傻笑 */}
                <g>
                  <path d="M6.5 7C3.5 7 1.5 9 1.5 11.5V15C1.5 15 1.9 14.4 2.5 15C3.1 15.6 3.5 15 4 15C4.5 15 4.8 15.6 6.5 15C8.2 15.6 8.5 15 9 15C9.5 15 9.9 15.6 10.5 15C11.1 14.4 11.5 15 11.5 15V11.5C11.5 9 9.5 7 6.5 7Z" fill="#F97316"/>
                  {/* 斗鸡眼 */}
                  <circle cx="5" cy="10.3" r="1.1" fill="white"/>
                  <circle cx="8" cy="10.3" r="1.1" fill="white"/>
                  <circle cx="5.5" cy="10.4" r="0.5" fill="#1a1a1a"/>
                  <circle cx="7.5" cy="10.4" r="0.5" fill="#1a1a1a"/>
                  {/* U形嘴 */}
                  <path d="M4.8 12.2Q6.5 13.8 8.2 12.2" stroke="#1a1a1a" strokeWidth="0.8" strokeLinecap="round" fill="none"/>
                </g>
                {/* 右下幽灵 - 青色 */}
                <g>
                  <path d="M17.5 7C14.5 7 12.5 9 12.5 11.5V15C12.5 15 12.9 14.4 13.5 15C14.1 15.6 14.5 15 15 15C15.5 15 15.8 15.6 17.5 15C19.2 15.6 19.5 15 20 15C20.5 15 20.9 15.6 21.5 15C22.1 14.4 22.5 15 22.5 15V11.5C22.5 9 20.5 7 17.5 7Z" fill="#06B6D4"/>
                  <circle cx="16" cy="10.3" r="1.3" fill="white"/>
                  <circle cx="19" cy="10.3" r="1.3" fill="white"/>
                  <circle cx="16" cy="10.5" r="0.7" fill="#1a1a1a"/>
                  <circle cx="19" cy="10.5" r="0.7" fill="#1a1a1a"/>
                </g>
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">傻币充值</h2>
              <p className="text-sm text-gray-500">选择适合你的套餐</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* 会员状态 */}
            <div className="text-right text-sm text-gray-500">
              {currentMembership ? currentMembership.planName : '未开通会员'}
            </div>
            {/* 傻币余额 */}
            <div className="text-right">
              <div className="text-xs text-gray-500">傻币余额</div>
              <div className="text-xl font-bold text-orange-500">{currentBalance.toLocaleString()} <span className="text-sm">傻币</span></div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 计费周期切换 */}
        <div className="flex justify-center py-4">
          <div className="inline-flex items-center bg-gray-100 rounded-full p-1">
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`relative px-4 py-2 rounded-full text-sm font-medium transition-all ${
                billingCycle === 'yearly'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              单年购买
              <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                billingCycle === 'yearly' ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-600'
              }`}>6.6折</span>
            </button>
            <button
              onClick={() => setBillingCycle('monthly_continuous')}
              className={`relative px-4 py-2 rounded-full text-sm font-medium transition-all ${
                billingCycle === 'monthly_continuous'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              连续包月
              <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                billingCycle === 'monthly_continuous' ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-600'
              }`}>8.3折</span>
            </button>
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              单月购买
            </button>
          </div>
        </div>

        {/* 套餐卡片 */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-6 pb-4">
            {/* 免费套餐 */}
            <div className="border border-gray-200 rounded-2xl p-5">
              <h3 className="text-lg font-bold text-gray-900 mb-3">免费</h3>
              <div className="mb-1">
                <span className="text-sm text-gray-500">¥</span>
                <span className="text-4xl font-bold text-gray-900">0</span>
                <span className="text-gray-400 text-sm">元</span>
                <span className="text-gray-400 text-sm">/月</span>
                <span className="text-gray-400 text-sm ml-1">永久</span>
              </div>
              <div className="h-5 mb-4"></div>

              <button
                disabled
                className="w-full py-2.5 bg-gray-100 text-gray-400 rounded-xl font-medium cursor-not-allowed mb-5"
              >
                免费
              </button>

              <ul className="space-y-2.5 text-sm text-gray-600">
                {FREE_PLAN.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-gray-400">•</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 付费套餐 */}
            {plans.map((plan) => {
              const price = getPrice(plan);
              const originalPrice = getOriginalPrice(plan);
              const priceUnit = getPriceUnit();
              const priceDesc = getPriceDescription(plan);
              const isCurrentPlan = currentMembership?.planId === plan.id;

              // 图标颜色和图标
              const iconConfig: Record<string, { color: string; icon: JSX.Element }> = {
                standard: {
                  color: 'text-blue-500 bg-blue-100',
                  icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" /></svg>,
                },
                advanced: {
                  color: 'text-orange-500 bg-orange-100',
                  icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" /></svg>,
                },
                super: {
                  color: 'text-purple-500 bg-purple-100',
                  icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>,
                },
              };

              const { color, icon } = iconConfig[plan.id] || iconConfig.standard;

              return (
                <div
                  key={plan.id}
                  className="border border-gray-200 rounded-2xl p-5 hover:border-gray-300 transition-colors"
                >
                  {/* 套餐名称 */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${color}`}>
                      {icon}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                  </div>

                  {/* 价格 */}
                  <div className="mb-1">
                    <span className="text-sm text-gray-500">¥</span>
                    <span className="text-4xl font-bold text-gray-900">{formatPrice(price)}</span>
                    <span className="text-gray-400 text-sm">元</span>
                    <span className="text-gray-400 text-sm">{priceUnit}</span>
                    {originalPrice && originalPrice !== price && (
                      <span className="ml-2 text-gray-400 text-sm line-through">
                        ¥{formatPrice(originalPrice)}
                      </span>
                    )}
                  </div>

                  {/* 价格说明 */}
                  <div className="text-xs text-gray-500 h-5 mb-4">
                    {priceDesc}
                  </div>

                  {/* 购买按钮 */}
                  <button
                    onClick={() => handlePurchase(plan.id)}
                    disabled={purchasing || isCurrentPlan}
                    className={`w-full py-2.5 rounded-xl font-medium transition-colors mb-5 ${
                      isCurrentPlan
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-900 hover:bg-gray-800 text-white'
                    } disabled:opacity-50`}
                  >
                    {purchasing ? '处理中...' : isCurrentPlan ? '当前套餐' : '立即订购'}
                  </button>

                  {/* 傻币数量 */}
                  <div className="mb-3">
                    <span className="text-gray-900 font-medium">每月获得 </span>
                    <span className="text-orange-500 font-bold">{plan.monthlyCredits.toLocaleString()}</span>
                    <span className="text-gray-900 font-medium"> 傻币</span>
                  </div>

                  {/* 描述 */}
                  <p className="text-xs text-gray-500 mb-4">
                    ~{plan.monthlyCredits.toLocaleString()}张生成图片，按月重置。
                  </p>

                  {/* 功能列表 */}
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-center gap-2">
                      <span className="text-gray-400">•</span>
                      <span>登录每日领{plan.dailySigninBonus}傻币</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-gray-400">•</span>
                      <span>生图加速</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-gray-400">•</span>
                      <span>会员模型生图，商用无忧</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-gray-400">•</span>
                      <span>多格式导出(SVG、OBJ等)</span>
                    </li>
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        {/* 邀请码兑换 */}
        <div className="px-6 py-4 border-t">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 whitespace-nowrap">邀请码</span>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleRedeemInviteCode()}
              placeholder="输入邀请码获得额外傻币"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400"
              disabled={inviteCodeLoading}
            />
            <button
              onClick={handleRedeemInviteCode}
              disabled={!inviteCode.trim() || inviteCodeLoading}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {inviteCodeLoading ? '兑换中...' : '兑换'}
            </button>
          </div>
          {inviteCodeMessage && (
            <p className={`mt-2 text-sm ${inviteCodeMessage.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
              {inviteCodeMessage.text}
            </p>
          )}
        </div>

        {/* 底部说明 */}
        <div className="px-6 py-4 text-center text-xs text-gray-500 border-t">
          <p>傻币用于 AI 生成消耗，购买即表示同意 <span className="text-gray-700 cursor-pointer hover:underline">服务条款</span> 和 <span className="text-gray-700 cursor-pointer hover:underline">隐私政策</span></p>
        </div>
      </div>
    </div>
  );
}

export default MembershipModal;
