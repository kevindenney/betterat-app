/**
 * Create Stripe Checkout Session Edge Function
 * Creates a Stripe checkout session for club subscriptions
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || '';
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

const IS_LIVE_MODE = STRIPE_SECRET_KEY.startsWith('sk_live_');

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type ConsumerTier = 'individual' | 'pro';

interface ConsumerPriceConfig {
  label: string;
  tier: ConsumerTier;
  interval: 'monthly' | 'yearly';
  testPriceIds: string[];
  envNames: string[];
}

function firstEnvValue(names: string[]): string {
  for (const name of names) {
    const value = Deno.env.get(name)?.trim();
    if (value && /^price_[A-Za-z0-9]+$/.test(value)) return value;
  }
  return '';
}

// Allowed consumer subscription price IDs -> tier. The client sends a concrete
// Stripe price ID (see subscriptionService.web.ts); we allowlist it so a caller
// can't check out an arbitrary price, and tag the subscription with its tier.
//
// In live mode, price IDs must come from Supabase secrets/env vars so
// production Stripe can be configured without shipping a code change. The
// EXPO_PUBLIC_* aliases keep the edge function aligned with the web bundle's
// existing env names; the STRIPE_* aliases are preferred for server-side use.
const CONSUMER_PRICE_CONFIGS: ConsumerPriceConfig[] = [
  {
    label: 'individual monthly',
    tier: 'individual',
    interval: 'monthly',
    testPriceIds: ['price_1Tft79BbfEeOhHXbC6kMnpSI'], // $9/mo
    envNames: [
      'STRIPE_INDIVIDUAL_MONTHLY_PRICE_ID',
      'STRIPE_PLUS_MONTHLY_PRICE_ID',
      'EXPO_PUBLIC_STRIPE_INDIVIDUAL_MONTHLY_PRICE_ID',
      'EXPO_PUBLIC_STRIPE_PLUS_MONTHLY_PRICE_ID',
    ],
  },
  {
    label: 'individual yearly',
    tier: 'individual',
    interval: 'yearly',
    testPriceIds: [
      'price_1TjCcsBbfEeOhHXbSwJroOny', // $89/yr current
      'price_1Tft7ABbfEeOhHXbeIzYLCce', // $90/yr legacy
    ],
    envNames: [
      'STRIPE_INDIVIDUAL_YEARLY_PRICE_ID',
      'STRIPE_INDIVIDUAL_ANNUAL_PRICE_ID',
      'STRIPE_PLUS_YEARLY_PRICE_ID',
      'STRIPE_PLUS_ANNUAL_PRICE_ID',
      'EXPO_PUBLIC_STRIPE_INDIVIDUAL_YEARLY_PRICE_ID',
      'EXPO_PUBLIC_STRIPE_INDIVIDUAL_ANNUAL_PRICE_ID',
      'EXPO_PUBLIC_STRIPE_PLUS_YEARLY_PRICE_ID',
      'EXPO_PUBLIC_STRIPE_PLUS_ANNUAL_PRICE_ID',
    ],
  },
  {
    label: 'pro monthly',
    tier: 'pro',
    interval: 'monthly',
    testPriceIds: ['price_1Tft7BBbfEeOhHXbdaVhs9Js'], // $29/mo
    envNames: [
      'STRIPE_PRO_MONTHLY_PRICE_ID',
      'EXPO_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID',
    ],
  },
  {
    label: 'pro yearly',
    tier: 'pro',
    interval: 'yearly',
    testPriceIds: ['price_1Tft7CBbfEeOhHXb0tr4xNnO'], // $290/yr
    envNames: [
      'STRIPE_PRO_YEARLY_PRICE_ID',
      'STRIPE_PRO_ANNUAL_PRICE_ID',
      'EXPO_PUBLIC_STRIPE_PRO_YEARLY_PRICE_ID',
      'EXPO_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID',
    ],
  },
];

const PRICE_TIERS: Record<string, ConsumerTier> = {};
for (const config of CONSUMER_PRICE_CONFIGS) {
  const configuredPriceId = firstEnvValue(config.envNames);
  const priceIds = IS_LIVE_MODE
    ? [configuredPriceId]
    : [configuredPriceId, ...config.testPriceIds];

  for (const priceId of priceIds) {
    if (priceId) PRICE_TIERS[priceId] = config.tier;
  }
}

const missingLivePriceLabels = IS_LIVE_MODE
  ? CONSUMER_PRICE_CONFIGS
      .filter((config) => !firstEnvValue(config.envNames))
      .map((config) => config.label)
  : [];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckoutRequest {
  priceId?: string;
  tier?: ConsumerTier;
  plan?: ConsumerTier | 'plus';
  billingPeriod?: 'monthly' | 'yearly' | 'annual';
  userId: string;
  successUrl: string;
  cancelUrl: string;
}

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(
    JSON.stringify(body),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function requireUserSelf(
  req: Request,
  supabase: SupabaseClient,
  userId: string
): Promise<Response | null> {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return jsonResponse({ error: 'Missing authorization header' }, 401);
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  if (user.id !== userId) {
    return jsonResponse({ error: 'Forbidden' }, 403);
  }

  return null;
}

async function ensureStripeCustomer(params: {
  userId: string;
  email: string | null;
  stripeCustomerId: string | null;
}): Promise<string> {
  const { userId, email, stripeCustomerId } = params;
  const existingCustomerId = stripeCustomerId?.trim() || '';

  if (existingCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(existingCustomerId);
      if (!('deleted' in customer && customer.deleted)) {
        return customer.id;
      }
      console.warn('Stored Stripe customer was deleted; recreating', {
        userId,
        stripeCustomerId: existingCustomerId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('Stored Stripe customer was invalid; recreating', {
        userId,
        stripeCustomerId: existingCustomerId,
        message,
      });
    }
  }

  const customer = await stripe.customers.create({
    email: email || undefined,
    metadata: { user_id: userId },
  });

  const updateResponse = await fetch(
    `${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: supabaseServiceKey,
        Authorization: `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ stripe_customer_id: customer.id }),
    },
  );

  if (!updateResponse.ok) {
    const body = await updateResponse.text();
    console.error('Failed to persist Stripe customer ID', {
      userId,
      status: updateResponse.status,
      body,
    });
  }

  return customer.id;
}

function resolveRequestedPrice(req: CheckoutRequest): {
  priceId: string;
  tier: ConsumerTier;
  error?: string;
  status?: number;
} {
  const requestedPriceId = req.priceId?.trim();
  if (requestedPriceId) {
    const tier = PRICE_TIERS[requestedPriceId];
    if (!tier) {
      const isLivePricingIncomplete = IS_LIVE_MODE && missingLivePriceLabels.length > 0;
      return {
        priceId: requestedPriceId,
        tier: 'individual',
        error: isLivePricingIncomplete
          ? `Live consumer pricing is not fully configured. Missing: ${missingLivePriceLabels.join(', ')}.`
          : `Invalid price: ${requestedPriceId}. Not an allowed subscription price.`,
        status: isLivePricingIncomplete ? 503 : 400,
      };
    }
    return { priceId: requestedPriceId, tier };
  }

  const requestedPlan = req.plan === 'plus' ? 'individual' : req.plan ?? req.tier;
  const requestedInterval = req.billingPeriod === 'annual' ? 'yearly' : req.billingPeriod;
  if (!requestedPlan || !requestedInterval) {
    return {
      priceId: '',
      tier: 'individual',
      error: 'Missing priceId or plan/billingPeriod.',
      status: 400,
    };
  }

  const config = CONSUMER_PRICE_CONFIGS.find(
    (candidate) =>
      candidate.tier === requestedPlan &&
      candidate.interval === requestedInterval,
  );
  if (!config) {
    return {
      priceId: '',
      tier: 'individual',
      error: `Unsupported subscription plan: ${requestedPlan}/${requestedInterval}.`,
      status: 400,
    };
  }

  const configuredPriceId = firstEnvValue(config.envNames);
  const priceId = configuredPriceId || (!IS_LIVE_MODE ? config.testPriceIds[0] : '');
  if (!priceId) {
    return {
      priceId: '',
      tier: config.tier,
      error: `No Stripe price configured for ${config.label}.`,
      status: 503,
    };
  }

  return { priceId, tier: config.tier };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const checkoutRequest: CheckoutRequest = await req.json();
    const { userId, successUrl, cancelUrl } = checkoutRequest;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const authResponse = await requireUserSelf(req, supabase, userId);
    if (authResponse) return authResponse;

    const resolved = resolveRequestedPrice(checkoutRequest);
    if (resolved.error) {
      return jsonResponse({ error: resolved.error }, resolved.status ?? 400);
    }
    const { priceId, tier } = resolved;

    // Get user info
    const { data: user } = await supabase
      .from('users')
      .select('email, stripe_customer_id')
      .eq('id', userId)
      .single();

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const customerId = await ensureStripeCustomer({
      userId,
      email: user.email,
      stripeCustomerId: user.stripe_customer_id,
    });

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      subscription_data: {
        metadata: { user_id: userId, tier },
      },
      metadata: { user_id: userId, tier },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
    });

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Checkout session error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: 'Failed to create checkout session', message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
