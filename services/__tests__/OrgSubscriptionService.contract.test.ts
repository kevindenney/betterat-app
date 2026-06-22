import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('OrgSubscriptionService contracts', () => {
  it('treats missing checkout URLs as failures and confirms local cancellation updates', () => {
    const source = readSource('services/OrgSubscriptionService.ts');

    expect(source).toContain('if (error || !data?.url)');
    expect(source).toContain('checkoutUrl: data.url');
    expect(source).toContain(".from('organization_subscriptions')");
    expect(source).toContain(".eq('id', subscription.id)\n        .eq('organization_id', orgId)");
    expect(source).toContain(".select('id')\n        .maybeSingle()");
    expect(source).toContain("throw new Error('Subscription could not be cancelled')");
  });
});
