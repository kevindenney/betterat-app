import { organizationInviteRolePresetService } from '../OrganizationInviteRolePresetService';

const mockListDomainCatalog = jest.fn();

jest.mock('../ProgramService', () => ({
  programService: {
    listDomainCatalog: (...args: unknown[]) => mockListDomainCatalog(...args),
  },
}));

describe('OrganizationInviteRolePresetService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads role_type metadata and resolves default role from priority', async () => {
    mockListDomainCatalog.mockResolvedValueOnce([
      {
        key: 'program_director',
        value: 'Program Director',
        metadata: { invite_label: 'Invite Program Director', role_type: 'manager' },
      },
      {
        key: 'clinical_preceptor',
        value: 'Clinical Preceptor',
        metadata: { invite_label: 'Invite Clinical Preceptor', role_type: 'preceptor' },
      },
    ]);

    const presets = await organizationInviteRolePresetService.listPresets('nursing');
    expect(presets).toHaveLength(2);
    expect(presets[0].roleType).toBe('manager');
    expect(presets[1].roleType).toBe('preceptor');
    expect(organizationInviteRolePresetService.resolveDefaultRoleLabel(presets)).toBe('Clinical Preceptor');
  });

  it('classifies staff roles from preset role_type and fallback labels', () => {
    const presets = [
      {
        key: 'race_committee',
        role: 'Race Committee',
        label: 'Invite Race Committee',
        roleType: 'staff',
      },
    ];

    expect(organizationInviteRolePresetService.isStaffRole('Race Committee', presets)).toBe(true);
    expect(organizationInviteRolePresetService.isStaffRole('Faculty', [])).toBe(true);
    expect(organizationInviteRolePresetService.isStaffRole('Learner', presets)).toBe(false);
  });
});
