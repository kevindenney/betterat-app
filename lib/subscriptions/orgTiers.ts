/**
 * Organization (Club / Institutional) Tier Definitions
 *
 * Updated: 2026-06-21 — flat Organization tiers:
 * - Starter:      $99/mo   · $999/yr    (up to 500 members)
 * - Professional: $249/mo  · $2,499/yr  (up to 2,000 members)
 * - Enterprise:   $599/mo  · $5,999/yr  (unlimited)
 *
 * All paid Club tiers grant members the Pro tier. Org subscriptions are
 * web-only (Stripe Checkout); Apple/Google IAP rejects B2B/org billing.
 *
 * The Stripe price IDs here are the source of truth for the client; the
 * create-org-checkout-session edge function keeps its own allowlisted copy
 * (Deno can't import app code).
 */

import type { SailorTier } from './sailorTiers';

export type OrgPlanId = 'starter' | 'professional' | 'enterprise';
export type OrgBillingPeriod = 'monthly' | 'annual';

export interface OrgPlanDefinition {
  id: OrgPlanId;
  name: string;
  description: string;
  price: string;
  priceDetail: string;
  monthlyPrice: number; // cents
  annualPrice: number; // cents
  monthlyPriceFormatted: string;
  annualPriceFormatted: string;
  annualSavings: string;
  memberTier: SailorTier;
  features: string[];
  cta: string;
  ctaAction: 'checkout' | 'contact';
  isPopular?: boolean;
  accentColor: string;
  iconName: string;
  stripeMonthlyPriceId: string;
  stripeAnnualPriceId: string;
}

/**
 * Stripe price IDs. The client reads public build env vars, while
 * supabase/functions/create-org-checkout-session keeps its own server-side
 * allowlist from Supabase secrets.
 */
export const ORG_STRIPE_PRICE_IDS: Record<OrgPlanId, { monthly: string; annual: string }> = {
  starter: {
    monthly: process.env.EXPO_PUBLIC_STRIPE_ORG_STARTER_MONTHLY_PRICE_ID || '',
    annual: process.env.EXPO_PUBLIC_STRIPE_ORG_STARTER_ANNUAL_PRICE_ID || '',
  },
  professional: {
    monthly: process.env.EXPO_PUBLIC_STRIPE_ORG_PROFESSIONAL_MONTHLY_PRICE_ID || '',
    annual: process.env.EXPO_PUBLIC_STRIPE_ORG_PROFESSIONAL_ANNUAL_PRICE_ID || '',
  },
  enterprise: {
    monthly: process.env.EXPO_PUBLIC_STRIPE_ORG_ENTERPRISE_MONTHLY_PRICE_ID || '',
    annual: process.env.EXPO_PUBLIC_STRIPE_ORG_ENTERPRISE_ANNUAL_PRICE_ID || '',
  },
};

export const ORG_PLANS: Record<OrgPlanId, OrgPlanDefinition> = {
  starter: {
    id: 'starter',
    name: 'Organization Starter',
    description: 'Up to 500 members',
    price: '$99',
    priceDetail: '/month · or $999/year',
    monthlyPrice: 9900,
    annualPrice: 99900,
    monthlyPriceFormatted: '$99',
    annualPriceFormatted: '$999',
    annualSavings: 'Save $189',
    memberTier: 'pro',
    features: [
      'Up to 500 members',
      'Members get Pro tier access',
      'Centralized billing',
      'Member management dashboard',
      'Entry management & results',
      'Email support',
    ],
    cta: 'Get Started',
    ctaAction: 'checkout',
    accentColor: '#2563EB',
    iconName: 'boat-outline',
    stripeMonthlyPriceId: ORG_STRIPE_PRICE_IDS.starter.monthly,
    stripeAnnualPriceId: ORG_STRIPE_PRICE_IDS.starter.annual,
  },
  professional: {
    id: 'professional',
    name: 'Organization Pro',
    description: 'Up to 2,000 members',
    price: '$249',
    priceDetail: '/month · or $2,499/year',
    monthlyPrice: 24900,
    annualPrice: 249900,
    monthlyPriceFormatted: '$249',
    annualPriceFormatted: '$2,499',
    annualSavings: 'Save $489',
    memberTier: 'pro',
    features: [
      'Up to 2,000 members',
      'Members get Pro tier access',
      'Advanced scoring & live tracking',
      'Custom branding',
      'Member management dashboard',
      'Priority support',
    ],
    cta: 'Get Started',
    ctaAction: 'checkout',
    isPopular: true,
    accentColor: '#7C3AED',
    iconName: 'trophy-outline',
    stripeMonthlyPriceId: ORG_STRIPE_PRICE_IDS.professional.monthly,
    stripeAnnualPriceId: ORG_STRIPE_PRICE_IDS.professional.annual,
  },
  enterprise: {
    id: 'enterprise',
    name: 'Organization Enterprise',
    description: 'Unlimited members',
    price: '$599',
    priceDetail: '/month · or $5,999/year',
    monthlyPrice: 59900,
    annualPrice: 599900,
    monthlyPriceFormatted: '$599',
    annualPriceFormatted: '$5,999',
    annualSavings: 'Save $1,189',
    memberTier: 'pro',
    features: [
      'Unlimited members',
      'Members get Pro tier access',
      'Multiple venue management',
      'Advanced analytics',
      'API access',
      'Dedicated support',
    ],
    cta: 'Get Started',
    ctaAction: 'checkout',
    accentColor: '#059669',
    iconName: 'globe-outline',
    stripeMonthlyPriceId: ORG_STRIPE_PRICE_IDS.enterprise.monthly,
    stripeAnnualPriceId: ORG_STRIPE_PRICE_IDS.enterprise.annual,
  },
};

export const ORG_PLAN_LIST: OrgPlanDefinition[] = [
  ORG_PLANS.starter,
  ORG_PLANS.professional,
  ORG_PLANS.enterprise,
];

/**
 * Get the SailorTier that members of an org plan receive
 */
export function getOrgMemberTier(planId: OrgPlanId): SailorTier {
  return ORG_PLANS[planId]?.memberTier ?? 'pro';
}

/**
 * Annual or monthly cost for a flat org plan, in cents.
 */
export function calculateOrgPlanCost(
  planId: OrgPlanId,
  billingPeriod: OrgBillingPeriod = 'annual'
): number | null {
  const plan = ORG_PLANS[planId];
  if (!plan) return null;
  return billingPeriod === 'annual' ? plan.annualPrice : plan.monthlyPrice;
}

/**
 * Resolve the Stripe price ID for a plan + billing period.
 */
export function getOrgStripePriceId(
  planId: OrgPlanId,
  billingPeriod: OrgBillingPeriod
): string | null {
  const ids = ORG_STRIPE_PRICE_IDS[planId];
  if (!ids) return null;
  return billingPeriod === 'annual' ? ids.annual : ids.monthly;
}
