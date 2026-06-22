import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('useOrgInviteLinks mutation contract', () => {
  it('requires revokes to affect a link owned by the current organization', () => {
    const source = readSource('hooks/useOrgInviteLinks.ts');

    expect(source).toContain(".from('org_invite_links')");
    expect(source).toContain(".update({ revoked_at: new Date().toISOString() })");
    expect(source).toContain(".eq('id', id)\n        .eq('org_id', orgId)");
    expect(source).toContain(".select('id')");
    expect(source).toContain('.maybeSingle()');
    expect(source).toContain("if (!data) throw new Error('Invite link not found or no longer belongs to this organization.')");
  });
});
