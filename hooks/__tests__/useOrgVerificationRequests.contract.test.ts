jest.mock('@/services/OrgVerificationService', () => ({
  OrgVerificationService: {
    listRequests: jest.fn(),
    reviewRequest: jest.fn(),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { orgVerificationRequestsQueryKey } = require('../useOrgVerificationRequests');

describe('useOrgVerificationRequests contracts', () => {
  it('uses distinct query keys for every supported request scope', () => {
    expect(orgVerificationRequestsQueryKey()).toEqual([
      'admin',
      'org-verification-requests',
      'pending',
    ]);
    expect(orgVerificationRequestsQueryKey('history')).toEqual([
      'admin',
      'org-verification-requests',
      'history',
    ]);
    expect(orgVerificationRequestsQueryKey('all')).toEqual([
      'admin',
      'org-verification-requests',
      'all',
    ]);
  });
});
