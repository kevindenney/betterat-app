import {getActiveMembership, resolveActiveOrgId} from '../adminGate';

const ORG_ID = '11111111-1111-4111-8111-111111111111';

describe('organization admin gate membership resolution', () => {
  it('does not treat split-status memberships as active', () => {
    const memberships = [
      {
        organization_id: ORG_ID,
        role: 'admin',
        status: 'pending',
        membership_status: 'active',
      },
    ];

    expect(resolveActiveOrgId({activeOrganizationId: null,memberships})).toBeNull();
    expect(getActiveMembership({memberships,activeOrgId: ORG_ID})?.membershipStatus).toBe('pending');
  });

  it('keeps non-conflicting active memberships active', () => {
    const memberships = [
      {
        organization_id: ORG_ID,
        role: 'manager',
        status: 'verified',
        membership_status: 'active',
      },
    ];

    expect(resolveActiveOrgId({activeOrganizationId: null,memberships})).toBe(ORG_ID);
    expect(getActiveMembership({memberships,activeOrgId: ORG_ID})).toEqual({
      organizationId: ORG_ID,
      role: 'manager',
      membershipStatus: 'active',
    });
  });
});
