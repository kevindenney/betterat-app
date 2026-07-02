/**
 * Stripe Payment Service for BetterAt
 * Handles subscriptions, payment methods, and billing
 */

import { Platform } from 'react-native';
import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  priceId: string;
  features: string[];
  popular?: boolean;
}

export interface SubscriptionStatus {
  active: boolean;
  plan?: SubscriptionPlan;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
}

const logger = createLogger('StripeService.native');
export class StripeService {
  private readonly apiUrl = process.env.EXPO_PUBLIC_BASE_URL || 'http://localhost:3000';

  // Subscription Plans
  readonly plans: SubscriptionPlan[] = [
    {
      id: 'basic',
      name: 'Basic',
      price: 0,
      priceId: '',
      features: [
        'Basic race tracking',
        '3 document uploads/month',
        'Weather forecasts',
        'Basic analytics'
      ]
    },
    {
      id: 'professional',
      name: 'Professional',
      price: 29,
      priceId: process.env.EXPO_PUBLIC_STRIPE_PRO_PRICE_ID || '',
      features: [
        'Unlimited race tracking',
        'Unlimited document uploads',
        'AI strategy analysis',
        'Advanced analytics',
        'Multi-venue support',
        'Performance insights',
        'Priority support'
      ],
      popular: true
    },
    {
      id: 'team',
      name: 'Team',
      price: 49,
      priceId: process.env.EXPO_PUBLIC_STRIPE_TEAM_PRICE_ID || '',
      features: [
        'Everything in Professional',
        'Team collaboration',
        'Coach integration',
        'Custom training plans',
        'Team analytics',
        'API access',
        'Dedicated support'
      ]
    }
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

    } catch (error: any) {
      logger.error('Checkout session error:', error);
      return { error: error.message };
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

    } catch (error: any) {
      logger.error('Portal session error:', error);
      return { error: error.message };
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

    } catch (error: any) {
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

    } catch (error: any) {
      logger.error('Cancel subscription error:', error);
      return { success: false, error: error.message };
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

    } catch (error: any) {
      logger.error('Resume subscription error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check feature access based on subscription
   */
  async checkFeatureAccess(userId: string, feature: string): Promise<boolean> {
    const status = await this.getSubscriptionStatus(userId);

    if (!status.active) {
      // Check free tier features
      const freeTierFeatures = ['basic_tracking', 'weather', 'limited_documents'];
      return freeTierFeatures.includes(feature);
    }

    // Define feature access by plan
    const featureMap: Record<string, string[]> = {
      professional: [
        'unlimited_documents',
        'ai_analysis',
        'advanced_analytics',
        'multi_venue',
        'performance_insights'
      ],
      team: [
        'unlimited_documents',
        'ai_analysis',
        'advanced_analytics',
        'multi_venue',
        'performance_insights',
        'team_collaboration',
        'coach_integration',
        'api_access'
      ]
    };

    const planFeatures = featureMap[status.plan?.id || ''] || [];
    return planFeatures.includes(feature);
  }

  /**
   * Initialize Stripe for mobile platforms
   */
  async initializeStripe(): Promise<void> {
    if (Platform.OS === 'web') {
      // Stripe.js is loaded via script tag for web
      logger.debug('Stripe: Web platform detected, skipping mobile initialization');
      return;
    }

    try {
      // Only import Stripe React Native on mobile platforms
      if (Platform.OS !== 'web') {
        const { initStripe } = await import('@stripe/stripe-react-native');

        await initStripe({
          publishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
          merchantIdentifier: 'merchant.com.regattaflow',
          urlScheme: 'regattaflow'
        });

        logger.debug('Stripe initialized for mobile');
      }
    } catch (error) {
      logger.error('Failed to initialize Stripe:', error);
    }
  }

  /**
   * Process payment for one-time purchases
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

      // On web, handle with Stripe.js
      // On mobile, handle with Stripe React Native SDK
      if (Platform.OS === 'web') {
        // Redirect to payment page or handle inline
        if (typeof window !== 'undefined') {
          window.location.href = data.paymentUrl;
        }
      } else {
        try {
          // Use Stripe SDK for mobile payment sheet
          const { presentPaymentSheet } = await import('@stripe/stripe-react-native');
          const { error } = await presentPaymentSheet();

          if (error) {
            throw error;
          }
        } catch (importError) {
          logger.error('Failed to import Stripe React Native:', importError);
          throw new Error('Payment not available on this platform');
        }
      }

      return { success: true };

    } catch (error: any) {
      logger.error('Payment error:', error);
      return { success: false, error: error.message };
    }
  }
}

export const stripeService = new StripeService();
