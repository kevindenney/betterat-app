import fs from 'fs';
import path from 'path';

function readSql(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8').toLowerCase();
}

describe('yacht club claim review SQL contract', () => {
  it('rejects re-review of already-decided claims before mutating org state', () => {
    const sql = readSql('supabase/migrations/20260622111500_guard_yacht_club_claim_re_review.sql');

    expect(sql).toContain('create or replace function public.review_organization_claim');
    expect(sql).toContain("if v_claim.status <> 'pending' then");
    expect(sql).toContain("raise exception 'claim already decided: %'");
    expect(sql).toContain("verification_source,\n      verified_at");
    expect(sql).toContain("'admin',\n      now()");
    expect(sql).toContain("'verification_source', 'yacht_club_claim'");

    const guardIndex = sql.indexOf("if v_claim.status <> 'pending' then");
    const claimUpdateIndex = sql.indexOf('update public.organization_claims');
    const orgUpdateIndex = sql.indexOf('update public.organizations');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(claimUpdateIndex).toBeGreaterThan(guardIndex);
    expect(orgUpdateIndex).toBeGreaterThan(guardIndex);
  });
});
