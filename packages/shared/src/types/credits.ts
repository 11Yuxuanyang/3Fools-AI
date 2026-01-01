/**
 * Credits Types
 * Types for credit system (billing, transactions, memberships)
 */

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
  priceMonthly: number;
  priceMonthlyContinuous: number;
  priceYearly: number;
  originalPriceMonthly?: number;
  originalPriceYearly?: number;
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
