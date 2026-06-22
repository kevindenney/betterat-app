import fs from 'node:fs';
import path from 'node:path';

import { isProfileMenuActiveMembership } from '../useProfileMenuData.logic';

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('useProfileMenuData active membership filtering', () => {
  it('accepts canonical active or verified status rows', () => {
    expect(isProfileMenuActiveMembership({status: 'active', membership_status: null})).toBe(true);
    expect(isProfileMenuActiveMembership({status: 'verified', membership_status: undefined})).toBe(true);
    expect(isProfileMenuActiveMembership({status: 'active', membership_status: 'verified'})).toBe(true);
  });

  it('rejects split-status rows where membership_status is active but canonical status is not', () => {
    expect(isProfileMenuActiveMembership({status: 'pending', membership_status: 'active'})).toBe(false);
    expect(isProfileMenuActiveMembership({status: 'rejected', membership_status: 'verified'})).toBe(false);
    expect(isProfileMenuActiveMembership({status: 'invited', membership_status: 'active'})).toBe(false);
  });

  it('rejects active canonical status when membership_status explicitly disagrees', () => {
    expect(isProfileMenuActiveMembership({status: 'active', membership_status: 'pending'})).toBe(false);
    expect(isProfileMenuActiveMembership({status: 'verified', membership_status: 'rejected'})).toBe(false);
  });

  it('uses the shared owner/admin/manager role helper for admin menu flags', () => {
    const source = read('hooks/useProfileMenuData.ts');

    expect(source).toContain("import { isOrgAdminRole } from '@/lib/organizations/roleLabels';");
    expect(source).toContain('is_admin: isOrgAdminRole(r.role)');
    expect(source).not.toContain("return r === 'admin' || r === 'owner' || r === 'administrator'");
  });
});
