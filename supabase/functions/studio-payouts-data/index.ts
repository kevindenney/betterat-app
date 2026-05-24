/**
 * studio-payouts-data Edge Function
 *
 * Single-call read for the Studio Payouts surface. Resolves the
 * signed-in user's connected account, then pulls:
 *   - external account → bank chip (flag, type, account masked,
 *     institution name)
 *   - balance_transactions for the last ~90 days → 12-week aggregation
 *     (sparkline) + recent transactions feed
 *   - next payout (the most recent pending/in_transit payout)
 *
 * All Stripe calls scope to the connected account via the
 * `stripeAccount` request option. Errors per-field don't fail the
 * whole payload — partial responses keep the page renderable.
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
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
};

const COUNTRY_TO_FLAG_TONE: Record<string, { gradient: [string, string]; type: string }> = {
  US: { gradient: ['#28406B', '#5A6B8B'], type: 'ACH' },
  GB: { gradient: ['#B85A66', '#5A6B8B'], type: 'BACS' },
  DE: { gradient: ['#FFD230', '#FF6C00'], type: 'SEPA' },
  FR: { gradient: ['#5A8DB8', '#28406B'], type: 'SEPA' },
  CA: { gradient: ['#B85A66', '#7A6A8E'], type: 'EFT' },
  AU: { gradient: ['#5A8DB8', '#6E8B5A'], type: 'BECS' },
  HK: { gradient: ['#B85A66', '#28406B'], type: 'FPS' },
};

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = (day + 6) % 7; // Monday-start
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function shortWeekLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function shortAgeLabel(unixSeconds: number): string {
  const diffMs = Date.now() - unixSeconds * 1000;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
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

    // Resolve connected account
    const { data: csa } = await supabase
      .from('creator_stripe_accounts')
      .select('stripe_account_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!csa?.stripe_account_id) {
      return new Response(
        JSON.stringify({
          ok: true,
          connected: false,
          bank: null,
          weeklySeries: [],
          recentTransactions: [],
          nextPayout: null,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const accountId = csa.stripe_account_id;
    const stripeAccount = { stripeAccount: accountId };

    // ── Bank chip ──
    let bank: any = null;
    try {
      const acct = await stripe.accounts.retrieve(accountId);
      const ea = (acct as any).external_accounts?.data?.[0];
      const country = (ea?.country as string) ?? (acct.country as string) ?? 'US';
      const tone = COUNTRY_TO_FLAG_TONE[country] ?? COUNTRY_TO_FLAG_TONE.US;
      const last4 = ea?.last4 ? `··· ${ea.last4}` : '··· ····';
      bank = {
        flag: country,
        flagGradient: tone.gradient,
        typeLabel: tone.type,
        accountMasked: last4,
        bankName: ea?.bank_name ?? (acct.business_profile?.name as string) ?? 'Connected bank',
        connectLabel: acct.type === 'custom' ? 'Stripe Custom' : 'Stripe Express',
      };
    } catch (err) {
      console.warn('[studio-payouts-data] accounts.retrieve failed', err);
    }

    // ── 12-week series + recent transactions + deltas ──
    const ninetyDaysAgo = Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60;
    let weeklySeries: { weekStart: string; amount: number }[] = [];
    let recentTransactions: any[] = [];
    let deltaWeekPct: number | null = null;
    try {
      const txns = await stripe.balanceTransactions.list(
        {
          limit: 100,
          created: { gte: ninetyDaysAgo },
        },
        stripeAccount,
      );

      // Weekly bucket (12 weeks ending this week)
      const buckets = new Map<string, number>();
      for (let i = 11; i >= 0; i--) {
        const wkStart = startOfWeek(new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000));
        buckets.set(shortWeekLabel(wkStart), 0);
      }
      for (const t of txns.data) {
        if (t.type === 'payment' || t.type === 'charge') {
          const wkStart = startOfWeek(new Date((t.created as number) * 1000));
          const key = shortWeekLabel(wkStart);
          if (buckets.has(key)) {
            buckets.set(key, (buckets.get(key) ?? 0) + t.amount);
          }
        }
      }
      weeklySeries = Array.from(buckets.entries()).map(([weekStart, cents]) => ({
        weekStart,
        amount: cents / 100,
      }));

      // Week-over-week delta: compare the last fully-completed week
      // (n-1) to the one before it (n-2). Skipping the current week so
      // a mid-week snapshot doesn't read as a "drop".
      if (weeklySeries.length >= 3) {
        const prev = weeklySeries[weeklySeries.length - 2].amount;
        const prevPrev = weeklySeries[weeklySeries.length - 3].amount;
        if (prevPrev > 0) {
          deltaWeekPct = Math.round(((prev - prevPrev) / prevPrev) * 100);
        } else if (prev > 0) {
          deltaWeekPct = 100;
        }
      }

      recentTransactions = txns.data
        .filter((t) => t.type === 'payment' || t.type === 'charge' || t.type === 'refund')
        .slice(0, 8)
        .map((t) => ({
          id: t.id,
          amount: t.amount / 100,
          currency: (t.currency || 'usd').toUpperCase(),
          ageLabel: shortAgeLabel(t.created as number),
          description: t.description ?? '',
          type: t.type,
        }));
    } catch (err) {
      console.warn('[studio-payouts-data] balanceTransactions.list failed', err);
    }

    // ── Lifetime earnings (sum of all charges, no time bound) ──
    // Stripe's API paginates 100/page; for the demo we cap at 1000
    // (10 pages). Production would want a background materialised
    // view, not a live API call here.
    let lifetimeCents = 0;
    let lifetimeSince: string | null = null;
    try {
      let starting_after: string | undefined = undefined;
      for (let page = 0; page < 10; page++) {
        const list = await stripe.balanceTransactions.list(
          { limit: 100, type: 'charge', ...(starting_after ? { starting_after } : {}) },
          stripeAccount,
        );
        for (const t of list.data) {
          lifetimeCents += t.amount;
          const createdIso = new Date((t.created as number) * 1000).toISOString();
          if (!lifetimeSince || createdIso < lifetimeSince) {
            lifetimeSince = createdIso;
          }
        }
        if (!list.has_more || list.data.length === 0) break;
        starting_after = list.data[list.data.length - 1].id;
      }
    } catch (err) {
      console.warn('[studio-payouts-data] lifetime aggregation failed', err);
    }

    // ── Next payout ──
    let nextPayout: any = null;
    try {
      const payouts = await stripe.payouts.list(
        { limit: 1, status: 'pending' },
        stripeAccount,
      );
      const p = payouts.data[0];
      if (p) {
        nextPayout = {
          amount: p.amount / 100,
          currency: (p.currency || 'usd').toUpperCase(),
          arrivalDate: new Date((p.arrival_date as number) * 1000).toISOString(),
        };
      }
    } catch (err) {
      console.warn('[studio-payouts-data] payouts.list failed', err);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        connected: true,
        bank,
        weeklySeries,
        recentTransactions,
        nextPayout,
        lifetime: {
          amount_cents: lifetimeCents,
          since: lifetimeSince,
        },
        deltaWeekPct,
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
