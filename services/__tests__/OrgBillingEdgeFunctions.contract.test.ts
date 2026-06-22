import fs from 'node:fs';
import path from 'node:path';

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('org billing edge function auth contracts', () => {
  const checkoutSource = read('supabase/functions/create-org-checkout-session/index.ts');
  const portalSource = read('supabase/functions/create-org-billing-portal-session/index.ts');

  it('requires an authenticated org admin before Stripe checkout side effects', () => {
    expect(checkoutSource).toContain("const ORG_ADMIN_ROLES = new Set(['owner', 'admin', 'manager'])");
    expect(checkoutSource).toContain("req.headers.get('Authorization')");
    expect(checkoutSource).toContain('supabase.auth.getUser(token)');
    expect(checkoutSource).toContain(".from('organization_memberships')");
    expect(checkoutSource).toContain(".select('role, status, membership_status')");
    expect(checkoutSource).toContain("status !== 'active'");
    expect(checkoutSource).toContain("jsonResponse({ error: 'Forbidden' }, 403)");

    const guardIndex = checkoutSource.indexOf('const authResponse = await requireOrgBillingAdmin');
    const stripeIndex = checkoutSource.indexOf('stripe.checkout.sessions.create');
    const upsertIndex = checkoutSource.indexOf(".from('organization_subscriptions').upsert");
    expect(guardIndex).toBeGreaterThan(-1);
    expect(stripeIndex).toBeGreaterThan(guardIndex);
    expect(upsertIndex).toBeGreaterThan(guardIndex);
  });

  it('requires an authenticated org admin before Stripe billing portal side effects', () => {
    expect(portalSource).toContain("const ORG_ADMIN_ROLES = new Set(['owner', 'admin', 'manager'])");
    expect(portalSource).toContain("req.headers.get('Authorization')");
    expect(portalSource).toContain('supabase.auth.getUser(token)');
    expect(portalSource).toContain(".from('organization_memberships')");
    expect(portalSource).toContain(".select('role, status, membership_status')");
    expect(portalSource).toContain("status !== 'active'");
    expect(portalSource).toContain("jsonResponse({ error: 'Forbidden' }, 403)");

    const guardIndex = portalSource.indexOf('const authResponse = await requireOrgBillingAdmin');
    const customerLookupIndex = portalSource.indexOf(".from('organization_subscriptions')");
    const stripeIndex = portalSource.indexOf('stripe.billingPortal.sessions.create');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(customerLookupIndex).toBeGreaterThan(guardIndex);
    expect(stripeIndex).toBeGreaterThan(guardIndex);
  });
});
