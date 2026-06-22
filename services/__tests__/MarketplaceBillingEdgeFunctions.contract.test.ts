import fs from 'node:fs';
import path from 'node:path';

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('marketplace billing edge function contracts', () => {
  const checkoutSource = read('supabase/functions/marketplace-blueprint-checkout/index.ts');
  const cancelSource = read('supabase/functions/marketplace-cancel-subscription/index.ts');

  it('requires an authenticated buyer before marketplace blueprint checkout side effects', () => {
    expect(checkoutSource).toContain("req.headers.get('Authorization')");
    expect(checkoutSource).toContain('supabase.auth.getUser');
    expect(checkoutSource).toContain("metadata: {\n        blueprint_id: blueprint.id,\n        buyer_user_id: user.id");
    expect(checkoutSource).toContain('client_reference_id: `${blueprint.id}:${user.id}`');
    expect(checkoutSource).toContain("blueprint.access_mode !== 'independent'");
    expect(checkoutSource).toContain('!blueprint.stripe_price_id');

    const authIndex = checkoutSource.indexOf('supabase.auth.getUser');
    const bodyIndex = checkoutSource.indexOf('await req.json()');
    const blueprintLookupIndex = checkoutSource.indexOf(".from('blueprints')");
    const stripeIndex = checkoutSource.indexOf('stripe.checkout.sessions.create');
    expect(authIndex).toBeGreaterThan(-1);
    expect(bodyIndex).toBeGreaterThan(authIndex);
    expect(blueprintLookupIndex).toBeGreaterThan(authIndex);
    expect(stripeIndex).toBeGreaterThan(blueprintLookupIndex);
  });

  it('routes marketplace checkout payouts only after loading the blueprint author account', () => {
    expect(checkoutSource).toContain(".from('creator_stripe_accounts')");
    expect(checkoutSource).toContain("transfer_data: { destination: destinationAccount }");
    expect(checkoutSource).toContain('application_fee_percent: platformFeePct');
    expect(checkoutSource).toContain('application_fee_amount: Math.round');

    const creatorLookupIndex = checkoutSource.indexOf(".from('creator_stripe_accounts')");
    const transferDataIndex = checkoutSource.indexOf('transfer_data: { destination: destinationAccount }');
    const stripeIndex = checkoutSource.indexOf('stripe.checkout.sessions.create');
    expect(creatorLookupIndex).toBeGreaterThan(-1);
    expect(transferDataIndex).toBeGreaterThan(creatorLookupIndex);
    expect(stripeIndex).toBeGreaterThan(transferDataIndex);
  });

  it('requires marketplace subscription ownership before cancellation side effects', () => {
    expect(cancelSource).toContain("req.headers.get('Authorization')");
    expect(cancelSource).toContain('supabase.auth.getUser');
    expect(cancelSource).toContain("row.buyer_user_id !== user.id");
    expect(cancelSource).toContain("JSON.stringify({ error: 'Subscription not found' })");
    expect(cancelSource).toContain('stripe.subscriptions.update');

    const authIndex = cancelSource.indexOf('supabase.auth.getUser');
    const bodyIndex = cancelSource.indexOf('await req.json()');
    const subscriptionLookupIndex = cancelSource.indexOf(".from('marketplace_subscriptions')");
    const ownershipIndex = cancelSource.indexOf('row.buyer_user_id !== user.id');
    const stripeIndex = cancelSource.indexOf('stripe.subscriptions.update');
    expect(authIndex).toBeGreaterThan(-1);
    expect(bodyIndex).toBeGreaterThan(authIndex);
    expect(subscriptionLookupIndex).toBeGreaterThan(bodyIndex);
    expect(ownershipIndex).toBeGreaterThan(subscriptionLookupIndex);
    expect(stripeIndex).toBeGreaterThan(ownershipIndex);
  });

  it('preserves already-canceled and already-scheduled marketplace cancel states', () => {
    expect(cancelSource).toContain("row.status === 'canceled'");
    expect(cancelSource).toContain('already_canceled: true');
    expect(cancelSource).toContain('row.cancel_at_period_end');
    expect(cancelSource).toContain('already_scheduled: true');

    const canceledIndex = cancelSource.indexOf("row.status === 'canceled'");
    const scheduledIndex = cancelSource.indexOf('row.cancel_at_period_end');
    const stripeIndex = cancelSource.indexOf('stripe.subscriptions.update');
    expect(canceledIndex).toBeGreaterThan(-1);
    expect(scheduledIndex).toBeGreaterThan(canceledIndex);
    expect(stripeIndex).toBeGreaterThan(scheduledIndex);
  });
});
