import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('useAdminPeople mutation contracts', () => {
  it('requires approve membership updates to match a row before reporting success', () => {
    const source = readSource('hooks/useAdminPeople.ts');

    expect(source).toContain('export function useApproveMembership');
    expect(source).toContain(".from('organization_memberships')");
    expect(source).toContain(".eq('id', membershipId)");
    expect(source).toContain(".eq('organization_id', orgId)");
    expect(source).toContain(".select('id')");
    expect(source).toContain('.maybeSingle()');
    expect(source).toContain('if (!data) throw new Error');
    expect(source).toContain('Membership could not be approved.');
  });
});
