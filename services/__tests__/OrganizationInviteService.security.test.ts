import fs from 'fs';
import path from 'path';

const mockFrom = jest.fn();
const mockRpc = jest.fn();
const mockGetUser = jest.fn().mockResolvedValue({
  data: { user: { id: 'user-test', email: 'tester@example.com' } },
  error: null,
});

jest.mock('../supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { organizationInviteService } = require('../OrganizationInviteService');

describe('OrganizationInviteService security regressions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enforces canonical invite update policy: no invitee direct table update path', () => {
    const transitionalMigrationPath = path.resolve(
      process.cwd(),
      'supabase/migrations/20260302193000_org_invite_invitee_status_updates.sql'
    );
    const canonicalMigrationPath = path.resolve(
      process.cwd(),
      'supabase/migrations/20260302213000_harden_org_invite_rls.sql'
    );

    const transitionalSql = fs.readFileSync(transitionalMigrationPath, 'utf8').replace(/\s+/g, ' ').toLowerCase();
    const canonicalSql = fs.readFileSync(canonicalMigrationPath, 'utf8').replace(/\s+/g, ' ').toLowerCase();

    // Transitional policy explicitly allowed invitee status-only transitions.
    expect(transitionalSql).toContain('and status in (\'opened\', \'accepted\', \'declined\')');
    expect(transitionalSql).toContain('lower(invitee_email) = lower(coalesce(auth.jwt() ->> \'email\', \'\'))');

    // Canonical policy removes invitee direct updates from table RLS.
    expect(canonicalSql).toContain('create policy "organization_invites_update_org_staff"');
    expect(canonicalSql).not.toContain('invitee_email');
    expect(canonicalSql).not.toContain('status in (\'opened\', \'accepted\', \'declined\')');
  });

  it('throws when non-management role is denied by RLS while creating invites', async () => {
    const single = jest.fn().mockResolvedValue({
      data: null,
      error: {
        code: '42501',
        message: 'new row violates row-level security policy for table "organization_invites"',
      },
    });
    const select = jest.fn(() => ({ single }));
    const insert = jest.fn(() => ({ select }));

    mockFrom.mockReturnValue({
      insert,
    });

    await expect(
      organizationInviteService.createInvite({
        organization_id: 'org-1',
        role_label: 'Race Committee',
        role_key: 'race_committee',
        invitee_email: 'invitee@example.com',
      })
    ).rejects.toMatchObject({
      code: '42501',
    });
  });

  it('generates an invite token when the caller does not provide one', async () => {
    const insertedInvite = {
      id: 'invite-generated',
      organization_id: 'org-1',
      role_label: 'Race Committee',
      role_key: 'race_committee',
      invite_token: 'generated-token-from-db-response',
      status: 'sent',
    };
    const single = jest.fn().mockResolvedValue({
      data: insertedInvite,
      error: null,
    });
    const select = jest.fn(() => ({ single }));
    const insert = jest.fn(() => ({ select }));

    mockFrom.mockReturnValue({
      insert,
    });

    await organizationInviteService.createInvite({
      organization_id: 'org-1',
      role_label: 'Race Committee',
      role_key: 'race_committee',
      invitee_email: 'invitee@example.com',
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        invite_token: expect.stringMatching(/^[a-z0-9]{24}$/),
      })
    );
  });

  it('preserves an explicit invite token from the caller', async () => {
    const inviteToken = 'caller-token-123';
    const single = jest.fn().mockResolvedValue({
      data: {
        id: 'invite-explicit',
        organization_id: 'org-1',
        invite_token: inviteToken,
        status: 'sent',
      },
      error: null,
    });
    const select = jest.fn(() => ({ single }));
    const insert = jest.fn(() => ({ select }));

    mockFrom.mockReturnValue({
      insert,
    });

    await organizationInviteService.createInvite({
      organization_id: 'org-1',
      role_label: 'Race Committee',
      role_key: 'race_committee',
      invite_token: inviteToken,
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        invite_token: inviteToken,
      })
    );
  });

  it('accepts invite via token RPC positive path', async () => {
    const inviteId = 'invite-1';
    const inviteToken = 'tok_123';
    const acceptedInvite = {
      id: inviteId,
      organization_id: 'org-1',
      role_label: 'Race Committee',
      role_key: 'race_committee',
      invite_token: inviteToken,
      status: 'accepted',
    };

    mockRpc
      .mockResolvedValueOnce({
        data: inviteToken,
        error: null,
      })
      .mockResolvedValueOnce({
        data: acceptedInvite,
        error: null,
      });

    const result = await organizationInviteService.acceptInviteForCurrentUser(inviteId);

    expect(mockRpc).toHaveBeenNthCalledWith(1, 'get_organization_invite_token_by_id', {
      p_invite_id: inviteId,
    });
    expect(mockRpc).toHaveBeenCalledWith('respond_to_organization_invite', {
      p_invite_token: inviteToken,
      p_decision: 'accepted',
    });
    expect(result).toMatchObject({
      id: inviteId,
      status: 'accepted',
    });
  });
});
