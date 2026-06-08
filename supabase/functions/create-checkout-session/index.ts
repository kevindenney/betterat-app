/**
 * Create Stripe Checkout Session Edge Function
 * Creates a Stripe checkout session for club subscriptions
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Allowed consumer subscription price IDs -> tier. The client sends a concrete
// Stripe price ID (see subscriptionService.web.ts); we allowlist it so a caller
// can't check out an arbitrary price, and tag the subscription with its tier.
const PRICE_TIERS: Record<string, 'individual' | 'pro'> = {
  'price_1Tft79BbfEeOhHXbC6kMnpSI': 'individual', // $9/mo
  'price_1Tft7ABbfEeOhHXbeIzYLCce': 'individual', // $90/yr
  'price_1Tft7BBbfEeOhHXbdaVhs9Js': 'pro',        // $29/mo
  'price_1Tft7CBbfEeOhHXb0tr4xNnO': 'pro',        // $290/yr
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckoutRequest {
  priceId: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { priceId, userId, successUrl, cancelUrl }: CheckoutRequest = await req.json();

    if (!priceId || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tier = PRICE_TIERS[priceId];
    if (!tier) {
      return new Response(
        JSON.stringify({ error: `Invalid price: ${priceId}. Not an allowed subscription price.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user info
    const { data: user } = await supabase
      .from('users')
      .select('email, stripe_customer_id')
      .eq('id', userId)
      .single();

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get or create Stripe customer
    let customerId = user.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: userId },
      });
      customerId = customer.id;

      // Save customer ID to user
      await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      subscription_data: {
        metadata: { user_id: userId, tier },
      },
      metadata: { user_id: userId, tier },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
    });

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Checkout session error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create checkout session', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

