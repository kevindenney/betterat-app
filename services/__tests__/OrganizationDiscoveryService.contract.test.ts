import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('OrganizationDiscoveryService requestJoin contract', () => {
  it('recovers from membership insert races by re-reading the resulting membership', () => {
    const source = readSource('services/OrganizationDiscoveryService.ts');

    expect(source).toContain('function isUniqueViolation(error: unknown): boolean');
    expect(source).toContain("code?: string}).code === '23505'");
    expect(source).toContain('if (!isUniqueViolation(insertError)) throw insertError;');
    expect(source).toContain("const {data: racedRows, error: racedError} = await supabase");
    expect(source).toContain(".from('organization_memberships')");
    expect(source).toContain(".select('status,membership_status')");
    expect(source).toContain("message: 'Already a member.'");
    expect(source).toContain("message: 'Request already pending.'");
  });

  it('does not treat every existing membership as an active join result', () => {
    const source = readSource('services/OrganizationDiscoveryService.ts');
    const onboardingDiscovery = readSource('app/onboarding/org-discovery.tsx');
    const onboardingWelcome = readSource('app/onboarding/org-welcome.tsx');
    const orgBrowser = readSource('components/landing/OrganizationBrowserPage.tsx');
    const discoverOrg = readSource('app/discover/org/[slug].tsx');

    expect(source).toContain('export function isRequestJoinActive');
    expect(source).toContain(
      "result.status === 'existing' && result.membershipStatus === 'active'",
    );
    expect(source).toContain('export function isRequestJoinPending');
    for (const consumer of [
      onboardingDiscovery,
      onboardingWelcome,
      orgBrowser,
      discoverOrg,
    ]) {
      expect(consumer).toContain('isRequestJoinActive');
      expect(consumer).toContain('isRequestJoinPending');
      expect(consumer).not.toContain(
        "result.status === 'active' || result.status === 'existing'",
      );
    }
  });
});
