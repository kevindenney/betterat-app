/**
 * Create Payment Intent Edge Function
 * Creates Stripe Payment Intents for race entry fees and coaching sessions
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

interface PaymentIntentRequest {
  entryId?: string;      // For race entry payments
  sessionId?: string;    // For coaching session payments
  amount?: number;       // Amount in cents
  currency?: string;     // Currency code (default: usd)
  description?: string;  // Payment description
  metadata?: Record<string, string>;
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

    // Create Supabase client with user's auth
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

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

    const body: PaymentIntentRequest = await req.json();
    const { entryId, sessionId } = body;

    // The amount, currency, and access-granting metadata are ALL derived
    // server-side from a priced source row (a race entry or coaching session).
    // Previously, a request with neither id fell back to a client-supplied
    // `amount` + `metadata`, and the stripe-webhooks handler grants course /
    // blueprint access purely from that metadata — so a caller could pay 50¢ for
    // any paid course by crafting {amount:50, metadata:{type:'course_purchase',...}}.
    // Reject any request that does not resolve to a server-priced source.
    if (!entryId && !sessionId) {
      return new Response(
        JSON.stringify({ error: 'A valid entryId or sessionId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currency = 'usd';
    let paymentAmount: number | undefined;
    let paymentDescription = 'BetterAt Payment';
    let paymentMetadata: Record<string, string> = { user_id: user.id };
    let connectedAccountId: string | undefined;
    let applicationFeeAmount: number | undefined;

    // Handle race entry payment
    if (entryId) {
      const { data: entry, error: entryError } = await supabase
        .from('race_entries')
        .select(`
          *,
          regattas (
            event_name,
            club_race_calendar (
              club_id,
              clubs (
                name,
                stripe_account_id
              )
            )
          )
        `)
        .eq('id', entryId)
        .single();

      if (entryError || !entry) {
        return new Response(
          JSON.stringify({ error: 'Entry not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (entry.payment_status === 'paid') {
        return new Response(
          JSON.stringify({ error: 'Entry already paid' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      paymentAmount = Math.round((entry.entry_fee_amount || 0) * 100); // Convert to cents
      paymentDescription = `Race Entry: ${entry.regattas?.event_name || 'Regatta'} - ${entry.sail_number || 'TBD'}`;
      paymentMetadata = {
        ...paymentMetadata,
        entry_id: entryId,
        type: 'race_entry',
        regatta_name: entry.regattas?.event_name || '',
        sail_number: entry.sail_number || '',
      };

      // If club has Stripe Connect, use destination charges
      const clubStripeAccount = entry.regattas?.club_race_calendar?.clubs?.stripe_account_id;
      if (clubStripeAccount) {
        connectedAccountId = clubStripeAccount;
        // Platform takes 5% fee for race entries
        applicationFeeAmount = Math.round(paymentAmount * 0.05);
      }
    }

    // Handle coaching session payment
    if (sessionId) {
      const { data: session, error: sessionError } = await supabase
        .from('coaching_sessions')
        .select(`
          *,
          coach_profiles (
            display_name,
            stripe_account_id,
            users (
              full_name
            )
          )
        `)
        .eq('id', sessionId)
        .single();

      if (sessionError || !session) {
        return new Response(
          JSON.stringify({ error: 'Session not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (session.payment_status === 'captured') {
        return new Response(
          JSON.stringify({ error: 'Session already paid' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      paymentAmount = Math.round((session.total_amount || session.fee_amount || 0) * 100);
      const coachName = session.coach_profiles?.users?.full_name || 
                        session.coach_profiles?.display_name || 'Coach';
      paymentDescription = `Coaching Session with ${coachName}`;
      paymentMetadata = {
        ...paymentMetadata,
        session_id: sessionId,
        type: 'coaching_session',
        coach_id: session.coach_id || '',
      };

      // Coaches use Stripe Connect - 15% platform fee
      const coachStripeAccount = session.coach_profiles?.stripe_account_id;
      if (coachStripeAccount) {
        connectedAccountId = coachStripeAccount;
        applicationFeeAmount = Math.round(paymentAmount * 0.15);
      }
    }

    // Validate amount
    if (!paymentAmount || paymentAmount < 50) { // Stripe minimum is 50 cents
      return new Response(
        JSON.stringify({ error: 'Invalid payment amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Payment Intent
    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: paymentAmount,
      currency: currency.toLowerCase(),
      description: paymentDescription,
      metadata: paymentMetadata,
      automatic_payment_methods: {
        enabled: true,
      },
    };

    // Add destination charges for connected accounts
    if (connectedAccountId && applicationFeeAmount) {
      paymentIntentParams.transfer_data = {
        destination: connectedAccountId,
      };
      paymentIntentParams.application_fee_amount = applicationFeeAmount;
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: paymentAmount,
        currency: currency,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error creating payment intent:', error);

    const isStripeError = error instanceof Stripe.errors.StripeError;
    
    return new Response(
      JSON.stringify({ 
        error: isStripeError ? error.message : 'Failed to create payment intent',
        code: isStripeError ? error.code : undefined,
      }),
      { 
        status: isStripeError ? 400 : 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
