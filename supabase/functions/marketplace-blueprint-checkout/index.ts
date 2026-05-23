/**
 * marketplace-blueprint-checkout Edge Function
 *
 * Creates a real Stripe Checkout Session for a blueprint that has been
 * listed via blueprint-stripe-sync. Used by the editor's "Preview as
 * buyer" flow today; same path can back a public /marketplace surface
 * later.
 *
 * Requires:
 *   - blueprints.access_mode = 'independent'
 *   - blueprints.stripe_price_id set
 *
 * Routes the platform fee + author payout via destination_data when
 * the author has a verified creator_stripe_accounts.stripe_account_id;
 * otherwise the platform receives the funds directly (status =
 * "pending payout routing").
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

const PLATFORM_FEE_PERCENT = 30; // 70/30 author/platform split

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
    const blueprintId = body.blueprint_id ?? body.blueprintId;
    const successUrl = body.success_url ?? body.successUrl;
    const cancelUrl = body.cancel_url ?? body.cancelUrl;

    if (!blueprintId || !successUrl || !cancelUrl) {
      return new Response(
        JSON.stringify({
          error: 'blueprint_id, success_url, and cancel_url are required',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: blueprint, error: bpErr } = await supabase
      .from('blueprints')
      .select(
        'id, org_id, author_user_id, title, access_mode, stripe_price_id, billing_cadence, price_per_seat_cents, author_payout_pct',
      )
      .eq('id', blueprintId)
      .maybeSingle();

    if (bpErr || !blueprint) {
      return new Response(JSON.stringify({ error: 'Blueprint not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (blueprint.access_mode !== 'independent') {
      return new Response(
        JSON.stringify({
          error:
            'Checkout is only available for independent blueprints. Flip access mode first.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!blueprint.stripe_price_id) {
      return new Response(
        JSON.stringify({
          error:
            'Blueprint has no Stripe price yet. Click "List on Stripe" in the editor first.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Optional: route payouts to the author's Connect account
    let destinationAccount: string | null = null;
    if (blueprint.author_user_id) {
      const { data: csa } = await supabase
        .from('creator_stripe_accounts')
        .select('stripe_account_id, charges_enabled, payouts_enabled')
        .eq('user_id', blueprint.author_user_id)
        .maybeSingle();
      if (csa?.stripe_account_id && csa.charges_enabled && csa.payouts_enabled) {
        destinationAccount = csa.stripe_account_id;
      }
    }

    const mode: Stripe.Checkout.SessionCreateParams.Mode =
      blueprint.billing_cadence === 'one_time' ? 'payment' : 'subscription';

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode,
      line_items: [
        {
          price: blueprint.stripe_price_id,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: `${blueprint.id}:${user.id}`,
      metadata: {
        blueprint_id: blueprint.id,
        buyer_user_id: user.id,
        author_user_id: blueprint.author_user_id ?? '',
      },
    };

    if (destinationAccount) {
      // For subscriptions, application_fee_percent + transfer_data go on
      // subscription_data; for one-time payments, on payment_intent_data.
      const authorPct = blueprint.author_payout_pct ?? (100 - PLATFORM_FEE_PERCENT);
      const platformFeePct = 100 - authorPct;
      if (mode === 'subscription') {
        sessionParams.subscription_data = {
          application_fee_percent: platformFeePct,
          transfer_data: { destination: destinationAccount },
          metadata: {
            blueprint_id: blueprint.id,
            buyer_user_id: user.id,
          },
        };
      } else {
        sessionParams.payment_intent_data = {
          application_fee_amount: Math.round(
            (blueprint.price_per_seat_cents ?? 0) * (platformFeePct / 100),
          ),
          transfer_data: { destination: destinationAccount },
          metadata: {
            blueprint_id: blueprint.id,
            buyer_user_id: user.id,
          },
        };
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return new Response(
      JSON.stringify({
        ok: true,
        url: session.url,
        session_id: session.id,
        destination_account: destinationAccount,
        mode,
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
