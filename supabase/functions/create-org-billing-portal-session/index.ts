/**
 * Create Org Billing Portal Session Edge Function
 * Opens the Stripe-hosted Customer Billing Portal for an organization (club)
 * so an admin can update the card on file, change the receipt email, view
 * invoices, and manage/cancel the subscription — all on Stripe's surface.
 *
 * Web-only flow: the caller passes a returnUrl built from window.location.origin
 * (so the portal returns the user to wherever they actually are), mirroring the
 * org checkout session function.
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
const ORG_ADMIN_ROLES = new Set(['owner', 'admin', 'manager']);

interface PortalRequest {
  organizationId: string;
  returnUrl: string;
}

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(
    JSON.stringify(body),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function requireOrgBillingAdmin(
  req: Request,
  supabase: SupabaseClient,
  organizationId: string
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

  const { data: membership } = await supabase
    .from('organization_memberships')
    .select('role, status, membership_status')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .maybeSingle();

  const role = String(membership?.role || '').trim().toLowerCase();
  const status = String(membership?.membership_status || membership?.status || '').trim().toLowerCase();

  if (!ORG_ADMIN_ROLES.has(role) || status !== 'active') {
    return jsonResponse({ error: 'Forbidden' }, 403);
  }

  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { organizationId, returnUrl }: PortalRequest = await req.json();

    if (!organizationId || !returnUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: organizationId, returnUrl' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const authResponse = await requireOrgBillingAdmin(req, supabase, organizationId);
    if (authResponse) return authResponse;

    // Resolve the Stripe customer for the org. The subscription row is the most
    // reliable source (written by the webhook); fall back to the org record.
    let customerId: string | null = null;

    const { data: sub } = await supabase
      .from('organization_subscriptions')
      .select('stripe_customer_id')
      .eq('organization_id', organizationId)
      .maybeSingle();
    customerId = sub?.stripe_customer_id ?? null;

    if (!customerId) {
      const { data: org } = await supabase
        .from('organizations')
        .select('stripe_customer_id')
        .eq('id', organizationId)
        .maybeSingle();
      customerId = org?.stripe_customer_id ?? null;
    }

    if (!customerId) {
      return new Response(
        JSON.stringify({
          error: 'No Stripe customer for this organization. Start a subscription first.',
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Org billing portal session error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create billing portal session', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
