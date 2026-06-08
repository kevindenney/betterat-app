/**
 * Organization Subscription Service
 * Handles institutional subscription management for org-level billing
 */

import { supabase } from './supabase';
import { createLogger } from '@/lib/utils/logger';
import { ORG_PLANS, ORG_PLAN_LIST, type OrgPlanId, type OrgPlanDefinition, type OrgBillingPeriod } from '@/lib/subscriptions/orgTiers';
import type { SailorTier } from '@/lib/subscriptions/sailorTiers';

const logger = createLogger('OrgSubscriptionService');

export interface OrgSubscription {
  id: string;
  organization_id: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  stripe_price_id: string | null;
  plan_id: OrgPlanId;
  status: 'active' | 'trialing' | 'past_due' | 'cancelled' | 'expired';
  seat_count: number;
  member_tier: string;
  billing_period: string;
  amount: number | null;
  currency: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrgSubscriptionResult {
  success: boolean;
  checkoutUrl?: string;
  error?: string;
}

export class OrgSubscriptionService {
  /**
   * Get the subscription for an organization
   */
  static async getSubscription(orgId: string): Promise<OrgSubscription | null> {
    try {
      const { data, error } = await supabase
        .from('organization_subscriptions')
        .select('*')
        .eq('organization_id', orgId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        logger.error('Error fetching org subscription:', error);
        return null;
      }

      return data as OrgSubscription;
    } catch (error) {
      logger.error('Error getting org subscription:', error);
      return null;
    }
  }

  /**
   * Create a checkout session for an org subscription via edge function.
   * Flat Club tiers, web-only Stripe Checkout — returns a hosted checkout URL.
   */
  static async createSubscription(
    orgId: string,
    planId: OrgPlanId,
    billingPeriod: OrgBillingPeriod = 'annual'
  ): Promise<OrgSubscriptionResult> {
    try {
      const plan = ORG_PLANS[planId];
      if (!plan) {
        return { success: false, error: 'Invalid plan' };
      }

      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const { data, error } = await supabase.functions.invoke('create-org-checkout-session', {
        body: {
          organizationId: orgId,
          planId,
          billingPeriod,
          successUrl: `${origin}/organization/billing?success=true`,
          cancelUrl: `${origin}/organization/billing`,
        },
      });

      if (error) {
        logger.error('Error creating org checkout session:', error);
        return { success: false, error: 'Failed to create checkout session' };
      }

      return {
        success: true,
        checkoutUrl: data?.url,
      };
    } catch (error: any) {
      logger.error('Error creating org subscription:', error);
      return { success: false, error: error.message || 'Failed to create subscription' };
    }
  }

  /**
   * Cancel an organization subscription
   */
  static async cancelSubscription(orgId: string): Promise<OrgSubscriptionResult> {
    try {
      const subscription = await this.getSubscription(orgId);
      if (!subscription) {
        return { success: false, error: 'No active subscription found' };
      }

      // In production, call Stripe API to cancel
      const { error } = await supabase
        .from('organization_subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      if (error) {
        throw new Error('Failed to update subscription status');
      }

      return { success: true };
    } catch (error: any) {
      logger.error('Error cancelling org subscription:', error);
      return { success: false, error: error.message || 'Failed to cancel subscription' };
    }
  }

  /**
   * Get available seats (seat_count - active members)
   */
  static async getAvailableSeats(orgId: string): Promise<{ total: number; used: number; available: number } | null> {
    try {
      const subscription = await this.getSubscription(orgId);
      if (!subscription) return null;

      const { count, error } = await supabase
        .from('organization_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .in('status', ['active', 'verified']);

      if (error) {
        logger.error('Error counting members:', error);
        return null;
      }

      const used = count || 0;
      return {
        total: subscription.seat_count,
        used,
        available: Math.max(0, subscription.seat_count - used),
      };
    } catch (error) {
      logger.error('Error getting available seats:', error);
      return null;
    }
  }

  /**
   * Get the tier that members of this org receive
   */
  static async getMemberTier(orgId: string): Promise<SailorTier | null> {
    const subscription = await this.getSubscription(orgId);
    if (!subscription || subscription.status !== 'active') return null;
    return subscription.member_tier as SailorTier;
  }

  /**
   * Check if org has an active subscription
   */
  static async hasActiveSubscription(orgId: string): Promise<boolean> {
    const subscription = await this.getSubscription(orgId);
    return subscription?.status === 'active' || subscription?.status === 'trialing';
  }

  /**
   * Get all available plans
   */
  static getAllPlans(): OrgPlanDefinition[] {
    return ORG_PLAN_LIST;
  }

  /**
   * Get a specific plan
   */
  static getPlan(planId: OrgPlanId): OrgPlanDefinition | undefined {
    return ORG_PLANS[planId];
  }
}
