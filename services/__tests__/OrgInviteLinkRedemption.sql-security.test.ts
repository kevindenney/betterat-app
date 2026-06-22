import fs from 'fs';
import path from 'path';

function readSql(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8').toLowerCase();
}

describe('org invite link redemption SQL contract', () => {
  it('claims max-use capacity atomically before membership side effects', () => {
    const sql = readSql('supabase/migrations/20260622110000_invite_link_atomic_redeem.sql');

    expect(sql).toContain('create or replace function public.redeem_invite_link');
    expect(sql).toContain('v_claimed_link public.org_invite_links%rowtype');
    expect(sql).toContain('update public.org_invite_links');
    expect(sql).toContain('set uses_count = uses_count + 1');
    expect(sql).toContain('and (max_uses is null or uses_count < max_uses)');
    expect(sql).toContain('returning * into v_claimed_link');
    expect(sql).toContain("raise exception 'this invite link has no remaining uses.'");

    const capacityClaimIndex = sql.indexOf('update public.org_invite_links');
    const membershipInsertIndex = sql.indexOf('insert into public.organization_memberships');
    expect(capacityClaimIndex).toBeGreaterThan(-1);
    expect(membershipInsertIndex).toBeGreaterThan(capacityClaimIndex);
  });
});
