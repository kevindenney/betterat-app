/**
 * marketplace-cancel-subscription Edge Function
 *
 * Buyer-side cancel for a marketplace_subscriptions row. JWT-gated;
 * verifies the caller owns the subscription (buyer_user_id =
 * auth.uid()). Calls stripe.subscriptions.cancel — the
 * customer.subscription.deleted webhook then updates the row.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch (_e) {
      body = {};
    }
    const subscriptionId = body.subscription_id ?? body.subscriptionId;
    if (!subscriptionId) {
      return new Response(JSON.stringify({ error: 'subscription_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: row } = await supabase
      .from('marketplace_subscriptions')
      .select(
        'id, buyer_user_id, stripe_subscription_id, status, cancel_at_period_end, current_period_end',
      )
      .eq('id', subscriptionId)
      .maybeSingle();

    if (!row || row.buyer_user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Subscription not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (row.status === 'canceled') {
      return new Response(JSON.stringify({ ok: true, already_canceled: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (row.cancel_at_period_end) {
      return new Response(
        JSON.stringify({ ok: true, already_scheduled: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let periodEnd: string | null = row.current_period_end ?? null;
    let cancelAtPeriodEnd = false;
    if (row.stripe_subscription_id) {
      try {
        // Set cancel_at_period_end so the buyer keeps access through the
        // end of the period they've already paid for. The
        // customer.subscription.deleted webhook will fire at period end
        // (Stripe sends it then) and flip status to 'canceled'.
        const sub = await stripe.subscriptions.update(row.stripe_subscription_id, {
          cancel_at_period_end: true,
        });
        cancelAtPeriodEnd = sub.cancel_at_period_end ?? true;
        if (sub.current_period_end) {
          periodEnd = new Date(sub.current_period_end * 1000).toISOString();
        }
      } catch (err) {
        console.warn('[marketplace-cancel] stripe update failed', err);
        // Continue — we still mark the local row so the buyer's UI
        // reflects intent. Webhook can reconcile later.
        cancelAtPeriodEnd = true;
      }
    } else {
      // No Stripe subscription (e.g. test session that never started a
      // real sub). Treat as immediate cancel.
      cancelAtPeriodEnd = false;
    }

    if (cancelAtPeriodEnd) {
      await supabase
        .from('marketplace_subscriptions')
        .update({
          cancel_at_period_end: true,
          current_period_end: periodEnd,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
    } else {
      // Fallback path — no Stripe sub, flip immediately
      await supabase
        .from('marketplace_subscriptions')
        .update({
          status: 'canceled',
          canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        cancel_at_period_end: cancelAtPeriodEnd,
        period_end: periodEnd,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
