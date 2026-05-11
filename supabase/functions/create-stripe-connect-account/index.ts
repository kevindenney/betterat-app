/**
 * Create Stripe Connect Account Edge Function
 * Creates and onboards any user to Stripe Connect for marketplace payments.
 * Uses creator_stripe_accounts table (not coach_profiles).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConnectAccountRequest {
  user_id?: string;
  coach_id?: string; // legacy compat
  return_url?: string;
  refresh_url?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: ConnectAccountRequest = await req.json();
    const targetUserId = body.user_id || body.coach_id;

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership
    if (targetUserId !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Not authorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already has a Stripe account in creator_stripe_accounts
    const { data: existingCreator } = await supabase
      .from('creator_stripe_accounts')
      .select('stripe_account_id')
      .eq('user_id', targetUserId)
      .single();

    let accountId = existingCreator?.stripe_account_id || null;

    // Also check legacy coach_profiles
    if (!accountId) {
      const { data: coachProfile } = await supabase
        .from('coach_profiles')
        .select('stripe_account_id')
        .eq('user_id', targetUserId)
        .single();

      if (coachProfile?.stripe_account_id) {
        accountId = coachProfile.stripe_account_id;
        // Migrate to creator_stripe_accounts
        await supabase
          .from('creator_stripe_accounts')
          .upsert({
            user_id: targetUserId,
            stripe_account_id: accountId,
          }, { onConflict: 'user_id' });
      }
    }

    if (!accountId) {
      // Get user profile for prefilling
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', targetUserId)
        .single();

      // Create new Stripe Connect account (Express type)
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: profile?.email || user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        business_profile: {
          mcc: '7941', // Sports clubs, fields, and promoters
          name: profile?.full_name || 'Creator',
          product_description: 'Digital learning blueprints and content',
          url: `https://better.at/creator/${targetUserId}`,
        },
        metadata: {
          user_id: targetUserId,
        },
      });

      accountId = account.id;

      // Save to creator_stripe_accounts
      const { error: insertError } = await supabase
        .from('creator_stripe_accounts')
        .upsert({
          user_id: targetUserId,
          stripe_account_id: accountId,
          onboarding_complete: false,
        }, { onConflict: 'user_id' });

      if (insertError) {
        console.error('Failed to save Stripe account ID:', insertError);
      }
    }

    // Create account onboarding link
    const baseUrl = Deno.env.get('APP_URL') || 'https://better.at';

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: body.refresh_url || `${baseUrl}/stripe-connect-callback?refresh=true`,
      return_url: body.return_url || `${baseUrl}/stripe-connect-callback`,
      type: 'account_onboarding',
      collect: 'eventually_due',
    });

    return new Response(
      JSON.stringify({
        url: accountLink.url,
        accountId: accountId,
        expiresAt: accountLink.expires_at,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const isStripeError = error instanceof Stripe.errors.StripeError;
    const errorDetail = isStripeError
      ? { message: error.message, code: error.code, type: error.type, param: error.param }
      : { message: error instanceof Error ? error.message : String(error) };
    console.error('Error creating Stripe Connect account:', JSON.stringify(errorDetail));

    return new Response(
      JSON.stringify({
        error: isStripeError ? error.message : 'Failed to create Stripe Connect account',
        code: isStripeError ? error.code : undefined,
        detail: errorDetail,
      }),
      {
        status: isStripeError ? 400 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
