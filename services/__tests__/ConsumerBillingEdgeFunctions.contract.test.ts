import fs from 'node:fs';
import path from 'node:path';

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('consumer billing edge function auth contracts', () => {
  const checkoutSource = read('supabase/functions/create-checkout-session/index.ts');
  const portalSource = read('supabase/functions/create-portal-session/index.ts');

  it('requires the authenticated user to match checkout userId before Stripe side effects', () => {
    expect(checkoutSource).toContain("req.headers.get('Authorization')");
    expect(checkoutSource).toContain('supabase.auth.getUser(token)');
    expect(checkoutSource).toContain('if (user.id !== userId)');
    expect(checkoutSource).toContain("jsonResponse({ error: 'Forbidden' }, 403)");

    const guardIndex = checkoutSource.indexOf('const authResponse = await requireUserSelf');
    const customerLookupIndex = checkoutSource.indexOf(".from('users')");
    const stripeIndex = checkoutSource.indexOf('stripe.checkout.sessions.create');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(customerLookupIndex).toBeGreaterThan(guardIndex);
    expect(stripeIndex).toBeGreaterThan(guardIndex);
  });

  it('requires the authenticated user to match portal userId before Stripe side effects', () => {
    expect(portalSource).toContain("req.headers.get('Authorization')");
    expect(portalSource).toContain('supabase.auth.getUser(token)');
    expect(portalSource).toContain('if (user.id !== userId)');
    expect(portalSource).toContain("jsonResponse({ error: 'Forbidden' }, 403)");

    const guardIndex = portalSource.indexOf('const authResponse = await requireUserSelf');
    const subscriptionLookupIndex = portalSource.indexOf(".from('subscriptions')");
    const stripeIndex = portalSource.indexOf('stripe.billingPortal.sessions.create');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(subscriptionLookupIndex).toBeGreaterThan(guardIndex);
    expect(stripeIndex).toBeGreaterThan(guardIndex);
  });
});
