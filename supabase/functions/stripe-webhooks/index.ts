/**
 * Stripe Webhooks Edge Function
 * Handles all Stripe webhook events for payments, subscriptions, and Connect.
 *
 * Console.log is the primary log surface for edge functions — disabled
 * here. A few legacy locals are kept intentionally for future use.
 */
/* eslint-disable no-console, @typescript-eslint/no-unused-vars */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
if (!stripeSecretKey) throw new Error('STRIPE_SECRET_KEY environment variable is not set');

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET environment variable is not set');

// Connect endpoints sign with a different secret. Both endpoints point
// at this same edge function URL, so we attempt platform first and
// fall back to connect on signature failure.
const connectWebhookSecret = Deno.env.get('STRIPE_CONNECT_WEBHOOK_SECRET') ?? null;

const supabaseUrl = Deno.env.get('SUPABASE_URL');
if (!supabaseUrl) throw new Error('SUPABASE_URL environment variable is not set');

const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseServiceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is not set');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req: Request) => {
  const signature = req.headers.get('stripe-signature');
  
  if (!signature) {
    console.error('Missing stripe-signature header');
    return new Response('Missing signature', { status: 400 });
  }

  try {
    const body = await req.text();
    
    // Verify webhook signature — try platform secret first, then
    // Connect (events from connected accounts carry event.account and
    // are signed with a different secret).
    let event: Stripe.Event | null = null;
    let lastErr: unknown = null;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      lastErr = err;
      if (connectWebhookSecret) {
        try {
          event = await stripe.webhooks.constructEventAsync(
            body,
            signature,
            connectWebhookSecret,
          );
        } catch (err2) {
          lastErr = err2;
        }
      }
    }
    if (!event) {
      console.error('Webhook signature verification failed:', lastErr);
      return new Response('Invalid signature', { status: 400 });
    }

    // BUG 1: Idempotency check — skip if event was already processed
    const { data: existingEvent } = await supabase
      .from('stripe_webhook_events')
      .select('id')
      .eq('event_id', event.id)
      .maybeSingle();

    if (existingEvent) {
      console.log(`Skipping already-processed event: ${event.id}`);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Record event as processing
    await supabase.from('stripe_webhook_events').insert({
      event_id: event.id,
      event_type: event.type,
      processed_at: new Date().toISOString(),
    });

    // BUG 9: Validate event.account for Connect events that require it
    const connectEventTypes = [
      'payout.paid', 'payout.failed', 'transfer.created',
    ];
    if (connectEventTypes.includes(event.type) && !event.account) {
      console.warn(`Missing event.account for Connect event: ${event.type} (${event.id})`);
      return new Response(
        JSON.stringify({ error: `Missing event.account for ${event.type}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[stripe-webhook] Processing event: ${event.type} (${event.id})`);

    // Handle different event types
    switch (event.type) {
      // Payment Intent Events
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      // Subscription Events
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      // Card-on-file changes (e.g. via the billing portal) update the customer.
      case 'customer.updated':
        await handleCustomerUpdated(event.data.object as Stripe.Customer);
        break;

      // Checkout Session Events
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      // Invoice Events
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      // Stripe Connect Events
      case 'account.updated':
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;

      case 'transfer.created':
        await handleTransferCreated(event.data.object as Stripe.Transfer);
        break;

      case 'payout.paid':
        await handlePayoutPaid(event.data.object as Stripe.Payout, event.account!);
        break;

      case 'payout.failed':
        await handlePayoutFailed(event.data.object as Stripe.Payout, event.account!);
        break;

      // BUG 10: Handle charge refunds
      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      default:
        // Unhandled event type
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Webhook handler failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Handle successful payment intent
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const metadata = paymentIntent.metadata;

  if (metadata.type === 'race_entry' && metadata.entry_id) {
    // Update race entry payment status
    const { error } = await supabase
      .from('race_entries')
      .update({
        payment_status: 'paid',
        status: 'confirmed',
        payment_intent_id: paymentIntent.id,
        payment_confirmed_at: new Date().toISOString(),
        amount_paid: paymentIntent.amount / 100, // Convert from cents
        payment_date: new Date().toISOString(),
      })
      .eq('id', metadata.entry_id);

    if (error) {
      console.error('Failed to update race entry:', error);
    } else {
      // Trigger confirmation email
      await triggerConfirmationEmail(metadata.entry_id, 'race_entry');
    }
  }

  if (metadata.type === 'coaching_session' && metadata.session_id) {
    // Update coaching session payment status
    const { error } = await supabase
      .from('coaching_sessions')
      .update({
        payment_status: 'captured',
        status: 'confirmed',
        stripe_payment_intent_id: paymentIntent.id,
        payment_date: new Date().toISOString(),
      })
      .eq('id', metadata.session_id);

    if (error) {
      console.error('Failed to update coaching session:', error);
    } else {
      // Trigger notification to coach
      await triggerConfirmationEmail(metadata.session_id, 'coaching_session');
    }
  }

  if (metadata.type === 'subscription' && metadata.user_id) {
    // Update user subscription
    const { error } = await supabase
      .from('users')
      .update({
        subscription_status: 'active',
      })
      .eq('id', metadata.user_id);

    if (error) {
      console.error('Failed to update user subscription:', error);
    }
  }

  // Handle course purchase
  if (metadata.type === 'course_purchase' && metadata.course_id && metadata.user_id) {
    await handleCoursePurchaseSuccess(
      metadata.course_id,
      metadata.user_id,
      paymentIntent.id,
      paymentIntent.amount
    );
  }

  // Handle blueprint purchase
  if (metadata.type === 'blueprint_purchase' && metadata.blueprint_id && metadata.user_id) {
    await handleBlueprintPurchaseSuccess(
      metadata.blueprint_id,
      metadata.user_id,
      paymentIntent.id,
      paymentIntent.amount
    );
  }
}

/**
 * Handle successful course purchase
 */
async function handleCoursePurchaseSuccess(
  courseId: string,
  userId: string,
  paymentIntentId: string,
  amountPaid: number
) {
  // Create enrollment record
  const { data: enrollment, error: enrollError } = await supabase
    .from('learning_enrollments')
    .upsert({
      user_id: userId,
      course_id: courseId,
      stripe_payment_id: paymentIntentId,
      amount_paid_cents: amountPaid,
      access_type: 'purchase',
      enrolled_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,course_id',
    })
    .select()
    .single();

  if (enrollError) {
    console.error('Failed to create enrollment:', enrollError);
    return;
  }

  // Get course and user info for email
  const { data: course } = await supabase
    .from('learning_courses')
    .select('title')
    .eq('id', courseId)
    .single();

  const { data: user } = await supabase
    .from('users')
    .select('email, full_name')
    .eq('id', userId)
    .single();

  // Send confirmation email
  if (user?.email) {
    try {
      await supabase.functions.invoke('send-email', {
        body: {
          to: user.email,
          subject: `Course Access Confirmed: ${course?.title || 'Your Course'}`,
          html: `
            <h2>Welcome to Your New Course!</h2>
            <p>Hi ${user.full_name || 'Sailor'},</p>
            <p>Your payment has been received and you now have access to:</p>
            <h3>${course?.title || 'Your Course'}</h3>
            <p>Start learning now and improve your racing skills!</p>
            <p><a href="https://regattaflow.com/learn/${courseId}" style="display:inline-block;background-color:#3B82F6;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;">Start Learning</a></p>
            <p>Thank you for choosing RegattaFlow!</p>
          `,
        },
      });
    } catch (emailError) {
      console.error('Failed to send course confirmation email:', emailError);
    }
  }
}

/**
 * Handle successful blueprint purchase
 */
async function handleBlueprintPurchaseSuccess(
  blueprintId: string,
  userId: string,
  paymentIntentId: string,
  amountPaid: number
) {
  // Calculate platform fee (15%)
  const platformFeeCents = Math.round(amountPaid * 0.15);

  console.log(`[handleBlueprintPurchaseSuccess] Creating purchase: blueprint=${blueprintId}, user=${userId}, amount=${amountPaid}, paymentIntent=${paymentIntentId}`);

  // Create/update purchase record
  const { error: purchaseError } = await supabase
    .from('blueprint_purchases')
    .upsert({
      blueprint_id: blueprintId,
      buyer_id: userId,
      stripe_payment_intent_id: paymentIntentId,
      amount_paid_cents: amountPaid,
      platform_fee_cents: platformFeeCents,
      status: 'completed',
      purchased_at: new Date().toISOString(),
    }, {
      onConflict: 'blueprint_id,buyer_id',
    });

  if (purchaseError) {
    console.error('[handleBlueprintPurchaseSuccess] Failed to create blueprint purchase:', JSON.stringify(purchaseError));
    return;
  }
  console.log(`[handleBlueprintPurchaseSuccess] Purchase record created successfully`);

  // Auto-subscribe the buyer
  await supabase
    .from('blueprint_subscriptions')
    .upsert({
      blueprint_id: blueprintId,
      subscriber_id: userId,
      subscribed_at: new Date().toISOString(),
    }, {
      onConflict: 'blueprint_id,subscriber_id',
    });

  // Increment subscriber count
  await supabase.rpc('increment_blueprint_subscriber_count', {
    p_blueprint_id: blueprintId,
  }).then(({ error }) => {
    if (error) console.error('Failed to increment subscriber count:', error);
  });

  // Get blueprint and user info for notifications
  const { data: blueprint } = await supabase
    .from('timeline_blueprints')
    .select('title, user_id')
    .eq('id', blueprintId)
    .single();

  const { data: buyer } = await supabase
    .from('users')
    .select('email, full_name')
    .eq('id', userId)
    .single();

  // Notify the buyer
  if (buyer?.email) {
    try {
      await supabase.functions.invoke('send-email', {
        body: {
          to: buyer.email,
          subject: `Access Confirmed: ${blueprint?.title || 'Your Blueprint'}`,
          html: `
            <h2>Welcome to Your New Blueprint!</h2>
            <p>Hi ${buyer.full_name || 'there'},</p>
            <p>Your payment has been received and you now have access to:</p>
            <h3>${blueprint?.title || 'Your Blueprint'}</h3>
            <p>Add the steps to your timeline and start making progress!</p>
            <p>Thank you for choosing BetterAt!</p>
          `,
        },
      });
    } catch (emailError) {
      console.error('Failed to send blueprint purchase confirmation email:', emailError);
    }
  }

  // Notify the creator
  if (blueprint?.user_id) {
    const formattedAmount = (amountPaid / 100).toFixed(2);
    try {
      await supabase.functions.invoke('send-push-notification', {
        body: {
          recipients: [
            {
              userId: blueprint.user_id,
              title: 'New Blueprint Sale!',
              body: `${buyer?.full_name || 'Someone'} purchased "${blueprint.title}" for $${formattedAmount}`,
              data: { type: 'blueprint_purchase', blueprintId },
              category: 'payments',
            },
          ],
        },
      });
    } catch (pushError) {
      console.error('Failed to send blueprint sale push notification:', pushError);
    }
  }
}

/**
 * Handle failed payment intent
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const metadata = paymentIntent.metadata;
  const failureMessage = paymentIntent.last_payment_error?.message || 'Payment failed';

  if (metadata.type === 'race_entry' && metadata.entry_id) {
    await supabase
      .from('race_entries')
      .update({
        payment_status: 'failed',
        payment_error: failureMessage,
      })
      .eq('id', metadata.entry_id);
  }

  if (metadata.type === 'coaching_session' && metadata.session_id) {
    await supabase
      .from('coaching_sessions')
      .update({
        payment_status: 'failed',
      })
      .eq('id', metadata.session_id);
  }
}

/**
 * Handle checkout session completed
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const metadata = session.metadata || {};

  // Handle organization (club) subscription checkout
  if (metadata.type === 'org_subscription' && metadata.organization_id) {
    await handleOrgSubscriptionCheckout(session);
    return;
  }

  // Handle course purchase checkout
  if (metadata.type === 'course_purchase' && metadata.course_id && metadata.user_id) {
    // Create enrollment - checkout.session.completed is the primary event for course purchases
    await handleCoursePurchaseSuccess(
      metadata.course_id,
      metadata.user_id,
      session.payment_intent as string || session.id, // Use session ID if no payment intent
      session.amount_total || 0
    );
    
    // Also store the checkout session ID
    await supabase
      .from('learning_enrollments')
      .update({
        stripe_checkout_session_id: session.id,
      })
      .eq('user_id', metadata.user_id)
      .eq('course_id', metadata.course_id);
  }

  // Handle marketplace blueprint checkout (public.blueprints flow).
  // Distinguished from the legacy blueprint_purchase path by presence
  // of buyer_user_id (set by marketplace-blueprint-checkout) and the
  // absence of metadata.type.
  console.log(`[checkout.session.completed] metadata:`, JSON.stringify(metadata));
  console.log(`[checkout.session.completed] mode: ${session.mode}, payment_status: ${session.payment_status}, amount_total: ${session.amount_total}`);
  if (!metadata.type && metadata.blueprint_id && metadata.buyer_user_id) {
    await handleMarketplaceBlueprintCheckout(session);
    return;
  }

  if (metadata.type === 'blueprint_purchase' && metadata.blueprint_id && metadata.user_id) {
    if (session.mode === 'subscription' && session.subscription) {
      // Recurring blueprint subscription
      console.log(`[checkout.session.completed] Processing blueprint subscription: blueprint=${metadata.blueprint_id}, user=${metadata.user_id}`);
      await handleBlueprintSubscriptionCreated(
        metadata.blueprint_id,
        metadata.user_id,
        session.subscription as string,
        session.amount_total || 0
      );
    } else {
      // One-time blueprint purchase
      console.log(`[checkout.session.completed] Processing blueprint purchase: blueprint=${metadata.blueprint_id}, user=${metadata.user_id}`);
      await handleBlueprintPurchaseSuccess(
        metadata.blueprint_id,
        metadata.user_id,
        session.payment_intent as string || session.id,
        session.amount_total || 0
      );

      // Store checkout session ID on purchase
      await supabase
        .from('blueprint_purchases')
        .update({ stripe_checkout_session_id: session.id })
        .eq('buyer_id', metadata.user_id)
        .eq('blueprint_id', metadata.blueprint_id);
    }
  }
}

/**
 * Map a Stripe subscription status to the organization_subscriptions
 * status CHECK values (note the British "cancelled" spelling on this table).
 */
function mapOrgStatus(stripeStatus: string): string {
  const map: Record<string, string> = {
    active: 'active',
    trialing: 'trialing',
    past_due: 'past_due',
    unpaid: 'past_due',
    canceled: 'cancelled',
    incomplete: 'trialing',
    incomplete_expired: 'expired',
  };
  return map[stripeStatus] || 'active';
}

/**
 * Activate an organization (club) subscription after a successful
 * Stripe Checkout. Stamps the Stripe subscription id, period, and amount;
 * the trg_sync_org_member_tiers trigger then grants members the member tier.
 */
async function handleOrgSubscriptionCheckout(session: Stripe.Checkout.Session) {
  const metadata = session.metadata || {};
  const organizationId = metadata.organization_id;
  if (!organizationId) return;

  let stripeSubscriptionId: string | null = (session.subscription as string) ?? null;
  let stripePriceId: string | null = null;
  let amount: number | null = null;
  let currentPeriodStart: string | null = null;
  let currentPeriodEnd: string | null = null;
  let status = 'active';

  if (stripeSubscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      status = mapOrgStatus(sub.status);
      stripePriceId = sub.items.data[0]?.price?.id ?? null;
      amount = sub.items.data[0]?.price?.unit_amount ?? null;
      if (sub.current_period_start) {
        currentPeriodStart = new Date(sub.current_period_start * 1000).toISOString();
      }
      if (sub.current_period_end) {
        currentPeriodEnd = new Date(sub.current_period_end * 1000).toISOString();
      }
    } catch (err) {
      console.warn('[org.checkout] failed to retrieve subscription', err);
    }
  }

  const { error } = await supabase
    .from('organization_subscriptions')
    .upsert(
      {
        organization_id: organizationId,
        stripe_subscription_id: stripeSubscriptionId,
        stripe_customer_id: (session.customer as string) ?? null,
        stripe_price_id: stripePriceId,
        plan_id: metadata.plan_id || 'starter',
        status,
        member_tier: metadata.member_tier || 'pro',
        billing_period: metadata.billing_period || 'annual',
        amount,
        currency: session.currency ?? 'usd',
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        cancelled_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id' }
    );

  if (error) {
    console.error('[org.checkout] Failed to activate org subscription:', error);
    return;
  }

  console.log(
    `[org.checkout] Org ${organizationId} subscription ${stripeSubscriptionId} → ${status} (plan=${metadata.plan_id})`
  );
}

/**
 * Marketplace checkout.session.completed handler. Distinct from the
 * legacy blueprint_purchase path — this one is for the new
 * public.blueprints catalog + marketplace-blueprint-checkout flow.
 *
 * Writes a marketplace_subscriptions row, bumps active_seats on
 * org_author_payouts (or just records active seats for the author
 * even when no org payout row exists yet), and emits a published
 * audit event.
 */
async function handleMarketplaceBlueprintCheckout(session: Stripe.Checkout.Session) {
  const metadata = session.metadata || {};
  const blueprintId = metadata.blueprint_id;
  const buyerUserId = metadata.buyer_user_id;
  if (!blueprintId || !buyerUserId) return;

  // Load blueprint to discover author + org
  const { data: blueprint, error: bpErr } = await supabase
    .from('blueprints')
    .select('id, title, org_id, author_user_id, billing_cadence')
    .eq('id', blueprintId)
    .maybeSingle();
  if (bpErr || !blueprint) {
    console.warn('[marketplace.checkout] blueprint not found', blueprintId);
    return;
  }

  let trialEnd: string | null = null;
  let currentPeriodEnd: string | null = null;
  let subStatus: string = 'active';
  if (session.subscription) {
    try {
      const sub = await stripe.subscriptions.retrieve(session.subscription as string);
      if (sub.trial_end) trialEnd = new Date(sub.trial_end * 1000).toISOString();
      if (sub.current_period_end)
        currentPeriodEnd = new Date(sub.current_period_end * 1000).toISOString();
      subStatus = sub.status as string;
    } catch (err) {
      console.warn('[marketplace.checkout] failed to retrieve subscription', err);
    }
  }

  // Look up the price line item — for one-time, we still get amount_total
  const unitAmount = session.amount_total ?? 0;
  let stripePriceId: string | null = null;
  try {
    const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
    stripePriceId = items.data[0]?.price?.id ?? null;
  } catch (err) {
    console.warn('[marketplace.checkout] listLineItems failed', err);
  }

  const cadence = (blueprint.billing_cadence ?? 'monthly') as
    | 'monthly'
    | 'annual'
    | 'one_time';

  const { error: upsertErr } = await supabase
    .from('marketplace_subscriptions')
    .upsert(
      {
        blueprint_id: blueprintId,
        buyer_user_id: buyerUserId,
        author_user_id: blueprint.author_user_id ?? null,
        org_id: blueprint.org_id ?? null,
        stripe_subscription_id: (session.subscription as string) ?? null,
        stripe_customer_id: (session.customer as string) ?? null,
        stripe_price_id: stripePriceId,
        stripe_checkout_session_id: session.id,
        status: subStatus,
        unit_amount_cents: unitAmount,
        currency: session.currency ?? 'usd',
        cadence,
        trial_ends_at: trialEnd,
        current_period_end: currentPeriodEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'blueprint_id,buyer_user_id' },
    );
  if (upsertErr) {
    console.warn('[marketplace.checkout] marketplace_subscriptions upsert failed', upsertErr);
    return;
  }

  // Bump active_seats on the author's org_author_payouts row (if it exists).
  if (blueprint.author_user_id && blueprint.org_id) {
    await supabase.rpc('bump_author_active_seats', {
      p_org_id: blueprint.org_id,
      p_author_user_id: blueprint.author_user_id,
    }).then(({ error }) => {
      if (error) console.warn('[marketplace.checkout] bump_author_active_seats failed', error);
    });
  }

  // Materialize the blueprint's step templates into the buyer's
  // timeline_steps so they can actually practice the steps, not just
  // read them. Idempotent; service-role call bypasses the
  // active-subscription check (we just created the row).
  try {
    const { error: matErr } = await supabase.rpc('materialize_marketplace_blueprint', {
      p_blueprint_id: blueprintId,
      p_buyer_user_id: buyerUserId,
    });
    if (matErr) {
      console.warn('[marketplace.checkout] materialize failed', matErr);
    }
  } catch (err) {
    console.warn('[marketplace.checkout] materialize threw', err);
  }

  // Audit
  if (blueprint.org_id) {
    try {
      await supabase.from('audit_events').insert({
        org_id: blueprint.org_id,
        actor_user_id: buyerUserId,
        verb: 'published',
        verb_label: 'Subscribed via marketplace',
        target_type: 'blueprint',
        target_id: blueprintId,
        target_label: blueprint.title,
        description: `A new subscription started on "${blueprint.title}".`,
        payload: {
          stripe_session: session.id,
          stripe_subscription: session.subscription ?? null,
          unit_amount_cents: unitAmount,
          cadence,
        },
      });
    } catch (err) {
      console.warn('[marketplace.checkout] audit insert failed', err);
    }
  }
}

/**
 * Handle new blueprint subscription from checkout
 */
async function handleBlueprintSubscriptionCreated(
  blueprintId: string,
  userId: string,
  stripeSubscriptionId: string,
  amountPaid: number
) {
  const platformFeeCents = Math.round(amountPaid * 0.15);

  console.log(`[handleBlueprintSubscriptionCreated] blueprint=${blueprintId}, user=${userId}, sub=${stripeSubscriptionId}`);

  // Create purchase record for the first payment
  await supabase
    .from('blueprint_purchases')
    .upsert({
      blueprint_id: blueprintId,
      buyer_id: userId,
      stripe_payment_intent_id: stripeSubscriptionId,
      amount_paid_cents: amountPaid,
      platform_fee_cents: platformFeeCents,
      status: 'completed',
      purchased_at: new Date().toISOString(),
    }, { onConflict: 'blueprint_id,buyer_id' });

  // Create/update subscription record with Stripe subscription ID
  await supabase
    .from('blueprint_subscriptions')
    .upsert({
      blueprint_id: blueprintId,
      subscriber_id: userId,
      subscribed_at: new Date().toISOString(),
      stripe_subscription_id: stripeSubscriptionId,
      subscription_status: 'active',
    }, { onConflict: 'blueprint_id,subscriber_id' });

  // Increment subscriber count
  await supabase.rpc('increment_blueprint_subscriber_count', {
    p_blueprint_id: blueprintId,
  });

  // Notify creator
  const { data: blueprint } = await supabase
    .from('timeline_blueprints')
    .select('title, user_id')
    .eq('id', blueprintId)
    .single();

  const { data: buyer } = await supabase
    .from('users')
    .select('email, full_name')
    .eq('id', userId)
    .single();

  if (blueprint?.user_id) {
    const formattedAmount = (amountPaid / 100).toFixed(2);
    try {
      await supabase.functions.invoke('send-push-notification', {
        body: {
          recipients: [{
            userId: blueprint.user_id,
            title: 'New Blueprint Subscriber!',
            body: `${buyer?.full_name || 'Someone'} subscribed to "${blueprint.title}" ($${formattedAmount}/mo)`,
            data: { type: 'blueprint_subscription', blueprintId },
            category: 'payments',
          }],
        },
      });
    } catch (e) {
      console.error('Failed to send subscription push:', e);
    }
  }

  // Send confirmation email to buyer
  if (buyer?.email) {
    try {
      await supabase.functions.invoke('send-email', {
        body: {
          to: buyer.email,
          subject: `Subscription Confirmed: ${blueprint?.title || 'Blueprint'}`,
          html: `
            <h2>Welcome to Your New Blueprint!</h2>
            <p>Hi ${buyer.full_name || 'there'},</p>
            <p>Your subscription is active for:</p>
            <h3>${blueprint?.title || 'Your Blueprint'}</h3>
            <p>You'll receive new steps as the creator publishes them. Cancel anytime from your settings.</p>
            <p>Thank you for choosing BetterAt!</p>
          `,
        },
      });
    } catch (e) {
      console.error('Failed to send subscription email:', e);
    }
  }
}

/**
 * Handle subscription updates (platform subscriptions + blueprint subscriptions)
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const metadata = subscription.metadata || {};

  // ── Marketplace subscription update ──
  // Sync status, cancel_at_period_end, current_period_end so the buyer
  // surface reflects Stripe's source of truth.
  {
    const { data: ms } = await supabase
      .from('marketplace_subscriptions')
      .select('id, status, cancel_at_period_end, author_user_id, org_id')
      .eq('stripe_subscription_id', subscription.id)
      .maybeSingle();
    if (ms) {
      const update: Record<string, unknown> = {
        status: subscription.status,
        cancel_at_period_end: subscription.cancel_at_period_end ?? false,
        updated_at: new Date().toISOString(),
      };
      if (subscription.current_period_end) {
        update.current_period_end = new Date(
          subscription.current_period_end * 1000,
        ).toISOString();
      }
      if (subscription.trial_end) {
        update.trial_ends_at = new Date(subscription.trial_end * 1000).toISOString();
      }
      await supabase
        .from('marketplace_subscriptions')
        .update(update)
        .eq('id', ms.id);
      // Active count may shift on trialing→active or status transitions
      if (ms.author_user_id && ms.org_id) {
        await supabase.rpc('bump_author_active_seats', {
          p_org_id: ms.org_id,
          p_author_user_id: ms.author_user_id,
        });
      }
      console.log(
        `[handleSubscriptionUpdate] Marketplace sub ${subscription.id} → ${subscription.status} (cancel_at_period_end=${subscription.cancel_at_period_end})`,
      );
      return;
    }
  }

  // ── Organization (club) subscription update ──
  // Sync status + period so billing surfaces and member-tier grants
  // (trg_sync_org_member_tiers) reflect Stripe's source of truth.
  {
    const { data: orgSub } = await supabase
      .from('organization_subscriptions')
      .select('id, organization_id')
      .eq('stripe_subscription_id', subscription.id)
      .maybeSingle();
    if (orgSub) {
      const update: Record<string, unknown> = {
        status: mapOrgStatus(subscription.status),
        stripe_price_id: subscription.items.data[0]?.price?.id ?? null,
        amount: subscription.items.data[0]?.price?.unit_amount ?? null,
        updated_at: new Date().toISOString(),
      };
      if (subscription.current_period_start) {
        update.current_period_start = new Date(
          subscription.current_period_start * 1000
        ).toISOString();
      }
      if (subscription.current_period_end) {
        update.current_period_end = new Date(
          subscription.current_period_end * 1000
        ).toISOString();
      }
      if (subscription.canceled_at) {
        update.cancelled_at = new Date(subscription.canceled_at * 1000).toISOString();
      }
      await supabase
        .from('organization_subscriptions')
        .update(update)
        .eq('id', orgSub.id);
      if (customerId) {
        await syncOrgPaymentMethod(orgSub.organization_id, customerId);
      }
      console.log(
        `[handleSubscriptionUpdate] Org sub ${subscription.id} → ${mapOrgStatus(subscription.status)}`
      );
      return;
    }
  }

  // ── Blueprint subscription update ──
  if (metadata.type === 'blueprint_purchase' && metadata.blueprint_id) {
    const statusMap: Record<string, string> = {
      active: 'active', past_due: 'past_due', canceled: 'canceled',
      unpaid: 'unpaid', incomplete: 'unpaid', incomplete_expired: 'canceled',
    };
    const mappedStatus = statusMap[subscription.status] || 'active';

    await supabase
      .from('blueprint_subscriptions')
      .update({
        subscription_status: mappedStatus,
      })
      .eq('stripe_subscription_id', subscription.id);

    console.log(`[handleSubscriptionUpdate] Blueprint subscription ${subscription.id} → ${mappedStatus}`);
    return;
  }

  // ── Platform subscription update (existing logic) ──
  // Find user by Stripe customer ID
  const { data: user } = await supabase
    .from('users')
    .select('id, email, full_name')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!user) {
    console.error(`User not found for customer: ${customerId}`);
    return;
  }

  // Map subscription status
  const statusMap: Record<string, string> = {
    'active': 'active',
    'trialing': 'trialing',
    'past_due': 'past_due',
    'canceled': 'canceled',
    'incomplete': 'incomplete',
    'incomplete_expired': 'canceled',
    'unpaid': 'past_due',
  };

  // Get the price/product to determine tier.
  // Consumer subscription prices mirror Apple: Individual $9/$90, Pro $29/$290.
  const priceId = subscription.items.data[0]?.price.id;
  const tierMap: Record<string, string> = {
    'price_1Tft79BbfEeOhHXbC6kMnpSI': 'individual', // $9/mo
    'price_1TjCcsBbfEeOhHXbSwJroOny': 'individual', // $89/yr (current)
    'price_1Tft7ABbfEeOhHXbeIzYLCce': 'individual', // $90/yr (legacy)
    'price_1Tft7BBbfEeOhHXbdaVhs9Js': 'pro',        // $29/mo
    'price_1Tft7CBbfEeOhHXb0tr4xNnO': 'pro',        // $290/yr
  };

  const tier = tierMap[priceId] || 'individual';
  // subscriptions.plan_type is its own enum {basic, pro, enterprise} — distinct
  // from the subscription_tier enum used by `tier`. Map across them.
  const planTypeMap: Record<string, string> = {
    individual: 'basic',
    pro: 'pro',
    team: 'enterprise',
  };
  const planType = planTypeMap[tier] || 'basic';
  const isTeamPlan = tier === 'pro';
  const isNewOrReactivated = subscription.status === 'active';

  // Newer Stripe API versions moved current_period_* onto the subscription
  // item; the top-level fields are null. These columns are NOT NULL, so read
  // the item first, fall back to the (legacy) top level, then to now.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const item = subscription.items.data[0] as any;
  const periodStartUnix =
    item?.current_period_start ?? subscription.current_period_start;
  const periodEndUnix =
    item?.current_period_end ?? subscription.current_period_end;
  const nowIso = new Date().toISOString();
  const periodStartIso = periodStartUnix
    ? new Date(periodStartUnix * 1000).toISOString()
    : nowIso;
  const periodEndIso = periodEndUnix
    ? new Date(periodEndUnix * 1000).toISOString()
    : nowIso;

  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      user_id: user.id,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      status: statusMap[subscription.status] || subscription.status,
      tier: tier,
      plan_type: planType,
      price_id: priceId,
      current_period_start: periodStartIso,
      current_period_end: periodEndIso,
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
      trial_end: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
    });

  if (error) {
    console.error('Failed to update subscription:', error);
  }

  // Also update user record
  await supabase
    .from('users')
    .update({
      subscription_status: statusMap[subscription.status] || subscription.status,
      subscription_tier: tier,
    })
    .eq('id', user.id);

  // Create subscription team for Team plan subscribers
  if (isTeamPlan && isNewOrReactivated) {
    await ensureSubscriptionTeam(user.id, user.full_name, user.email);
  }
}

/**
 * Create or ensure subscription team exists for a user
 */
async function ensureSubscriptionTeam(userId: string, userName?: string, userEmail?: string) {
  // Check if user already has a team as owner
  const { data: existingTeam } = await supabase
    .from('subscription_teams')
    .select('id')
    .eq('owner_id', userId)
    .single();

  if (existingTeam) {
    // Already has a team, just ensure profile is linked
    await supabase
      .from('profiles')
      .update({ subscription_team_id: existingTeam.id })
      .eq('id', userId);
    return;
  }

  // Generate invite code
  const inviteCode = generateInviteCode();

  // Create new team
  const teamName = userName ? `${userName}'s Team` : 'My Team';
  const { data: newTeam, error: teamError } = await supabase
    .from('subscription_teams')
    .insert({
      owner_id: userId,
      name: teamName,
      max_seats: 5,
      invite_code: inviteCode,
    })
    .select()
    .single();

  if (teamError || !newTeam) {
    console.error('Failed to create subscription team:', teamError);
    return;
  }

  // Add owner as first member
  const { error: memberError } = await supabase
    .from('subscription_team_members')
    .insert({
      team_id: newTeam.id,
      user_id: userId,
      email: userEmail || '',
      role: 'owner',
      status: 'active',
      joined_at: new Date().toISOString(),
    });

  if (memberError) {
    console.error('Failed to add owner as team member:', memberError);
  }

  // Link profile to team
  await supabase
    .from('profiles')
    .update({ subscription_team_id: newTeam.id })
    .eq('id', userId);

  console.log(`Created subscription team ${newTeam.id} for user ${userId}`);
}

/**
 * Generate a random invite code
 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Handle subscription deletion
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const metadata = subscription.metadata || {};

  // ── Marketplace subscription canceled ──
  // (marketplace-blueprint-checkout doesn't set metadata.type, so this
  // catches first via the marketplace_subscriptions row lookup.)
  {
    const { data: ms } = await supabase
      .from('marketplace_subscriptions')
      .select('id, blueprint_id, author_user_id, org_id')
      .eq('stripe_subscription_id', subscription.id)
      .maybeSingle();
    if (ms) {
      await supabase
        .from('marketplace_subscriptions')
        .update({
          status: 'canceled',
          canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', ms.id);
      if (ms.author_user_id && ms.org_id) {
        await supabase.rpc('bump_author_active_seats', {
          p_org_id: ms.org_id,
          p_author_user_id: ms.author_user_id,
        });
      }
      console.log(`[handleSubscriptionDeleted] Marketplace subscription ${subscription.id} canceled`);
      return;
    }
  }

  // ── Organization (club) subscription canceled ──
  {
    const { data: orgSub } = await supabase
      .from('organization_subscriptions')
      .select('id')
      .eq('stripe_subscription_id', subscription.id)
      .maybeSingle();
    if (orgSub) {
      await supabase
        .from('organization_subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', orgSub.id);
      console.log(`[handleSubscriptionDeleted] Org subscription ${subscription.id} canceled`);
      return;
    }
  }

  // ── Blueprint subscription canceled (legacy) ──
  if (metadata.type === 'blueprint_purchase') {
    await supabase
      .from('blueprint_subscriptions')
      .update({ subscription_status: 'canceled' })
      .eq('stripe_subscription_id', subscription.id);

    console.log(`[handleSubscriptionDeleted] Blueprint subscription ${subscription.id} canceled`);
    return;
  }

  // ── Platform subscription canceled (existing logic) ──
  const customerId = subscription.customer as string;

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!user) return;

  await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id);

  await supabase
    .from('users')
    .update({
      subscription_status: 'canceled',
      subscription_tier: 'free',
    })
    .eq('id', user.id);

  // Handle subscription team cleanup
  await handleSubscriptionTeamCleanup(user.id);
}

/**
 * Clean up subscription team when subscription is canceled
 * - If user is team owner: update all team members to free tier
 * - If user is team member: remove them from the team
 */
async function handleSubscriptionTeamCleanup(userId: string) {
  // Check if user owns a team
  const { data: ownedTeam } = await supabase
    .from('subscription_teams')
    .select('id')
    .eq('owner_id', userId)
    .single();

  if (ownedTeam) {
    // User owns a team - downgrade all members to free tier
    const { data: members } = await supabase
      .from('subscription_team_members')
      .select('user_id')
      .eq('team_id', ownedTeam.id)
      .neq('user_id', userId);

    if (members && members.length > 0) {
      // Update all team members to free tier
      for (const member of members) {
        if (member.user_id) {
          await supabase
            .from('users')
            .update({
              subscription_tier: 'free',
              subscription_status: 'canceled',
            })
            .eq('id', member.user_id);

          // Remove their team link
          await supabase
            .from('profiles')
            .update({ subscription_team_id: null })
            .eq('id', member.user_id);
        }
      }
    }

    // Remove owner's team link
    await supabase
      .from('profiles')
      .update({ subscription_team_id: null })
      .eq('id', userId);

    console.log(`Cleaned up team ${ownedTeam.id} after owner subscription canceled`);
    return;
  }

  // Check if user is a team member (not owner)
  const { data: membership } = await supabase
    .from('subscription_team_members')
    .select('id, team_id')
    .eq('user_id', userId)
    .neq('role', 'owner')
    .single();

  if (membership) {
    // Remove user from team
    await supabase
      .from('subscription_team_members')
      .delete()
      .eq('id', membership.id);

    // Remove team link from profile
    await supabase
      .from('profiles')
      .update({ subscription_team_id: null })
      .eq('id', userId);

    console.log(`Removed user ${userId} from team ${membership.team_id}`);
  }
}

/** Unix seconds → YYYY-MM-DD, or null. */
function unixToDate(unix?: number | null): string | null {
  return unix ? new Date(unix * 1000).toISOString().slice(0, 10) : null;
}

/**
 * Resolve the organization_subscriptions row an invoice belongs to — by its
 * subscription id first, then its customer id. Returns null for invoices that
 * aren't tied to a club subscription (e.g. consumer invoices).
 */
async function resolveOrgSubscription(
  invoice: Stripe.Invoice,
): Promise<{ organization_id: string; seat_count: number | null } | null> {
  if (invoice.subscription) {
    const { data } = await supabase
      .from('organization_subscriptions')
      .select('organization_id, seat_count')
      .eq('stripe_subscription_id', invoice.subscription as string)
      .maybeSingle();
    if (data) return data;
  }
  if (invoice.customer) {
    const { data } = await supabase
      .from('organization_subscriptions')
      .select('organization_id, seat_count')
      .eq('stripe_customer_id', invoice.customer as string)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

/**
 * Sync an org's card-on-file onto organization_subscriptions so the Studio
 * billing surface shows the real payment method. Reads the customer's default
 * payment method (set by checkout / the billing portal), falling back to the
 * most recent attached card. Best-effort — never throws into the caller.
 */
async function syncOrgPaymentMethod(organizationId: string, customerId: string) {
  try {
    const customer = await stripe.customers.retrieve(customerId, {
      expand: ['invoice_settings.default_payment_method'],
    });
    if (!customer || (customer as Stripe.DeletedCustomer).deleted) return;

    let pm = (customer as Stripe.Customer).invoice_settings
      ?.default_payment_method as Stripe.PaymentMethod | null;
    if (!pm) {
      const list = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
        limit: 1,
      });
      pm = list.data[0] ?? null;
    }
    const card = pm?.card ?? null;
    if (!card) return;

    await supabase
      .from('organization_subscriptions')
      .update({
        payment_method_brand: card.brand ?? null,
        payment_method_last4: card.last4 ?? null,
        payment_method_exp_month: card.exp_month ?? null,
        payment_method_exp_year: card.exp_year ?? null,
      })
      .eq('organization_id', organizationId);
  } catch (e) {
    console.error('[syncOrgPaymentMethod] failed', e);
  }
}

/**
 * Handle a customer update — refresh the org's card-on-file when an admin
 * changes the default payment method through the Stripe billing portal.
 */
async function handleCustomerUpdated(customer: Stripe.Customer) {
  const { data: orgSub } = await supabase
    .from('organization_subscriptions')
    .select('organization_id')
    .eq('stripe_customer_id', customer.id)
    .maybeSingle();
  if (orgSub) {
    await syncOrgPaymentMethod(orgSub.organization_id, customer.id);
  }
}

/**
 * Handle paid invoice
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // First — check if this invoice belongs to a marketplace subscription
  // we're tracking, and if so, credit the author's payout row.
  if (invoice.subscription) {
    const { data: ms } = await supabase
      .from('marketplace_subscriptions')
      .select('blueprint_id, author_user_id, org_id, unit_amount_cents')
      .eq('stripe_subscription_id', invoice.subscription as string)
      .maybeSingle();
    if (ms && ms.author_user_id && ms.org_id) {
      // Use the blueprint's current author_payout_pct so changes apply
      // going forward (price/payout are stored on blueprints).
      const { data: bp } = await supabase
        .from('blueprints')
        .select('author_payout_pct')
        .eq('id', ms.blueprint_id)
        .maybeSingle();
      const amountPaid = invoice.amount_paid ?? 0;
      await supabase
        .rpc('credit_author_payout', {
          p_org_id: ms.org_id,
          p_author_user_id: ms.author_user_id,
          p_amount_cents: amountPaid,
          p_author_payout_pct: bp?.author_payout_pct ?? null,
        })
        .then(({ error }) => {
          if (error) console.warn('[invoice.paid] credit_author_payout failed', error);
        });
      // Audit
      try {
        await supabase.from('audit_events').insert({
          org_id: ms.org_id,
          actor_user_id: null,
          verb: 'config_change',
          verb_label: 'Marketplace invoice paid',
          target_type: 'blueprint',
          target_id: ms.blueprint_id,
          description: `An invoice cleared on a marketplace subscription.`,
          payload: {
            stripe_invoice: invoice.id,
            stripe_subscription: invoice.subscription,
            amount_paid_cents: amountPaid,
          },
        });
      } catch (err) {
        console.warn('[invoice.paid] audit insert failed', err);
      }
    }
  }

  // ── Organization (club) subscription invoice ──
  // Record into org_invoices so the Studio admin billing surface shows real
  // issued/paid invoices instead of an empty-state. Resolve the org via the
  // invoice's subscription first, then its customer. Returns early on a match —
  // an org invoice never belongs to a consumer (users) row below.
  {
    const orgSub = await resolveOrgSubscription(invoice);
    if (orgSub) {
      const createdDate = unixToDate(invoice.created)!;
      const lineQty = invoice.lines?.data?.[0]?.quantity ?? null;
      const { error: invErr } = await supabase
        .from('org_invoices')
        .upsert(
          {
            org_id: orgSub.organization_id,
            // invoice.number is the human-facing "ABCD-0001"; fall back to the id.
            invoice_number: invoice.number ?? invoice.id,
            period_start: unixToDate(invoice.period_start) ?? createdDate,
            period_end: unixToDate(invoice.period_end) ?? createdDate,
            // Flat Club tiers don't bill per seat; record the configured seat
            // allotment (or the line quantity) so the column stays meaningful.
            seats_billed: orgSub.seat_count ?? lineQty ?? 0,
            amount_cents: invoice.amount_paid ?? 0,
            status: 'paid',
            paid_at: unixToDate(invoice.status_transitions?.paid_at) ?? createdDate,
            due_at: unixToDate(invoice.due_date),
            pdf_url: invoice.invoice_pdf ?? null,
            stripe_invoice_id: invoice.id,
          },
          { onConflict: 'org_id,invoice_number' },
        );
      if (invErr) {
        console.error('[invoice.paid] org_invoices upsert failed', invErr);
      } else {
        console.log(
          `[invoice.paid] Recorded org invoice ${invoice.number ?? invoice.id} for org ${orgSub.organization_id}`,
        );
      }
      if (invoice.customer) {
        await syncOrgPaymentMethod(orgSub.organization_id, invoice.customer as string);
      }
      return;
    }
  }

  const customerId = invoice.customer as string;

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!user) return;

  // Record invoice
  await supabase
    .from('invoices')
    .upsert({
      user_id: user.id,
      stripe_invoice_id: invoice.id,
      amount_eur: Math.round((invoice.amount_paid || 0) / 100),
      currency: invoice.currency || 'eur',
      status: 'paid',
      invoice_pdf: invoice.invoice_pdf,
      paid_at: new Date().toISOString(),
      created_at: new Date(invoice.created * 1000).toISOString(),
    }, {
      onConflict: 'stripe_invoice_id',
    });
}

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  // Organization (club) subscription invoice — record it as past_due so the
  // Studio billing surface shows the open/overdue balance. Returns early; an
  // org invoice never belongs to a consumer (users) row below.
  {
    const orgSub = await resolveOrgSubscription(invoice);
    if (orgSub) {
      const createdDate = unixToDate(invoice.created)!;
      const lineQty = invoice.lines?.data?.[0]?.quantity ?? null;
      const { error: invErr } = await supabase
        .from('org_invoices')
        .upsert(
          {
            org_id: orgSub.organization_id,
            invoice_number: invoice.number ?? invoice.id,
            period_start: unixToDate(invoice.period_start) ?? createdDate,
            period_end: unixToDate(invoice.period_end) ?? createdDate,
            seats_billed: orgSub.seat_count ?? lineQty ?? 0,
            // Payment failed — record what's owed, not what cleared.
            amount_cents: invoice.amount_due ?? 0,
            status: 'past_due',
            paid_at: null,
            due_at: unixToDate(invoice.due_date),
            pdf_url: invoice.invoice_pdf ?? null,
            stripe_invoice_id: invoice.id,
          },
          { onConflict: 'org_id,invoice_number' },
        );
      if (invErr) {
        console.error('[invoice.payment_failed] org_invoices upsert failed', invErr);
      } else {
        console.log(
          `[invoice.payment_failed] Marked org invoice ${invoice.number ?? invoice.id} past_due for org ${orgSub.organization_id}`,
        );
      }
      return;
    }
  }

  const customerId = invoice.customer as string;

  const { data: user } = await supabase
    .from('users')
    .select('id, email')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!user) return;

  // Update subscription status
  await supabase
    .from('users')
    .update({
      subscription_status: 'past_due',
    })
    .eq('id', user.id);

  // Send payment failed email
  if (user.email) {
    await supabase.functions.invoke('send-email', {
      body: {
        to: user.email,
        subject: 'Payment Failed - RegattaFlow Subscription',
        html: `
          <h2>Payment Failed</h2>
          <p>We were unable to process your payment for your RegattaFlow subscription.</p>
          <p>Please update your payment method to continue enjoying premium features.</p>
          <p><a href="https://regattaflow.com/settings/billing">Update Payment Method</a></p>
        `,
      },
    });
  }
}

/**
 * Handle Stripe Connect account updates
 */
async function handleAccountUpdated(account: Stripe.Account) {
  // Update creator_stripe_accounts (generic creator table)
  const { error: creatorError } = await supabase
    .from('creator_stripe_accounts')
    .update({
      charges_enabled: account.charges_enabled ?? false,
      payouts_enabled: account.payouts_enabled ?? false,
      onboarding_complete: account.details_submitted ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_account_id', account.id);

  if (creatorError) {
    console.error('Failed to update creator_stripe_accounts:', creatorError);
  }

  // Also update legacy coach_profiles for backward compat
  await supabase
    .from('coach_profiles')
    .update({
      stripe_details_submitted: account.details_submitted,
      stripe_charges_enabled: account.charges_enabled,
      stripe_payouts_enabled: account.payouts_enabled,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_account_id', account.id);
}

/**
 * Handle transfer created (platform to connected account)
 */
async function handleTransferCreated(transfer: Stripe.Transfer) {
  // BUG 2: Use upsert to handle webhook retries gracefully
  const { error } = await supabase
    .from('platform_transfers')
    .upsert({
      stripe_transfer_id: transfer.id,
      destination_account: transfer.destination as string,
      amount: transfer.amount,
      currency: transfer.currency,
      created_at: new Date(transfer.created * 1000).toISOString(),
    }, {
      onConflict: 'stripe_transfer_id',
    });

  if (error) {
    console.error('Failed to log transfer:', error);
  }
}

/**
 * Handle payout to connected account
 */
async function handlePayoutPaid(payout: Stripe.Payout, accountId: string) {
  // Find creator by Stripe account (check generic table first, then legacy coach_profiles)
  let creatorUserId: string | null = null;
  let creatorCurrency: string | null = null;

  const { data: creator } = await supabase
    .from('creator_stripe_accounts')
    .select('user_id')
    .eq('stripe_account_id', accountId)
    .maybeSingle();

  if (creator) {
    creatorUserId = creator.user_id;
  }

  // Fallback to coach_profiles for legacy accounts
  const { data: coach } = await supabase
    .from('coach_profiles')
    .select('id, user_id, currency')
    .eq('stripe_account_id', accountId)
    .maybeSingle();

  if (coach) {
    creatorUserId = creatorUserId || coach.user_id;
    creatorCurrency = coach.currency;
  }

  if (coach) {
    // BUG 2: Use upsert to handle webhook retries gracefully
    await supabase
      .from('coach_payouts')
      .upsert({
        coach_id: coach.id,
        stripe_payout_id: payout.id,
        amount: payout.amount,
        currency: payout.currency,
        arrival_date: payout.arrival_date
          ? new Date(payout.arrival_date * 1000).toISOString()
          : null,
        status: 'paid',
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'stripe_payout_id',
      });

    // BUG 13: Use coach's configured currency symbol instead of hardcoded $
    const currencySymbol = getCurrencySymbol(coach.currency || payout.currency);
    const formattedAmount = (payout.amount / 100).toFixed(2);
    try {
      await supabase.functions.invoke('send-push-notification', {
        body: {
          recipients: [
            {
              userId: coach.user_id,
              title: 'Payout Arrived',
              body: `Your payout of ${currencySymbol}${formattedAmount} ${payout.currency.toUpperCase()} has arrived in your bank account`,
              data: { type: 'payout_paid', payoutId: payout.id },
              category: 'payments',
            },
          ],
        },
      });
    } catch (pushError) {
      console.error('Failed to send payout paid push notification:', pushError);
    }
  }
}

/**
 * Handle failed payout to connected account
 */
async function handlePayoutFailed(payout: Stripe.Payout, accountId: string) {
  // Find creator by Stripe account (check generic table first, then legacy)
  const { data: creator } = await supabase
    .from('creator_stripe_accounts')
    .select('user_id')
    .eq('stripe_account_id', accountId)
    .maybeSingle();

  const { data: coach } = await supabase
    .from('coach_profiles')
    .select('id, user_id, currency')
    .eq('stripe_account_id', accountId)
    .maybeSingle();

  if (coach) {
    // BUG 2: Use upsert to handle webhook retries gracefully
    // BUG 8: Persist failure_message alongside status update
    await supabase
      .from('coach_payouts')
      .upsert({
        coach_id: coach.id,
        stripe_payout_id: payout.id,
        amount: payout.amount,
        currency: payout.currency,
        arrival_date: null,
        status: 'failed',
        failure_message: payout.failure_message || null,
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'stripe_payout_id',
      });

    // BUG 13: Use coach's configured currency symbol instead of hardcoded $
    const currencySymbol = getCurrencySymbol(coach.currency || payout.currency);
    const formattedAmount = (payout.amount / 100).toFixed(2);
    const failureMessage = payout.failure_message || 'Please check your Stripe dashboard for details.';
    try {
      await supabase.functions.invoke('send-push-notification', {
        body: {
          recipients: [
            {
              userId: coach.user_id,
              title: 'Payout Failed',
              body: `Your payout of ${currencySymbol}${formattedAmount} ${payout.currency.toUpperCase()} failed. ${failureMessage}`,
              data: { type: 'payout_failed', payoutId: payout.id },
              category: 'payments',
            },
          ],
        },
      });
    } catch (pushError) {
      console.error('Failed to send payout failed push notification:', pushError);
    }
  }
}

/**
 * BUG 13: Map currency code to symbol
 */
function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    usd: '$',
    eur: '€',
    gbp: '£',
    hkd: 'HK$',
    aud: 'A$',
    nzd: 'NZ$',
    cad: 'C$',
    sgd: 'S$',
    jpy: '¥',
    chf: 'CHF ',
    sek: 'kr',
    dkk: 'kr',
    nok: 'kr',
  };
  return symbols[currency.toLowerCase()] || `${currency.toUpperCase()} `;
}

/**
 * BUG 10: Handle charge refund — update coaching session payment status and notify coach
 */
async function handleChargeRefunded(charge: Stripe.Charge) {
  const paymentIntentId = charge.payment_intent as string | null;

  // Marketplace refund debit — runs before the legacy coaching path so
  // a refund on a marketplace invoice rolls back the author payout
  // credit even if no coaching_sessions row matches.
  if (charge.invoice) {
    try {
      const invoice = await stripe.invoices.retrieve(charge.invoice as string);
      if (invoice.subscription) {
        const { data: ms } = await supabase
          .from('marketplace_subscriptions')
          .select('blueprint_id, author_user_id, org_id')
          .eq('stripe_subscription_id', invoice.subscription as string)
          .maybeSingle();
        if (ms && ms.author_user_id && ms.org_id) {
          const { data: bp } = await supabase
            .from('blueprints')
            .select('author_payout_pct, title')
            .eq('id', ms.blueprint_id)
            .maybeSingle();
          const refunded = charge.amount_refunded ?? 0;
          if (refunded > 0) {
            await supabase.rpc('credit_author_payout', {
              p_org_id: ms.org_id,
              p_author_user_id: ms.author_user_id,
              p_amount_cents: -refunded, // negative = debit
              p_author_payout_pct: bp?.author_payout_pct ?? null,
            }).then(({ error }) => {
              if (error) console.warn('[charge.refunded] credit_author_payout debit failed', error);
            });
            try {
              await supabase.from('audit_events').insert({
                org_id: ms.org_id,
                actor_user_id: null,
                verb: 'config_change',
                verb_label: 'Marketplace refund',
                target_type: 'blueprint',
                target_id: ms.blueprint_id,
                target_label: bp?.title ?? null,
                description: `Refund processed on a marketplace subscription — author credit reversed.`,
                payload: {
                  stripe_charge: charge.id,
                  stripe_invoice: charge.invoice,
                  amount_refunded_cents: refunded,
                  is_full_refund: charge.amount_refunded >= charge.amount,
                },
              });
            } catch (err) {
              console.warn('[charge.refunded] audit insert failed', err);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[charge.refunded] marketplace lookup failed', err);
    }
  }

  if (!paymentIntentId) return;

  // Find coaching session by payment intent
  const { data: session } = await supabase
    .from('coaching_sessions')
    .select('id, coach_id, sailor_id, title, total_amount')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle();

  if (!session) return;

  // Determine if full or partial refund
  const isFullRefund = charge.amount_refunded >= charge.amount;
  const refundStatus = isFullRefund ? 'refunded' : 'partially_refunded';

  // Update session payment status
  await supabase
    .from('coaching_sessions')
    .update({
      payment_status: refundStatus,
      refunded_amount: charge.amount_refunded,
    })
    .eq('id', session.id);

  // Notify the coach about the refund
  if (session.coach_id) {
    const { data: coach } = await supabase
      .from('coach_profiles')
      .select('user_id, currency')
      .eq('id', session.coach_id)
      .single();

    if (coach) {
      const currencySymbol = getCurrencySymbol(coach.currency || charge.currency);
      const refundedAmount = (charge.amount_refunded / 100).toFixed(2);
      try {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            recipients: [
              {
                userId: coach.user_id,
                title: 'Session Refund Processed',
                body: `A ${isFullRefund ? 'full' : 'partial'} refund of ${currencySymbol}${refundedAmount} was processed for "${session.title || 'coaching session'}"`,
                data: {
                  type: 'charge_refunded',
                  sessionId: session.id,
                  route: '/coach/my-bookings',
                },
                category: 'payments',
              },
            ],
          },
        });
      } catch (pushError) {
        console.error('Failed to send refund push notification:', pushError);
      }
    }
  }
}

/**
 * Trigger confirmation email via send-email function
 */
async function triggerConfirmationEmail(entityId: string, type: 'race_entry' | 'coaching_session') {
  try {
    if (type === 'race_entry') {
      // Get entry details
      const { data: entry } = await supabase
        .from('race_entries')
        .select(`
          *,
          users!sailor_id (email, full_name),
          regattas (event_name, start_date)
        `)
        .eq('id', entityId)
        .single();

      if (entry?.users?.email) {
        await supabase.functions.invoke('send-email', {
          body: {
            to: entry.users.email,
            subject: `Entry Confirmed: ${entry.regattas?.event_name || 'Race'}`,
            html: `
              <h2>Your Race Entry is Confirmed!</h2>
              <p>Hi ${entry.users?.full_name || 'Sailor'},</p>
              <p>Your payment has been received and your entry is confirmed.</p>
              <ul>
                <li><strong>Event:</strong> ${entry.regattas?.event_name}</li>
                <li><strong>Sail Number:</strong> ${entry.sail_number || 'TBD'}</li>
                <li><strong>Entry Number:</strong> ${entry.entry_number || 'TBD'}</li>
              </ul>
              <p>Good luck on the water!</p>
            `,
          },
        });
      }
    }

    if (type === 'coaching_session') {
      // Get session details
      const { data: session } = await supabase
        .from('coaching_sessions')
        .select(`
          *,
          sailor:users!coaching_sessions_sailor_id_fkey (email, full_name),
          coach:coach_profiles!coaching_sessions_coach_id_fkey (
            display_name,
            users (email, full_name)
          )
        `)
        .eq('id', entityId)
        .single();

      // Email to sailor
      if (session?.sailor?.email) {
        await supabase.functions.invoke('send-email', {
          body: {
            to: session.sailor.email,
            subject: 'Coaching Session Confirmed',
            html: `
              <h2>Your Coaching Session is Confirmed!</h2>
              <p>Hi ${session.sailor?.full_name || 'Sailor'},</p>
              <p>Your payment has been received and your coaching session is confirmed.</p>
              <p><strong>Coach:</strong> ${session.coach?.display_name || session.coach?.users?.full_name}</p>
              <p><strong>Date:</strong> ${new Date(session.scheduled_at).toLocaleString()}</p>
            `,
          },
        });
      }

      // Email to coach
      if (session?.coach?.users?.email) {
        await supabase.functions.invoke('send-email', {
          body: {
            to: session.coach.users.email,
            subject: 'New Coaching Session Booked',
            html: `
              <h2>New Session Booking!</h2>
              <p>Hi ${session.coach?.display_name},</p>
              <p>You have a new confirmed coaching session.</p>
              <p><strong>Student:</strong> ${session.sailor?.full_name || 'Sailor'}</p>
              <p><strong>Date:</strong> ${new Date(session.scheduled_at).toLocaleString()}</p>
              <p><strong>Amount:</strong> $${((session.coach_payout || 0) / 100).toFixed(2)}</p>
            `,
          },
        });
      }
    }
  } catch (error) {
    console.error('Failed to send confirmation email:', error);
  }
}

