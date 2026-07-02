/**
 * Stripe Create Payout Edge Function
 * Creates a payout from a coach's Stripe Connect account to their bank account.
 *
 * POST body: { coach_id: string }
 * Returns: { success, payout_id, amount, currency, estimated_arrival }
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
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
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
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { coach_id } = await req.json();

    if (!coach_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'coach_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get coach profile
    const { data: coachProfile, error: profileError } = await supabase
      .from('coach_profiles')
      .select('id, user_id, stripe_account_id, stripe_onboarding_complete, stripe_payouts_enabled')
      .eq('id', coach_id)
      .single();

    if (profileError || !coachProfile) {
      return new Response(
        JSON.stringify({ success: false, error: 'Coach profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership
    if (coachProfile.user_id !== user.id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not authorized to access this coach profile' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate Stripe onboarding is complete
    if (!coachProfile.stripe_account_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Stripe Connect account not set up',
          code: 'no_stripe_account',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!coachProfile.stripe_onboarding_complete) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Stripe onboarding is not complete. Please finish setting up your account.',
          code: 'onboarding_incomplete',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!coachProfile.stripe_payouts_enabled) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Payouts are not enabled on your Stripe account. Please check your Stripe dashboard for any pending requirements.',
          code: 'payouts_not_enabled',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // BUG 5: Check for pending AND in_transit payouts to prevent duplicates
    const [pendingPayouts, inTransitPayouts] = await Promise.all([
      stripe.payouts.list(
        { limit: 1, status: 'pending' },
        { stripeAccount: coachProfile.stripe_account_id }
      ),
      stripe.payouts.list(
        { limit: 1, status: 'in_transit' },
        { stripeAccount: coachProfile.stripe_account_id }
      ),
    ]);

    const existingPayout = pendingPayouts.data[0] || inTransitPayouts.data[0];

    if (existingPayout) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'A payout is already in progress',
          code: 'payout_in_progress',
          existing_payout: {
            id: existingPayout.id,
            amount: existingPayout.amount,
            currency: existingPayout.currency,
            status: existingPayout.status,
            estimated_arrival: existingPayout.arrival_date
              ? new Date(existingPayout.arrival_date * 1000).toISOString()
              : null,
          },
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check available balance on the connected account
    const balance = await stripe.balance.retrieve({
      stripeAccount: coachProfile.stripe_account_id,
    });

    const availableAmount = balance.available.reduce((sum, b) => sum + b.amount, 0);
    const currency = balance.available[0]?.currency || 'usd';

    if (availableAmount <= 0) {
      const pendingAmount = balance.pending.reduce((sum, b) => sum + b.amount, 0);
      return new Response(
        JSON.stringify({
          success: false,
          error: pendingAmount > 0
            ? `No funds available for payout. You have ${(pendingAmount / 100).toFixed(2)} ${currency.toUpperCase()} pending that will become available after Stripe's standard holding period.`
            : 'No funds available for payout.',
          code: 'insufficient_balance',
          pending_amount: pendingAmount,
          currency,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the payout to the coach's default bank account
    const payout = await stripe.payouts.create(
      {
        amount: availableAmount,
        currency,
        description: 'BetterAt coach earnings payout',
      },
      {
        stripeAccount: coachProfile.stripe_account_id,
      }
    );

    const estimatedArrival = payout.arrival_date
      ? new Date(payout.arrival_date * 1000).toISOString()
      : null;

    // Record the payout in the database
    await supabase.from('coach_payouts').insert({
      coach_id: coachProfile.id,
      stripe_payout_id: payout.id,
      amount: payout.amount,
      currency: payout.currency,
      arrival_date: estimatedArrival,
      status: payout.status,
      created_at: new Date().toISOString(),
    });

    // Send push notification to the coach
    const formattedAmount = (payout.amount / 100).toFixed(2);
    const arrivalFormatted = estimatedArrival
      ? new Date(estimatedArrival).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : 'soon';

    try {
      await supabase.functions.invoke('send-push-notification', {
        body: {
          recipients: [
            {
              userId: coachProfile.user_id,
              title: 'Payout Initiated',
              body: `Payout of $${formattedAmount} ${currency.toUpperCase()} initiated — estimated arrival ${arrivalFormatted}`,
              data: { type: 'payout_initiated', payoutId: payout.id },
              category: 'payments',
            },
          ],
        },
      });
    } catch (pushError) {
      // Non-fatal: log but don't fail the payout
      console.error('Failed to send payout push notification:', pushError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        payout_id: payout.id,
        amount: payout.amount,
        currency: payout.currency,
        estimated_arrival: estimatedArrival,
        status: payout.status,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating payout:', error);

    const isStripeError = error instanceof Stripe.errors.StripeError;

    if (isStripeError) {
      // Handle specific Stripe errors
      const stripeError = error as Stripe.errors.StripeError;
      let code = 'stripe_error';
      let statusCode = 400;

      if (stripeError.code === 'balance_insufficient') {
        code = 'insufficient_balance';
      } else if (stripeError.code === 'account_closed' || stripeError.code === 'account_invalid') {
        code = 'account_restricted';
        statusCode = 403;
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: stripeError.message,
          code,
        }),
        { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'An unexpected error occurred while creating the payout',
        code: 'internal_error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
