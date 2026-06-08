/**
 * Create Org Checkout Session Edge Function
 * Creates a Stripe Checkout session for organization (club) subscriptions.
 *
 * Flat Club tiers (web-only; Apple/Google IAP rejects B2B/org billing):
 * - starter:      $249/mo · $2,499/yr  (members get Pro)
 * - professional: $499/mo · $4,999/yr  (members get Pro)
 * - enterprise:   $899/mo · $8,999/yr  (members get Pro)
 *
 * Price IDs are allowlisted here (mirror lib/subscriptions/orgTiers.ts) so a
 * caller can't check out an arbitrary price.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type OrgPlanId = 'starter' | 'professional' | 'enterprise';
type BillingPeriod = 'monthly' | 'annual';

// Flat Club tier price IDs -> { monthly, annual }. Members of any paid tier
// get the Pro member tier (set in subscription metadata, applied by webhook).
const ORG_PLAN_PRICES: Record<OrgPlanId, { monthly: string; annual: string }> = {
  starter: {
    monthly: 'price_1Sl0oHBbfEeOhHXbWRBa81j7', // $249/mo
    annual: 'price_1Sl0oTBbfEeOhHXbAfA0x5gK', // $2,499/yr
  },
  professional: {
    monthly: 'price_1Sl0pABbfEeOhHXbEaubR9jr', // $499/mo
    annual: 'price_1Sl0pMBbfEeOhHXb9reoud5b', // $4,999/yr
  },
  enterprise: {
    monthly: 'price_1Sl0q2BbfEeOhHXb89WAlrJC', // $899/mo
    annual: 'price_1Sl0qRBbfEeOhHXbkVYk7YsW', // $8,999/yr
  },
};

const MEMBER_TIER = 'pro';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrgCheckoutRequest {
  organizationId: string;
  planId: OrgPlanId;
  billingPeriod: BillingPeriod;
  successUrl: string;
  cancelUrl: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { organizationId, planId, billingPeriod, successUrl, cancelUrl }: OrgCheckoutRequest =
      await req.json();

    if (!organizationId || !planId || !billingPeriod) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: organizationId, planId, billingPeriod' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const planPrices = ORG_PLAN_PRICES[planId];
    if (!planPrices) {
      return new Response(
        JSON.stringify({ error: `Invalid plan: ${planId}. Not an allowed org plan.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const priceId = billingPeriod === 'annual' ? planPrices.annual : planPrices.monthly;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get org info
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, stripe_customer_id')
      .eq('id', organizationId)
      .single();

    if (!org) {
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get admin user email for the Stripe customer
    const { data: adminMembership } = await supabase
      .from('organization_memberships')
      .select('user_id')
      .eq('organization_id', organizationId)
      .in('role', ['owner', 'admin'])
      .in('status', ['active', 'verified'])
      .limit(1)
      .single();

    let adminEmail = '';
    if (adminMembership) {
      const { data: adminUser } = await supabase
        .from('users')
        .select('email')
        .eq('id', adminMembership.user_id)
        .single();
      adminEmail = adminUser?.email || '';
    }

    // Get or create the Stripe customer for the org
    let customerId = org.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: adminEmail,
        name: org.name,
        metadata: {
          organization_id: organizationId,
          type: 'organization',
        },
      });
      customerId = customer.id;

      await supabase
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', organizationId);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${successUrl}${successUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      subscription_data: {
        metadata: {
          organization_id: organizationId,
          plan_id: planId,
          member_tier: MEMBER_TIER,
          billing_period: billingPeriod,
        },
      },
      metadata: {
        organization_id: organizationId,
        plan_id: planId,
        member_tier: MEMBER_TIER,
        billing_period: billingPeriod,
        type: 'org_subscription',
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
    });

    // Create/refresh a pending subscription record. Activated by the webhook
    // on checkout.session.completed.
    await supabase.from('organization_subscriptions').upsert(
      {
        organization_id: organizationId,
        stripe_customer_id: customerId,
        stripe_price_id: priceId,
        plan_id: planId,
        status: 'trialing',
        member_tier: MEMBER_TIER,
        billing_period: billingPeriod,
        currency: 'usd',
      },
      { onConflict: 'organization_id' }
    );

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Org checkout session error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create checkout session', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
