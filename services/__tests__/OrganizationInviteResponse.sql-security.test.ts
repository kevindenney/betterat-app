import fs from 'fs';
import path from 'path';

function readSql(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8').toLowerCase();
}

describe('organization invite response SQL contract', () => {
  it('keeps status and membership_status aligned when accepting invites', () => {
    const sql = readSql('supabase/migrations/20260622113000_align_org_invite_membership_status.sql');

    expect(sql).toContain('create or replace function public.respond_to_organization_invite');
    expect(sql).toContain('membership_status,');
    expect(sql).toContain("'active',\n      true,\n      'invite'");
    expect(sql).toContain('membership_status = case');
    expect(sql).toContain("then 'active'");
    expect(sql).toContain("status = 'active' and membership_status = 'active'");
    expect(sql).toContain('public.can_inviter_issue_org_invite_role');

    const insertIndex = sql.indexOf('insert into public.organization_memberships');
    const membershipStatusIndex = sql.indexOf('membership_status,', insertIndex);
    const conflictIndex = sql.indexOf('on conflict (organization_id, user_id)');
    const updateMembershipStatusIndex = sql.indexOf('membership_status = case', conflictIndex);
    expect(insertIndex).toBeGreaterThan(-1);
    expect(membershipStatusIndex).toBeGreaterThan(insertIndex);
    expect(updateMembershipStatusIndex).toBeGreaterThan(conflictIndex);
  });
});
