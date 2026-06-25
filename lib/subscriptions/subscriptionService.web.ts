/**
 * Subscription Service - Web Version
 * Uses Stripe for web subscriptions
 *
 * Updated: 2026-03-15
 * Pricing: Individual $9/mo ($89/yr) / Pro $29/mo ($290/yr)
 */

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';

export interface SubscriptionProduct {
  id: string;
  title: string;
  description: string;
  price: string;
  priceAmountMicros: number;
  priceCurrencyCode: string;
  features: string[];
  isPopular?: boolean;
  billingPeriod: 'monthly' | 'yearly';
  effectiveMonthly?: string;
}

export interface SubscriptionStatus {
  isActive: boolean;
  productId: string | null;
  tier: 'free' | 'individual' | 'pro';
  expiresAt: Date | null;
  willRenew: boolean;
  platform: 'ios' | 'android' | 'web';
}

export interface PurchaseResult {
  success: boolean;
  productId?: string;
  transactionId?: string;
  error?: string;
  needsRestore?: boolean;
  checkoutUrl?: string;
}

const logger = createLogger('subscriptionService.web');

/**
 * Stripe Price IDs for subscriptions
 * Updated: 2026-03-15
 */
export const STRIPE_PRICE_IDS = {
  // Individual Plan
  individual_monthly: process.env.EXPO_PUBLIC_STRIPE_INDIVIDUAL_MONTHLY_PRICE_ID || 'price_individual_monthly_9',
  individual_yearly: process.env.EXPO_PUBLIC_STRIPE_INDIVIDUAL_YEARLY_PRICE_ID || 'price_individual_yearly_90',

  // Pro Plan
  pro_monthly: process.env.EXPO_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID || 'price_pro_monthly_29',
  pro_yearly: process.env.EXPO_PUBLIC_STRIPE_PRO_YEARLY_PRICE_ID || 'price_pro_yearly_290',
};

export const SUBSCRIPTION_PRODUCTS: Record<string, SubscriptionProduct> = {
  individual_monthly: {
    id: STRIPE_PRICE_IDS.individual_monthly,
    title: 'Individual',
    description: 'AI-powered race preparation',
    price: '$9/month',
    priceAmountMicros: 9000000,
    priceCurrencyCode: 'USD',
    billingPeriod: 'monthly',
    isPopular: true,
    features: [
      'Unlimited races',
      '50,000 AI tokens per month',
      'AI strategy analysis',
      'Automatic weather updates',
      'Historical race data',
      'Offline mode',
      'Advanced analytics',
      'Cloud backup & sync',
    ],
  },
  individual_yearly: {
    id: STRIPE_PRICE_IDS.individual_yearly,
    title: 'Individual',
    description: 'AI-powered race preparation',
    price: '$89/year',
    priceAmountMicros: 89000000,
    priceCurrencyCode: 'USD',
    billingPeriod: 'yearly',
    effectiveMonthly: '$7.42/mo',
    isPopular: true,
    features: [
      'Unlimited races',
      '50,000 AI tokens per month',
      'AI strategy analysis',
      'Automatic weather updates',
      'Historical race data',
      'Offline mode',
      'Advanced analytics',
      'Cloud backup & sync',
    ],
  },
  pro_monthly: {
    id: STRIPE_PRICE_IDS.pro_monthly,
    title: 'Pro',
    description: 'Maximum AI power for serious racers',
    price: '$29/month',
    priceAmountMicros: 29000000,
    priceCurrencyCode: 'USD',
    billingPeriod: 'monthly',
    features: [
      'Everything in Individual',
      '500,000 AI tokens per month',
      'Priority AI processing',
      'Team sharing & collaboration',
      'Team analytics dashboard',
      'Priority support',
    ],
  },
  pro_yearly: {
    id: STRIPE_PRICE_IDS.pro_yearly,
    title: 'Pro',
    description: 'Maximum AI power for serious racers',
    price: '$290/year',
    priceAmountMicros: 290000000,
    priceCurrencyCode: 'USD',
    billingPeriod: 'yearly',
    effectiveMonthly: '$24.17/mo',
    features: [
      'Everything in Individual',
      '500,000 AI tokens per month',
      'Priority AI processing',
      'Team sharing & collaboration',
      'Team analytics dashboard',
      'Priority support',
    ],
  },
};

/**
 * Web Subscription Service
 * Uses Stripe Checkout for web payments
 */
export class SubscriptionService {
  private static instance: SubscriptionService;
  private isInitialized = false;
  private availableProducts: SubscriptionProduct[] = [];
  private currentStatus: SubscriptionStatus | null = null;

  static getInstance(): SubscriptionService {
    if (!SubscriptionService.instance) {
      SubscriptionService.instance = new SubscriptionService();
    }
    return SubscriptionService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    logger.debug('Initializing web subscription service');
    this.availableProducts = Object.values(SUBSCRIPTION_PRODUCTS);
    this.isInitialized = true;
  }

  async getAvailableProducts(): Promise<SubscriptionProduct[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this.availableProducts;
  }

  /**
   * Purchase via Stripe Checkout
   */
  async purchaseProduct(productId: string): Promise<PurchaseResult> {
    try {
      logger.debug('Starting Stripe checkout for product:', productId);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return {
          success: false,
          error: 'Please sign in to subscribe',
        };
      }

      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          priceId: productId,
          userId: user.id,
          successUrl: `${window.location.origin}/subscription/success`,
          cancelUrl: `${window.location.origin}/subscription`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        return {
          success: true,
          checkoutUrl: data.url,
        };
      }

      return {
        success: false,
        error: 'Failed to create checkout session',
      };
    } catch (error) {
      logger.error('Purchase error:', error);
      return {
        success: false,
        error: 'Purchase failed. Please try again.',
      };
    }
  }

  async restorePurchases(): Promise<PurchaseResult> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return {
          success: false,
          error: 'Please sign in first',
        };
      }

      await this.refreshSubscriptionStatus();

      if (this.currentStatus?.isActive) {
        return { success: true };
      }

      return {
        success: false,
        error: 'No active subscription found. Contact support if you believe this is an error.',
      };
    } catch (error) {
      logger.error('Restore error:', error);
      return {
        success: false,
        error: 'Failed to check subscription status',
      };
    }
  }

  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    if (!this.currentStatus) {
      await this.refreshSubscriptionStatus();
    }
    return this.currentStatus!;
  }

  async refreshSubscriptionStatus(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        this.currentStatus = this.getDefaultStatus();
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('subscription_status, subscription_tier')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      // Normalize tier name (handle legacy values)
      let tier: 'free' | 'individual' | 'pro' = 'free';
      const rawTier = data.subscription_tier?.toLowerCase();
      if (rawTier === 'individual' || rawTier === 'basic') {
        tier = 'individual';
      } else if (rawTier === 'pro' || rawTier === 'team' || rawTier === 'championship') {
        tier = 'pro';
      }

      this.currentStatus = {
        isActive: data.subscription_status === 'active',
        productId: data.subscription_tier || null,
        tier,
        expiresAt: null,
        willRenew: data.subscription_status === 'active',
        platform: 'web',
      };
    } catch (error) {
      logger.error('Failed to refresh subscription status:', error);
      this.currentStatus = this.getDefaultStatus();
    }
  }

  private getDefaultStatus(): SubscriptionStatus {
    return {
      isActive: false,
      productId: null,
      tier: 'free',
      expiresAt: null,
      willRenew: false,
      platform: 'web',
    };
  }

  async cancelSubscription(): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase.functions.invoke('create-portal-session', {
        body: {
          userId: user.id,
          returnUrl: `${window.location.origin}/subscription`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to open customer portal:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.isInitialized = false;
    this.currentStatus = null;
  }
}

export const subscriptionService = SubscriptionService.getInstance();
export default subscriptionService;
