import { SAILOR_SECONDARY_ITEMS, getNavItemsForUserType } from '../navigation-config';

describe('sailor secondary nav cleanup', () => {
  it('no longer ships a standalone Search item', () => {
    expect(SAILOR_SECONDARY_ITEMS.some((i) => i.key === 'search')).toBe(false);
  });

  it('omits the legacy Org Admin link even for an org admin (new surface is /admin/[orgId])', () => {
    const { secondary } = getNavItemsForUserType('sailor', undefined, {
      isOrgAdmin: true,
    } as any);
    expect(secondary.some((i) => i.key === 'org-admin')).toBe(false);
    expect(secondary.some((i) => i.route === '/organization/members')).toBe(false);
    expect(secondary.some((i) => i.key === 'search')).toBe(false);
  });
});
