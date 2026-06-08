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

export class ClubSubscriptionService {
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
