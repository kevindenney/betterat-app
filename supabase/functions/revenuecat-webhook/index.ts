/**
 * RevenueCat Webhook
 * Receives subscription lifecycle events from RevenueCat and keeps the
 * `users` table (and `subscriptions` ledger) in sync. This is the entitlement
 * source of truth the client reads via subscriptionService.refreshSubscriptionStatus.
 *
 * RevenueCat is configured with appUserID = our Supabase user id, so
 * event.app_user_id maps directly to users.id.
 *
 * Deploy with JWT verification OFF (RevenueCat does not send a Supabase JWT);
 * auth is the shared Authorization secret instead:
 *   supabase functions deploy revenuecat-webhook --no-verify-jwt
 * Set in the dashboard / env:
 *   REVENUECAT_WEBHOOK_SECRET  (also pasted into RevenueCat's Authorization header)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('REVENUECAT_WEBHOOK_SECRET') || '';

interface RevenueCatEvent {
  type: string;
  app_user_id: string;
  original_app_user_id?: string;
  aliases?: string[];
  product_id?: string;
  entitlement_ids?: string[] | null;
  period_type?: string;
  purchased_at_ms?: number | null;
  expiration_at_ms?: number | null;
  store?: string;
  environment?: string;
  transaction_id?: string;
}

interface RevenueCatWebhookBody {
  api_version?: string;
  event: RevenueCatEvent;
}

// Fallback product -> tier map when entitlement_ids are absent on the event.
const PRODUCT_TIER_MAP: Record<string, 'individual' | 'pro'> = {
  betterat_individual_monthly: 'individual',
  betterat_individual_yearly: 'individual',
  betterat_pro_monthly: 'pro',
  betterat_pro_yearly: 'pro',
};

function resolveTier(event: RevenueCatEvent): 'individual' | 'pro' {
  const ents = event.entitlement_ids ?? [];
  if (ents.includes('pro')) return 'pro';
  if (ents.includes('individual')) return 'individual';
  return PRODUCT_TIER_MAP[event.product_id ?? ''] ?? 'individual';
}

function resolvePlatform(store?: string): 'ios' | 'android' | 'web' {
  switch (store) {
    case 'PLAY_STORE':
      return 'android';
    case 'STRIPE':
    case 'RC_BILLING':
    case 'PADDLE':
      return 'web';
    default:
      return 'ios'; // APP_STORE, MAC_APP_STORE, AMAZON
  }
}

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Shared-secret auth — RevenueCat sends the configured value as Authorization.
  const auth = req.headers.get('Authorization') || '';
  if (!WEBHOOK_SECRET || auth !== WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = (await req.json()) as RevenueCatWebhookBody;
    const event = body?.event;

    if (!event?.type) {
      return new Response(JSON.stringify({ error: 'Malformed event' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // RevenueCat sends a TEST event when you save the webhook — ack it.
    if (event.type === 'TEST') {
      return new Response(JSON.stringify({ ok: true, test: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userId = event.app_user_id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing app_user_id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const expirationMs = event.expiration_at_ms ?? null;
    const isExpiry = event.type === 'EXPIRATION';
    // Active while not expired. Non-renewing/lifetime purchases have no expiration.
    const active = !isExpiry && (expirationMs == null || expirationMs > Date.now());

    const tier = active ? resolveTier(event) : 'free';
    const status = active ? 'active' : 'expired';
    const platform = resolvePlatform(event.store);
    const expiresAtIso = expirationMs ? new Date(expirationMs).toISOString() : null;
    const nowIso = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('users')
      .update({
        subscription_status: status,
        subscription_tier: tier,
        subscription_platform: platform,
        subscription_product_id: event.product_id ?? null,
        subscription_transaction_id: event.transaction_id ?? null,
        subscription_expires_at: expiresAtIso,
        subscription_updated_at: nowIso,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('revenuecat-webhook: failed to update user', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update user' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Mirror into the subscriptions ledger (best-effort).
    await supabase
      .from('subscriptions')
      .upsert(
        {
          user_id: userId,
          tier,
          status,
          current_period_end: expiresAtIso,
          metadata: {
            platform,
            eventType: event.type,
            productId: event.product_id,
            transactionId: event.transaction_id,
            environment: event.environment,
            periodType: event.period_type,
          },
          updated_at: nowIso,
        },
        { onConflict: 'user_id' }
      );

    return new Response(JSON.stringify({ ok: true, status, tier }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('revenuecat-webhook error', error);
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
