import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('OrgJoinService contracts', () => {
  it('confirms membership updates and re-reads unique-violation insert races', () => {
    const source = readSource('services/OrgJoinService.ts');

    expect(source).toContain("import { resolveOrgMembershipStatus } from '@/hooks/orgMembershipStatus'");
    expect(source).toContain('function joinResultFromStatus(status?: string): JoinResult | null');
    expect(source).toContain('const current = resolveOrgMembershipStatus(row)');
    expect(source).toContain('.update({ status: targetStatus, membership_status: targetStatus })');
    expect(source).toContain(".select('status,membership_status')");
    expect(source).toContain('.maybeSingle()');
    expect(source).toContain("throw new Error('Could not update your organization membership.')");
    expect(source).toContain('if (isUniqueViolation(error)) {');
    expect(source).toContain('const { data: raced, error: racedError } = await supabase');
    expect(source).toContain('resolveOrgMembershipStatus((raced as { membership_status?: string; status?: string } | null) ?? {})');
    expect(source).toContain("throw new Error('Could not confirm your organization membership.')");
  });
});
