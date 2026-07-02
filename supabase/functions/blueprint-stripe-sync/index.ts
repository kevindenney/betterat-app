/**
 * blueprint-stripe-sync Edge Function
 *
 * Author/admin-gated. Idempotently materializes a Stripe Product +
 * recurring Price for a blueprint whose access_mode='independent'.
 *
 * Reads public.blueprints.{title, description, price_per_seat_cents,
 * billing_cadence, currency, author_user_id, stripe_product_id,
 * stripe_price_id}. Routes payouts to the author's
 * creator_stripe_accounts.stripe_account_id via destination charges if
 * we have one, otherwise the platform receives the funds.
 *
 * Idempotency: if a stripe_product_id exists, updates name/description
 * in place; otherwise creates one. Stripe Prices are immutable, so when
 * the unit amount or interval changes we create a fresh Price and point
 * the blueprint at it (archiving the old one).
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || '';
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});
const stripeEnvironment = stripeSecretKey.startsWith('sk_live_') ? 'production' : 'test';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Cadence = 'monthly' | 'annual' | 'one_time';

function cadenceToInterval(c: Cadence): { recurring: boolean; interval?: 'month' | 'year' } {
  if (c === 'one_time') return { recurring: false };
  if (c === 'annual') return { recurring: true, interval: 'year' };
  return { recurring: true, interval: 'month' };
}

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
    if (!blueprintId) {
      return new Response(JSON.stringify({ error: 'blueprint_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load the blueprint
    const { data: blueprint, error: bpErr } = await supabase
      .from('blueprints')
      .select(
        'id, org_id, author_user_id, title, description, access_mode, price_per_seat_cents, billing_cadence, currency, stripe_product_id, stripe_price_id',
      )
      .eq('id', blueprintId)
      .maybeSingle();

    if (bpErr || !blueprint) {
      return new Response(JSON.stringify({ error: 'Blueprint not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Authorization — author OR org admin
    let allowed = blueprint.author_user_id === user.id;
    if (!allowed && blueprint.org_id) {
      const { data: m } = await supabase
        .from('organization_memberships')
        .select('role, status, membership_status')
        .eq('organization_id', blueprint.org_id)
        .eq('user_id', user.id)
        .maybeSingle();
      const eff = m?.membership_status ?? m?.status;
      allowed =
        !!m && ['owner', 'admin', 'manager'].includes(m.role) && eff === 'active';
    }

    if (!allowed) {
      return new Response(
        JSON.stringify({ error: 'Not authorized to sync this blueprint' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (blueprint.access_mode !== 'independent') {
      return new Response(
        JSON.stringify({
          error:
            'Only access_mode=independent blueprints sync to Stripe — flip the access mode first.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!blueprint.price_per_seat_cents || blueprint.price_per_seat_cents <= 0) {
      return new Response(
        JSON.stringify({ error: 'price_per_seat_cents must be set before syncing.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const cadence = (blueprint.billing_cadence ?? 'monthly') as Cadence;
    const interval = cadenceToInterval(cadence);
    const currency = String(blueprint.currency ?? 'usd').toLowerCase();
    const blueprintTitle = blueprint.title || 'Untitled blueprint';
    const productName = blueprintTitle.startsWith('Blueprint:')
      ? blueprintTitle
      : `Blueprint: ${blueprintTitle}`;
    const productDescription = (blueprint.description ?? '').slice(0, 500) || undefined;
    const stripeMetadata = {
      type: 'blueprint',
      source: 'betterat_studio',
      environment: stripeEnvironment,
      blueprint_id: blueprint.id,
      org_id: blueprint.org_id ?? '',
      author_user_id: blueprint.author_user_id ?? '',
    };

    // 1) Product — create or update
    let productId = blueprint.stripe_product_id as string | null;
    if (productId) {
      try {
        await stripe.products.update(productId, {
          name: productName,
          description: productDescription,
          metadata: stripeMetadata,
        });
      } catch (err) {
        if (err instanceof Error && /No such product/i.test(err.message)) {
          productId = null;
        } else {
          throw err;
        }
      }
    }
    if (!productId) {
      const product = await stripe.products.create({
        name: productName,
        description: productDescription,
        metadata: stripeMetadata,
      });
      productId = product.id;
    }

    if (productId !== blueprint.stripe_product_id) {
      await supabase
        .from('blueprints')
        .update({ stripe_product_id: productId, stripe_price_id: null })
        .eq('id', blueprint.id);
      blueprint.stripe_price_id = null;
    }

    // 2) Price — recurring or one-time
    let priceId = blueprint.stripe_price_id as string | null;
    let priceChanged = false;
    if (priceId) {
      // Stripe prices are immutable. Compare current price to what we want.
      let existing: any = null;
      try {
        existing = await stripe.prices.retrieve(priceId);
      } catch (err) {
        if (err instanceof Error && /No such price/i.test(err.message)) {
          priceId = null;
          priceChanged = true;
        } else {
          throw err;
        }
      }
      const wantRecurring = interval.recurring;
      const matches =
        existing &&
        existing.product === productId &&
        existing.unit_amount === blueprint.price_per_seat_cents &&
        existing.currency === currency &&
        ((wantRecurring && existing.recurring?.interval === interval.interval) ||
          (!wantRecurring && existing.recurring == null));
      if (existing && !matches) {
        // Archive old, create new
        await stripe.prices.update(priceId, { active: false });
        priceId = null;
        priceChanged = true;
      }
    }

    if (!priceId) {
      const priceParams: any = {
        product: productId,
        currency,
        unit_amount: blueprint.price_per_seat_cents,
        metadata: {
          ...stripeMetadata,
          billing_cadence: cadence,
          currency,
        },
      };
      if (interval.recurring) {
        priceParams.recurring = { interval: interval.interval };
      }
      const price = await stripe.prices.create(priceParams);
      priceId = price.id;
      priceChanged = true;
    }

    // 3) Write back
    const { error: updErr } = await supabase
      .from('blueprints')
      .update({
        stripe_product_id: productId,
        stripe_price_id: priceId,
        stripe_synced_at: new Date().toISOString(),
        stripe_sync_error: null,
      })
      .eq('id', blueprint.id);
    if (updErr) throw updErr;

    // Audit
    if (blueprint.org_id) {
      try {
        await supabase.rpc('audit_log_event', {
          p_org_id: blueprint.org_id,
          p_verb: 'config_change',
          p_verb_label: priceChanged ? 'Listed on Stripe' : 'Refreshed Stripe listing',
          p_description: `Synced "${productName}" to Stripe (price ${priceId}).`,
          p_target_type: 'blueprint',
          p_target_id: blueprint.id,
          p_target_label: productName,
          p_payload: {
            stripe_product_id: productId,
            stripe_price_id: priceId,
            unit_amount: blueprint.price_per_seat_cents,
            currency,
            interval: interval.interval ?? null,
            price_changed: priceChanged,
          },
        });
      } catch (_e) {
        // best-effort
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        stripe_product_id: productId,
        stripe_price_id: priceId,
        price_changed: priceChanged,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    // On Stripe error, record it on the row for the surface to show
    try {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const body = await req.clone().json().catch(() => ({}));
      const id = body?.blueprint_id ?? body?.blueprintId;
      if (id) {
        await supabase
          .from('blueprints')
          .update({
            stripe_sync_error: err instanceof Error ? err.message : String(err),
          })
          .eq('id', id);
      }
    } catch (_e) {
      // best-effort
    }
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
