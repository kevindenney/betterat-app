/**
 * Create Consumer Billing Portal Session Edge Function
 * Opens the Stripe-hosted Customer Billing Portal for an individual user so
 * they can update payment method, switch billing cadence, view invoices, or
 * cancel at period end on Stripe's surface.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PortalRequest {
  userId: string;
  returnUrl?: string;
  targetPriceId?: string;
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

const CONSUMER_PORTAL_METADATA_KEY = 'betterat_portal_kind';
const CONSUMER_PORTAL_METADATA_VALUE = 'consumer_individual';

async function getPortalProductFromPricePair(currentPriceId: string, targetPriceId: string) {
  const [currentPrice, targetPrice] = await Promise.all([
    stripe.prices.retrieve(currentPriceId),
    stripe.prices.retrieve(targetPriceId),
  ]);

  if (typeof currentPrice.product !== 'string' || typeof targetPrice.product !== 'string') {
    throw new Error('Expected string product IDs on Stripe prices');
  }

  if (currentPrice.product !== targetPrice.product) {
    throw new Error('Current and target prices do not belong to the same Stripe product');
  }

  return {
    productId: currentPrice.product,
    allowedPriceIds: [currentPriceId, targetPriceId],
  };
}

async function ensureConsumerPortalConfiguration(
  currentPriceId?: string | null,
  targetPriceId?: string | null,
) {
  const explicitConfigurationId = Deno.env.get('STRIPE_CONSUMER_PORTAL_CONFIGURATION_ID') || '';
  if (explicitConfigurationId) {
    return explicitConfigurationId;
  }
  const configs = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });

  const existing = configs.data.find(
    (config: Stripe.BillingPortal.Configuration) =>
      config.metadata?.[CONSUMER_PORTAL_METADATA_KEY] === CONSUMER_PORTAL_METADATA_VALUE,
  );

  const canEnableSubscriptionUpdate = !!currentPriceId && !!targetPriceId && currentPriceId !== targetPriceId;
  const updateProduct =
    canEnableSubscriptionUpdate && currentPriceId && targetPriceId
      ? await getPortalProductFromPricePair(currentPriceId, targetPriceId)
      : null;

  const configurationPayload = {
    name: 'BetterAt Consumer Billing',
    business_profile: {
      headline: 'Manage your BetterAt subscription',
      privacy_policy_url: 'https://better.at/privacy',
      terms_of_service_url: 'https://better.at/terms',
    },
    default_return_url: 'https://better.at/subscription',
    features: {
      customer_update: {
        enabled: true,
        allowed_updates: ['email', 'address', 'name', 'phone', 'tax_id'],
      },
      invoice_history: {
        enabled: true,
      },
      payment_method_update: {
        enabled: true,
      },
      subscription_cancel: {
        enabled: true,
        mode: 'at_period_end',
        proration_behavior: 'none',
        cancellation_reason: {
          enabled: true,
          options: ['too_expensive', 'missing_features', 'switched_service', 'unused', 'other'],
        },
      },
      subscription_pause: {
        enabled: false,
      },
      subscription_update: {
        enabled: !!updateProduct,
        default_allowed_updates: updateProduct ? ['price'] : [],
        billing_cycle_anchor: 'unchanged',
        proration_behavior: 'none',
        ...(updateProduct
          ? {
              products: [
                {
                  product: updateProduct.productId,
                  prices: updateProduct.allowedPriceIds,
                },
              ],
            }
          : {}),
      },
    },
    metadata: {
      [CONSUMER_PORTAL_METADATA_KEY]: CONSUMER_PORTAL_METADATA_VALUE,
    },
  } as const;

  if (existing) {
    const updated = await stripe.billingPortal.configurations.update(existing.id, configurationPayload);
    return updated.id;
  }

  const created = await stripe.billingPortal.configurations.create(configurationPayload);
  return created.id;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, returnUrl, targetPriceId }: PortalRequest = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const authResponse = await requireUserSelf(req, supabase, userId);
    if (authResponse) return authResponse;

    let customerId: string | null = null;

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id, stripe_subscription_id, price_id')
      .eq('user_id', userId)
      .maybeSingle();
    customerId = subscription?.stripe_customer_id ?? null;

    if (!customerId) {
      const { data: user } = await supabase
        .from('users')
        .select('stripe_customer_id')
        .eq('id', userId)
        .maybeSingle();
      customerId = user?.stripe_customer_id ?? null;
    }

    if (!customerId) {
      return new Response(
        JSON.stringify({
          error: 'No Stripe customer found for this user. Start a subscription first.',
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const configurationId = await ensureConsumerPortalConfiguration(
      subscription?.price_id ?? null,
      targetPriceId ?? null,
    );
    const portalReturnUrl = returnUrl || 'https://better.at/subscription';

    let flow_data:
      | {
          type: 'subscription_update_confirm';
          after_completion: {
            type: 'redirect';
            redirect: { return_url: string };
          };
          subscription_update_confirm: {
            subscription: string;
            items: {
              id: string;
              price: string;
              quantity?: number;
            }[];
          };
        }
      | undefined;

    if (
      targetPriceId &&
      subscription?.stripe_subscription_id &&
      subscription.price_id &&
      subscription.price_id !== targetPriceId
    ) {
      const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
      const currentItem = stripeSubscription.items.data[0];

      if (!currentItem?.id) {
        throw new Error('Could not find the Stripe subscription item to update');
      }

      flow_data = {
        type: 'subscription_update_confirm',
        after_completion: {
          type: 'redirect',
          redirect: { return_url: portalReturnUrl },
        },
        subscription_update_confirm: {
          subscription: subscription.stripe_subscription_id,
          items: [
            {
              id: currentItem.id,
              price: targetPriceId,
              quantity: currentItem.quantity ?? 1,
            },
          ],
        },
      };
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      configuration: configurationId,
      return_url: portalReturnUrl,
      ...(flow_data ? { flow_data } : {}),
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Consumer billing portal session error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create billing portal session', message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
