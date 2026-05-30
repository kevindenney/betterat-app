/**
 * Club Subscription Service
 * Handles Stripe subscription management for club accounts
 */

import { supabase } from './supabase';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('ClubSubscriptionService');

export interface SubscriptionPlan {
  id: 'club_free' | 'club_plus' | 'club_pro' | 'starter' | 'professional' | 'enterprise';
  name: string;
  monthlyPrice: number; // in cents
  annualPrice: number; // in cents
  monthlyPriceFormatted: string;
  annualPriceFormatted: string;
  annualSavings: string;
  description: string;
  features: string[];
  popular: boolean;
  stripeMonthlyPriceId?: string;
  stripeAnnualPriceId?: string;
}

/**
 * Club Stripe Price IDs
 * Created: 2026-01-02
 */
export const CLUB_STRIPE_PRICE_IDS = {
  starter: {
    monthly: 'price_1Sl0oHBbfEeOhHXbWRBa81j7',   // $249/month
    annual: 'price_1Sl0oTBbfEeOhHXbAfA0x5gK',    // $2,499/year
  },
  professional: {
    monthly: 'price_1Sl0pABbfEeOhHXbEaubR9jr',  // $499/month
    annual: 'price_1Sl0pMBbfEeOhHXb9reoud5b',   // $4,999/year
  },
  enterprise: {
    monthly: 'price_1Sl0q2BbfEeOhHXb89WAlrJC',  // $899/month
    annual: 'price_1Sl0qRBbfEeOhHXbkVYk7YsW',   // $8,999/year
  },
};

export const CLUB_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'club_free',
    name: 'Free Club Claim',
    monthlyPrice: 0,
    annualPrice: 0,
    monthlyPriceFormatted: '$0',
    annualPriceFormatted: '$0',
    annualSavings: '',
    description: 'Claim and correct an official yacht-club presence',
    features: [
      'Official claimed club page',
      'Logo, website, location, and contact details',
      'One admin',
      'Public event affiliation references',
      'Pinned links',
      'BetterAt official badge after verification',
    ],
    popular: true,
  },
  {
    id: 'club_plus',
    name: 'Club Plus',
    monthlyPrice: 0,
    annualPrice: 19900,
    monthlyPriceFormatted: 'Annual only',
    annualPriceFormatted: '$199',
    annualSavings: '',
    description: 'Lightweight visibility for volunteer-led clubs',
    features: [
      'Three to five admins',
      'Member and sailor invite links',
      'Club posts and news',
      'Sponsor and partner links',
      'Basic analytics',
      'Export interested sailors or followers',
    ],
    popular: false,
  },
  {
    id: 'club_pro',
    name: 'Regatta / Club Pro',
    monthlyPrice: 14900,
    annualPrice: 149900,
    monthlyPriceFormatted: '$149',
    annualPriceFormatted: '$1,499',
    annualSavings: 'Save $289',
    description: 'Operational tools for clubs and class associations running events',
    features: [
      'Multi-event pages',
      'Segmented announcements',
      'Sponsor surfaces',
      'Crew and community tools',
      'Moderation tools',
      'Event analytics',
      'BetterAt setup support',
    ],
    popular: false,
  },
  {
    id: 'starter',
    name: 'Club Starter',
    monthlyPrice: 24900, // $249.00
    annualPrice: 249900, // $2,499.00
    monthlyPriceFormatted: '$249',
    annualPriceFormatted: '$2,499',
    annualSavings: 'Save $489',
    description: 'Up to 500 members',
    features: [
      'Up to 500 members',
      'Basic scoring system',
      'Entry management',
      'Results publication',
      'Email support',
    ],
    popular: false,
    stripeMonthlyPriceId: CLUB_STRIPE_PRICE_IDS.starter.monthly,
    stripeAnnualPriceId: CLUB_STRIPE_PRICE_IDS.starter.annual,
  },
  {
    id: 'professional',
    name: 'Club Pro',
    monthlyPrice: 49900, // $499.00
    annualPrice: 499900, // $4,999.00
    monthlyPriceFormatted: '$499',
    annualPriceFormatted: '$4,999',
    annualSavings: 'Save $989',
    description: 'Up to 2,000 members',
    features: [
      'Up to 2,000 members',
      'Advanced scoring options',
      'Live race tracking',
      'Custom branding',
      'Priority support',
      'Mobile race committee app',
    ],
    popular: true,
    stripeMonthlyPriceId: CLUB_STRIPE_PRICE_IDS.professional.monthly,
    stripeAnnualPriceId: CLUB_STRIPE_PRICE_IDS.professional.annual,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 89900, // $899.00
    annualPrice: 899900, // $8,999.00
    monthlyPriceFormatted: '$899',
    annualPriceFormatted: '$8,999',
    annualSavings: 'Save $1,789',
    description: 'Unlimited members',
    features: [
      'Unlimited members',
      'Multiple venue management',
      'Advanced analytics',
      'API access',
      'Dedicated support',
      'Custom integrations',
    ],
    popular: false,
    stripeMonthlyPriceId: CLUB_STRIPE_PRICE_IDS.enterprise.monthly,
    stripeAnnualPriceId: CLUB_STRIPE_PRICE_IDS.enterprise.annual,
  },
];

export interface CreateSubscriptionParams {
  userId: string;
  planId: SubscriptionPlan['id'];
  billingPeriod: 'monthly' | 'annual';
  paymentMethodId: string; // Stripe payment method ID
  billingDetails?: {
    name: string;
    email: string;
    address?: {
      line1: string;
      city: string;
      postal_code: string;
      country: string;
    };
  };
}

export interface SubscriptionResult {
  success: boolean;
  subscriptionId?: string;
  error?: string;
  clientSecret?: string; // For 3D Secure authentication
}

export class ClubSubscriptionService {
  /**
   * Create a new Stripe subscription for a club
   * Note: This requires a backend API endpoint to interact with Stripe
   */
  static async createSubscription(
    params: CreateSubscriptionParams
  ): Promise<SubscriptionResult> {
    try {
      // Get the plan details
      const plan = CLUB_SUBSCRIPTION_PLANS.find((p) => p.id === params.planId);
      if (!plan) {
        return {
          success: false,
          error: 'Invalid subscription plan',
        };
      }

      // Get or create club profile
      const { data: profile, error: profileError } = await supabase
        .from('club_profiles')
        .select('id')
        .eq('user_id', params.userId)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        throw new Error('Failed to get club profile');
      }

      let clubProfileId = profile?.id;

      // Create profile if it doesn't exist
      if (!clubProfileId) {
        const { data: newProfile, error: createError } = await supabase
          .from('club_profiles')
          .insert({
            user_id: params.userId,
            club_name: 'Temporary', // Will be updated during onboarding
            website_url: 'https://temporary.com', // Will be updated
          })
          .select('id')
          .single();

        if (createError) {
          throw new Error('Failed to create club profile');
        }

        clubProfileId = newProfile.id;
      }

      // In production, this would call your backend API to create the Stripe subscription
      // For now, we'll simulate it with a mock implementation
      // TODO: Implement backend API endpoint for Stripe subscription creation

      /*
      const response = await fetch('/api/subscriptions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: params.userId,
          planId: params.planId,
          paymentMethodId: params.paymentMethodId,
          billingDetails: params.billingDetails,
        }),
      });

      const { subscriptionId, clientSecret, customerId } = await response.json();
      */

      // Mock Stripe subscription ID for development
      const subscriptionId = `sub_mock_${Date.now()}`;
      const customerId = `cus_mock_${Date.now()}`;

      // Determine price and interval based on billing period
      const price = params.billingPeriod === 'annual' ? plan.annualPrice : plan.monthlyPrice;
      const priceId = params.billingPeriod === 'annual'
        ? (plan.stripeAnnualPriceId || `price_mock_${plan.id}_annual`)
        : (plan.stripeMonthlyPriceId || `price_mock_${plan.id}_monthly`);
      const interval = params.billingPeriod === 'annual' ? 'year' : 'month';
      const periodDays = params.billingPeriod === 'annual' ? 365 : 30;

      // Create subscription record in database
      const { error: subError } = await supabase
        .from('club_subscriptions')
        .insert({
          club_profile_id: clubProfileId,
          stripe_subscription_id: subscriptionId,
          stripe_customer_id: customerId,
          stripe_price_id: priceId,
          plan_id: params.planId,
          billing_period: params.billingPeriod,
          status: 'active', // In production, this would be 'trialing' or based on Stripe response
          amount: price,
          currency: 'usd',
          interval,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(
            Date.now() + periodDays * 24 * 60 * 60 * 1000
          ).toISOString(),
        });

      if (subError) {
        logger.error('Error creating subscription record:', subError);
        throw new Error('Failed to save subscription');
      }

      // Update user subscription status
      await supabase
        .from('users')
        .update({
          subscription_status: 'active',
          subscription_tier: params.planId,
        })
        .eq('id', params.userId);

      return {
        success: true,
        subscriptionId,
      };
    } catch (error: any) {
      logger.error('Error creating subscription:', error);
      return {
        success: false,
        error: error.message || 'Failed to create subscription',
      };
    }
  }

  /**
   * Get subscription for a club
   */
  static async getSubscription(userId: string): Promise<any | null> {
    try {
      const { data: profile } = await supabase
        .from('club_profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!profile) {
        return null;
      }

      const { data, error } = await supabase
        .from('club_subscriptions')
        .select('*')
        .eq('club_profile_id', profile.id)
        .single();

      if (error) {
        logger.error('Error fetching subscription:', error);
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Error getting subscription:', error);
      return null;
    }
  }

  /**
   * Cancel a subscription
   */
  static async cancelSubscription(
    userId: string,
    _immediate: boolean = false
  ): Promise<SubscriptionResult> {
    try {
      const subscription = await this.getSubscription(userId);
      if (!subscription) {
        return {
          success: false,
          error: 'No active subscription found',
        };
      }

      // In production, call Stripe API to cancel subscription
      // TODO: Implement backend API endpoint for cancellation

      /*
      await fetch('/api/subscriptions/cancel', {
        method: 'POST',
        body: JSON.stringify({
          subscriptionId: subscription.stripe_subscription_id,
          immediate,
        }),
      });
      */

      // Update subscription in database
      const updateData: any = {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('club_subscriptions')
        .update(updateData)
        .eq('id', subscription.id);

      if (error) {
        throw new Error('Failed to update subscription status');
      }

      return {
        success: true,
      };
    } catch (error: any) {
      logger.error('Error cancelling subscription:', error);
      return {
        success: false,
        error: error.message || 'Failed to cancel subscription',
      };
    }
  }

  /**
   * Update subscription plan
   */
  static async updateSubscription(
    userId: string,
    newPlanId: 'starter' | 'professional' | 'enterprise',
    billingPeriod?: 'monthly' | 'annual'
  ): Promise<SubscriptionResult> {
    try {
      const subscription = await this.getSubscription(userId);
      if (!subscription) {
        return {
          success: false,
          error: 'No active subscription found',
        };
      }

      const plan = CLUB_SUBSCRIPTION_PLANS.find((p) => p.id === newPlanId);
      if (!plan) {
        return {
          success: false,
          error: 'Invalid subscription plan',
        };
      }

      // Use existing billing period if not specified
      const period = billingPeriod || subscription.billing_period || 'annual';
      const price = period === 'annual' ? plan.annualPrice : plan.monthlyPrice;
      const priceId = period === 'annual'
        ? (plan.stripeAnnualPriceId || `price_mock_${plan.id}_annual`)
        : (plan.stripeMonthlyPriceId || `price_mock_${plan.id}_monthly`);

      // In production, call Stripe API to update subscription
      // TODO: Implement backend API endpoint

      // Update subscription in database
      const { error } = await supabase
        .from('club_subscriptions')
        .update({
          plan_id: newPlanId,
          billing_period: period,
          stripe_price_id: priceId,
          amount: price,
          interval: period === 'annual' ? 'year' : 'month',
        })
        .eq('id', subscription.id);

      if (error) {
        throw new Error('Failed to update subscription');
      }

      return {
        success: true,
      };
    } catch (error: any) {
      logger.error('Error updating subscription:', error);
      return {
        success: false,
        error: error.message || 'Failed to update subscription',
      };
    }
  }

  /**
   * Check if user has an active subscription
   */
  static async hasActiveSubscription(userId: string): Promise<boolean> {
    const subscription = await this.getSubscription(userId);
    return subscription?.status === 'active' || subscription?.status === 'trialing';
  }

  /**
   * Get plan details
   */
  static getPlan(planId: string): SubscriptionPlan | undefined {
    return CLUB_SUBSCRIPTION_PLANS.find((p) => p.id === planId);
  }

  /**
   * Get all available plans
   */
  static getAllPlans(): SubscriptionPlan[] {
    return CLUB_SUBSCRIPTION_PLANS;
  }

  // =====================================================
  // Event Registration Fee Tracking
  // =====================================================

  /**
   * Get platform revenue analytics for event registrations
   * Similar to coaching marketplace commission tracking
   */
  static async getEventRevenueAnalytics(clubId: string, startDate: string, endDate: string) {
    try {
      const { data, error } = await supabase
        .from('event_registrations')
        .select(`
          id,
          amount_paid,
          platform_fee,
          club_payout,
          payment_status,
          payment_date,
          event_id,
          club_events!inner(club_id)
        `)
        .eq('club_events.club_id', clubId)
        .eq('payment_status', 'paid')
        .gte('payment_date', startDate)
        .lte('payment_date', endDate);

      if (error) throw error;

      // Calculate analytics
      const totalRevenue = data.reduce((sum, reg) => sum + (reg.amount_paid || 0), 0);
      const totalPlatformFees = data.reduce((sum, reg) => sum + (reg.platform_fee || 0), 0);
      const totalClubPayout = data.reduce((sum, reg) => sum + (reg.club_payout || 0), 0);
      const registrationCount = data.length;

      return {
        totalRevenue,
        totalPlatformFees,
        totalClubPayout,
        registrationCount,
        averageRegistrationValue: registrationCount > 0 ? totalRevenue / registrationCount : 0,
        platformFeeRate: totalRevenue > 0 ? (totalPlatformFees / totalRevenue) * 100 : 0,
      };
    } catch (error) {
      logger.error('Error fetching event revenue analytics:', error);
      throw error;
    }
  }

  /**
   * Get combined revenue analytics (subscriptions + event registrations)
   */
  static async getCombinedRevenueAnalytics(startDate: string, endDate: string) {
    try {
      // Get subscription revenue
      const { data: subscriptions, error: subError } = await supabase
        .from('club_subscriptions')
        .select('*')
        .eq('status', 'active')
        .gte('current_period_start', startDate)
        .lte('current_period_start', endDate);

      if (subError) throw subError;

      const subscriptionRevenue = subscriptions.reduce(
        (sum, sub) => sum + (sub.amount || 0),
        0
      );

      // Get event registration revenue
      const { data: registrations, error: regError } = await supabase
        .from('event_registrations')
        .select('*')
        .eq('payment_status', 'paid')
        .gte('payment_date', startDate)
        .lte('payment_date', endDate);

      if (regError) throw regError;

      const eventRevenue = registrations.reduce(
        (sum, reg) => sum + (reg.amount_paid || 0),
        0
      );
      const eventPlatformFees = registrations.reduce(
        (sum, reg) => sum + (reg.platform_fee || 0),
        0
      );

      return {
        subscriptionRevenue,
        eventRevenue,
        totalRevenue: subscriptionRevenue + eventRevenue,
        eventPlatformFees,
        totalPlatformRevenue: subscriptionRevenue + eventPlatformFees,
        subscriptionCount: subscriptions.length,
        registrationCount: registrations.length,
      };
    } catch (error) {
      logger.error('Error fetching combined revenue analytics:', error);
      throw error;
    }
  }

  /**
   * Get club earnings summary (net revenue after platform fees)
   */
  static async getClubEarningsSummary(clubId: string, period: 'week' | 'month' | 'year') {
    try {
      const now = new Date();
      const startDate = new Date();

      switch (period) {
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      // Get event registration earnings
      const { data, error } = await supabase
        .from('event_registrations')
        .select(`
          amount_paid,
          platform_fee,
          club_payout,
          payment_status,
          club_events!inner(club_id)
        `)
        .eq('club_events.club_id', clubId)
        .eq('payment_status', 'paid')
        .gte('payment_date', startDate.toISOString());

      if (error) throw error;

      const totalEarnings = data.reduce((sum, reg) => sum + (reg.club_payout || 0), 0);
      const totalPlatformFees = data.reduce((sum, reg) => sum + (reg.platform_fee || 0), 0);
      const grossRevenue = data.reduce((sum, reg) => sum + (reg.amount_paid || 0), 0);
      const registrationCount = data.length;

      // Calculate pending payments
      const { data: pending } = await supabase
        .from('event_registrations')
        .select(`
          amount_paid,
          club_events!inner(club_id)
        `)
        .eq('club_events.club_id', clubId)
        .eq('payment_status', 'unpaid');

      const pendingPayments = pending?.reduce(
        (sum, reg) => sum + (reg.amount_paid || 0),
        0
      ) || 0;

      return {
        totalEarnings,
        grossRevenue,
        totalPlatformFees,
        registrationCount,
        averageEarningsPerRegistration:
          registrationCount > 0 ? totalEarnings / registrationCount : 0,
        pendingPayments,
        period,
      };
    } catch (error) {
      logger.error('Error fetching club earnings summary:', error);
      throw error;
    }
  }

  /**
   * Get platform fee summary across all clubs
   * Admin/platform analytics
   */
  static async getPlatformFeeSummary(startDate: string, endDate: string) {
    try {
      // Event registration platform fees
      const { data: eventFees, error: eventError } = await supabase
        .from('event_registrations')
        .select('platform_fee, club_payout, amount_paid')
        .eq('payment_status', 'paid')
        .gte('payment_date', startDate)
        .lte('payment_date', endDate);

      if (eventError) throw eventError;

      const eventPlatformFees = eventFees.reduce(
        (sum, reg) => sum + (reg.platform_fee || 0),
        0
      );
      const eventClubPayouts = eventFees.reduce(
        (sum, reg) => sum + (reg.club_payout || 0),
        0
      );
      const eventGrossRevenue = eventFees.reduce(
        (sum, reg) => sum + (reg.amount_paid || 0),
        0
      );

      // Club subscription revenue (100% platform revenue)
      const { data: subscriptions, error: subError } = await supabase
        .from('club_subscriptions')
        .select('amount')
        .eq('status', 'active')
        .gte('current_period_start', startDate)
        .lte('current_period_start', endDate);

      if (subError) throw subError;

      const subscriptionRevenue = subscriptions.reduce(
        (sum, sub) => sum + (sub.amount || 0),
        0
      );

      return {
        eventPlatformFees,
        eventClubPayouts,
        eventGrossRevenue,
        subscriptionRevenue,
        totalPlatformRevenue: eventPlatformFees + subscriptionRevenue,
        totalClubPayouts: eventClubPayouts,
        eventRegistrationCount: eventFees.length,
        subscriptionCount: subscriptions.length,
      };
    } catch (error) {
      logger.error('Error fetching platform fee summary:', error);
      throw error;
    }
  }
}
