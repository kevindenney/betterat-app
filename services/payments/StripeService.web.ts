/**
 * Stripe Payment Service for BetterAt (Web)
 * Handles subscriptions, payment methods, and billing for web platform
 *
 * Updated: 2026-03-30
 * Pricing: Plus $9/mo ($89/yr), Pro $29/mo ($249/yr)
 */

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  priceId: string;
  billingPeriod: 'monthly' | 'yearly';
  features: string[];
  popular?: boolean;
}

export interface SubscriptionStatus {
  active: boolean;
  plan?: SubscriptionPlan;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
}

const logger = createLogger('StripeService.web');

export class StripeService {
  private readonly apiUrl = process.env.EXPO_PUBLIC_BASE_URL || 'http://localhost:3000';

  // Subscription Plans - Updated 2026-03-30
  readonly plans: SubscriptionPlan[] = [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      priceId: '',
      billingPeriod: 'monthly',
      features: [
        'Up to 3 learning interests',
        'Basic timeline management',
        '5 AI queries per month',
      ],
    },
    {
      id: 'plus_monthly',
      name: 'Plus',
      price: 9,
      priceId: process.env.EXPO_PUBLIC_STRIPE_PLUS_MONTHLY_PRICE_ID || 'price_plus_monthly',
      billingPeriod: 'monthly',
      features: [
        'Unlimited interests & steps',
        '50,000 AI tokens per month',
        'AI coaching & suggestions',
        'Telegram assistant',
        'Progress analytics',
        'Offline mode',
      ],
      popular: true,
    },
    {
      id: 'plus_yearly',
      name: 'Plus',
      price: 89,
      priceId: process.env.EXPO_PUBLIC_STRIPE_PLUS_YEARLY_PRICE_ID || 'price_plus_yearly',
      billingPeriod: 'yearly',
      features: [
        'Unlimited interests & steps',
        '50,000 AI tokens per month',
        'AI coaching & suggestions',
        'Telegram assistant',
        'Progress analytics',
        'Offline mode',
      ],
      popular: true,
    },
    {
      id: 'pro_monthly',
      name: 'Pro',
      price: 29,
      priceId: process.env.EXPO_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID || 'price_pro_monthly',
      billingPeriod: 'monthly',
      features: [
        'Everything in Plus',
        '500,000 AI tokens per month',
        'Priority AI processing',
        'MCP integrations',
        'Priority support',
      ],
    },
    {
      id: 'pro_yearly',
      name: 'Pro',
      price: 249,
      priceId: process.env.EXPO_PUBLIC_STRIPE_PRO_YEARLY_PRICE_ID || 'price_pro_yearly',
      billingPeriod: 'yearly',
      features: [
        'Everything in Plus',
        '500,000 AI tokens per month',
        'Priority AI processing',
        'MCP integrations',
        'Priority support',
      ],
    },
  ];

  /**
   * Create a checkout session for subscription
   */
  async createCheckoutSession(
    userId: string,
    priceId: string,
    successUrl?: string,
    cancelUrl?: string
  ): Promise<{ url: string } | { error: string }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { error: 'Not authenticated' };
      }

      const response = await fetch(`${this.apiUrl}/api/stripe/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          priceId,
          userId,
          successUrl: successUrl || `${window.location.origin}/subscription/success`,
          cancelUrl: cancelUrl || `${window.location.origin}/subscription/cancel`
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      return { url: data.url };

    } catch (error: unknown) {
      logger.error('Checkout session error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { error: message };
    }
  }

  /**
   * Create a customer portal session for billing management
   */
  async createPortalSession(userId: string): Promise<{ url: string } | { error: string }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { error: 'Not authenticated' };
      }

      const response = await fetch(`${this.apiUrl}/api/stripe/create-portal-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          userId,
          returnUrl: `${window.location.origin}/profile`
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create portal session');
      }

      return { url: data.url };

    } catch (error: unknown) {
      logger.error('Portal session error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { error: message };
    }
  }

  /**
   * Get user's subscription status
   */
  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return { active: false };
      }

      const plan = this.plans.find(p => p.priceId === data.price_id);

      return {
        active: data.status === 'active',
        plan,
        currentPeriodEnd: new Date(data.current_period_end),
        cancelAtPeriodEnd: data.cancel_at_period_end
      };

    } catch (error: unknown) {
      logger.error('Failed to get subscription status:', error);
      return { active: false };
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await fetch(`${this.apiUrl}/api/stripe/cancel-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ userId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel subscription');
      }

      return { success: true };

    } catch (error: unknown) {
      logger.error('Cancel subscription error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Resume cancelled subscription
   */
  async resumeSubscription(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await fetch(`${this.apiUrl}/api/stripe/resume-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ userId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resume subscription');
      }

      return { success: true };

    } catch (error: unknown) {
      logger.error('Resume subscription error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Check feature access based on subscription
   */
  async checkFeatureAccess(userId: string, feature: string): Promise<boolean> {
    const status = await this.getSubscriptionStatus(userId);

    if (!status.active) {
      const freeTierFeatures = ['basic_tracking', 'weather', 'limited_documents'];
      return freeTierFeatures.includes(feature);
    }

    const featureMap: Record<string, string[]> = {
      plus_monthly: [
        'unlimited_documents',
        'ai_analysis',
        'advanced_analytics',
        'multi_venue',
        'performance_insights'
      ],
      plus_yearly: [
        'unlimited_documents',
        'ai_analysis',
        'advanced_analytics',
        'multi_venue',
        'performance_insights'
      ],
      pro_monthly: [
        'unlimited_documents',
        'ai_analysis',
        'advanced_analytics',
        'multi_venue',
        'performance_insights',
        'team_collaboration',
        'coach_integration',
        'api_access'
      ],
      pro_yearly: [
        'unlimited_documents',
        'ai_analysis',
        'advanced_analytics',
        'multi_venue',
        'performance_insights',
        'team_collaboration',
        'coach_integration',
        'api_access'
      ],
    };

    const planFeatures = featureMap[status.plan?.id || ''] || [];
    return planFeatures.includes(feature);
  }

  /**
   * Initialize Stripe for web - Stripe.js loaded via script tag
   */
  async initializeStripe(): Promise<void> {
    logger.debug('Stripe: Web platform - Stripe.js loaded via script tag');
    return;
  }

  /**
   * Process payment for one-time purchases (Web)
   */
  async processPayment(
    amount: number,
    currency: string = 'usd',
    description: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await fetch(`${this.apiUrl}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          amount,
          currency,
          description
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment intent');
      }

      if (data.paymentUrl && typeof window !== 'undefined') {
        window.location.href = data.paymentUrl;
      }

      return { success: true };

    } catch (error: unknown) {
      logger.error('Payment error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }
}

export const stripeService = new StripeService();
