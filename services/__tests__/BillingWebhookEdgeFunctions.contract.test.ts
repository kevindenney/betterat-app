import fs from 'node:fs';
import path from 'node:path';

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('billing webhook edge function contracts', () => {
  const stripeWebhookSource = read('supabase/functions/stripe-webhooks/index.ts');
  const revenueCatWebhookSource = read('supabase/functions/revenuecat-webhook/index.ts');
  const stripeMigrationSource = read(
    'supabase/migrations/20260220150000_stripe_webhook_idempotency_and_payment_tables.sql',
  );

  it('keeps Stripe signature verification before idempotency and side effects', () => {
    expect(stripeWebhookSource).toContain("req.headers.get('stripe-signature')");
    expect(stripeWebhookSource).toContain('stripe.webhooks.constructEventAsync');
    expect(stripeWebhookSource).toContain("return new Response('Invalid signature', { status: 400 })");

    const signatureIndex = stripeWebhookSource.indexOf('stripe.webhooks.constructEventAsync');
    const idempotencyIndex = stripeWebhookSource.indexOf(".from('stripe_webhook_events')");
    const switchIndex = stripeWebhookSource.indexOf('switch (event.type)');
    expect(signatureIndex).toBeGreaterThan(-1);
    expect(idempotencyIndex).toBeGreaterThan(signatureIndex);
    expect(switchIndex).toBeGreaterThan(idempotencyIndex);
  });

  it('uses the Stripe event insert as the race-safe idempotency gate', () => {
    expect(stripeMigrationSource).toContain('event_id TEXT NOT NULL UNIQUE');
    expect(stripeWebhookSource).toContain('const { error: insertEventError }');
    expect(stripeWebhookSource).toContain("insertEventError.code === '23505'");
    expect(stripeWebhookSource).toContain('concurrently-processed event');
    expect(stripeWebhookSource).toContain('Failed to record webhook event');

    const insertIndex = stripeWebhookSource.indexOf('const { error: insertEventError }');
    const duplicateIndex = stripeWebhookSource.indexOf("insertEventError.code === '23505'");
    const switchIndex = stripeWebhookSource.indexOf('switch (event.type)');
    expect(insertIndex).toBeGreaterThan(-1);
    expect(duplicateIndex).toBeGreaterThan(insertIndex);
    expect(switchIndex).toBeGreaterThan(duplicateIndex);
  });

  it('requires event.account before processing Connect-only Stripe events', () => {
    expect(stripeWebhookSource).toContain("'payout.paid', 'payout.failed', 'transfer.created'");
    expect(stripeWebhookSource).toContain('connectEventTypes.includes(event.type) && !event.account');
    expect(stripeWebhookSource).toContain('Missing event.account');

    const connectGuardIndex = stripeWebhookSource.indexOf('connectEventTypes.includes(event.type)');
    const transferHandlerIndex = stripeWebhookSource.indexOf('await handleTransferCreated');
    expect(connectGuardIndex).toBeGreaterThan(-1);
    expect(transferHandlerIndex).toBeGreaterThan(connectGuardIndex);
  });

  it('keeps RevenueCat shared-secret auth before parsing and service-role writes', () => {
    expect(revenueCatWebhookSource).toContain("req.headers.get('Authorization')");
    expect(revenueCatWebhookSource).toContain('auth !== WEBHOOK_SECRET');
    expect(revenueCatWebhookSource).toContain("return new Response(JSON.stringify({ error: 'Unauthorized' })");
    expect(revenueCatWebhookSource).toContain(".from('subscriptions')");
    expect(revenueCatWebhookSource).toContain("{ onConflict: 'user_id' }");

    const authIndex = revenueCatWebhookSource.indexOf('auth !== WEBHOOK_SECRET');
    const parseIndex = revenueCatWebhookSource.indexOf('await req.json()');
    const clientIndex = revenueCatWebhookSource.indexOf('createClient(supabaseUrl, supabaseServiceKey)');
    const upsertIndex = revenueCatWebhookSource.indexOf(".from('subscriptions')");
    expect(authIndex).toBeGreaterThan(-1);
    expect(parseIndex).toBeGreaterThan(authIndex);
    expect(clientIndex).toBeGreaterThan(parseIndex);
    expect(upsertIndex).toBeGreaterThan(clientIndex);
  });
});
