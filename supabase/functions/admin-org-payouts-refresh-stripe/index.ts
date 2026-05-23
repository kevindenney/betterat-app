/**
 * admin-org-payouts-refresh-stripe Edge Function
 *
 * Admin-gated. For each author in an org's org_author_payouts roster,
 * looks up their creator_stripe_accounts.stripe_account_id and queries
 * Stripe (accounts.retrieve) for the live Connect status. Writes the
 * result back to org_author_payouts (stripe_connect_status,
 * stripe_connect_account_id, stripe_status_synced_at).
 *
 * Authors with no Stripe Connect account row are marked 'pending' (not
 * connected). Errors are isolated per-author so one bad row doesn't
 * fail the whole batch.
 */
// @ts-nocheck Deno runtime — no DOM types in source repo
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

type ConnectStatus = 'verified' | 'action_needed' | 'pending' | 'rejected' | 'disabled';

function deriveStatus(acct: any): ConnectStatus {
  const req = acct.requirements ?? {};
  // Verified takes priority — charges + payouts + details submitted with nothing due
  if (
    acct.charges_enabled &&
    acct.payouts_enabled &&
    acct.details_submitted &&
    (req.currently_due ?? []).length === 0
  ) {
    return 'verified';
  }
  // Errors block onboarding regardless of due lists
  if ((req.errors ?? []).length > 0) return 'rejected';
  // Past-due or actively-due items need admin attention
  if ((req.past_due ?? []).length > 0 || (req.currently_due ?? []).length > 0) {
    return 'action_needed';
  }
  // Terminal disabled reasons (not the transient pending_verification one Stripe
  // sets while it processes a freshly-submitted account)
  const disabled = req.disabled_reason as string | null | undefined;
  if (disabled && disabled !== 'requirements.pending_verification') {
    return 'disabled';
  }
  // Everything else (still being verified, or no connect account at all) → pending
  return 'pending';
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch (_e) {
      body = {};
    }
    const orgId = body.org_id ?? body.orgId;
    if (!orgId) {
      return new Response(
        JSON.stringify({ error: 'org_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Admin gate
    const { data: membership } = await supabase
      .from('organization_memberships')
      .select('role, status, membership_status')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .maybeSingle();

    const effective = membership?.membership_status ?? membership?.status;
    const isAdmin =
      membership &&
      ['owner', 'admin', 'manager'].includes(membership.role) &&
      effective === 'active';

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Not authorized to refresh org payouts' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: authors, error: authorsErr } = await supabase
      .from('org_author_payouts')
      .select('id, author_user_id')
      .eq('org_id', orgId);

    if (authorsErr) throw authorsErr;

    const results: {
      author_user_id: string;
      status: ConnectStatus;
      account_id: string | null;
      error?: string;
    }[] = [];

    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');

    for (const row of authors ?? []) {
      try {
        const { data: csa } = await supabase
          .from('creator_stripe_accounts')
          .select('stripe_account_id')
          .eq('user_id', row.author_user_id)
          .maybeSingle();

        const accountId = csa?.stripe_account_id ?? null;
        let status: ConnectStatus = 'pending';

        if (accountId && stripeSecret) {
          const acct = await stripe.accounts.retrieve(accountId);
          status = deriveStatus(acct);
        }

        const { error: updErr } = await supabase
          .from('org_author_payouts')
          .update({
            stripe_connect_status: status,
            stripe_connect_account_id: accountId,
            stripe_status_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);
        if (updErr) throw updErr;

        results.push({ author_user_id: row.author_user_id, status, account_id: accountId });
      } catch (err) {
        results.push({
          author_user_id: row.author_user_id,
          status: 'pending',
          account_id: null,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Audit-log a summary event so the action is traceable
    try {
      await supabase.rpc('audit_log_event', {
        p_org_id: orgId,
        p_verb: 'config_change',
        p_verb_label: 'Synced from Stripe',
        p_description: `Refreshed Stripe Connect status for ${results.length} author${results.length === 1 ? '' : 's'}.`,
        p_target_type: null,
        p_target_id: null,
        p_target_label: null,
        p_payload: {
          action: 'stripe.connect_status.refresh',
          count: results.length,
          summary: results.map((r) => ({ author: r.author_user_id, status: r.status })),
        },
      });
    } catch (_auditErr) {
      // best-effort audit
    }

    return new Response(
      JSON.stringify({ ok: true, count: results.length, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
