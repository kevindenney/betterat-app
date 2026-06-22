import { supabase } from './supabase';

export type OrganizationInviteStatus =
  | 'draft'
  | 'sent'
  | 'opened'
  | 'accepted'
  | 'declined'
  | 'revoked'
  | 'failed';

export type OrganizationInviteRecord = {
  id: string;
  organization_id: string;
  program_id: string | null;
  session_id: string | null;
  participant_id: string | null;
  invitee_name: string | null;
  invitee_email: string | null;
  invite_token: string | null;
  role_key: string | null;
  role_label: string;
  channel: 'email' | 'sms' | 'link';
  status: OrganizationInviteStatus;
  invited_by: string;
  sent_at: string | null;
  responded_at: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CreateOrganizationInviteInput = {
  organization_id: string;
  program_id?: string | null;
  session_id?: string | null;
  participant_id?: string | null;
  invitee_name?: string | null;
  invitee_email?: string | null;
  invite_token?: string | null;
  role_key?: string | null;
  role_label: string;
  channel?: 'email' | 'sms' | 'link';
  status?: OrganizationInviteStatus;
  sent_at?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
};

function generateInviteToken(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(24);
  const cryptoRef = typeof crypto !== 'undefined' ? crypto : null;
  if (cryptoRef?.getRandomValues) {
    cryptoRef.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

class OrganizationInviteService {
  async listOrganizationInvites(
    organizationId: string,
    limit: number = 100
  ): Promise<OrganizationInviteRecord[]> {
    const { data, error } = await supabase
      .from('organization_invites')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []) as OrganizationInviteRecord[];
  }

  async listPendingOrganizationInvites(
    organizationId: string,
    limit: number = 100
  ): Promise<OrganizationInviteRecord[]> {
    const { data, error } = await supabase
      .from('organization_invites')
      .select('*')
      .eq('organization_id', organizationId)
      .in('status', ['draft', 'sent', 'opened'])
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []) as OrganizationInviteRecord[];
  }

  async createInvite(input: CreateOrganizationInviteInput): Promise<OrganizationInviteRecord> {
    const metadata = ((input.metadata || {}) as Record<string, unknown>);
    const roleKeyFromMetadata = typeof metadata.role_key === 'string' ? metadata.role_key : null;
    const roleLabelFromMetadata = typeof metadata.role_label === 'string' ? metadata.role_label : null;
    const resolvedRoleKey = input.role_key ?? roleKeyFromMetadata;
    const resolvedRoleLabel = input.role_label || roleLabelFromMetadata || 'Team Member';
    const inviteToken = input.invite_token?.trim() || generateInviteToken();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required to create invites.');

    const { data, error } = await supabase
      .from('organization_invites')
      .insert({
        organization_id: input.organization_id,
        program_id: input.program_id ?? null,
        session_id: input.session_id ?? null,
        participant_id: input.participant_id ?? null,
        invitee_name: input.invitee_name ?? null,
        invitee_email: input.invitee_email ?? null,
        invite_token: inviteToken,
        role_key: resolvedRoleKey,
        role_label: resolvedRoleLabel,
        channel: input.channel ?? 'email',
        status: input.status ?? 'sent',
        invited_by: user.id,
        sent_at: input.sent_at ?? new Date().toISOString(),
        notes: input.notes ?? null,
        metadata: {
          ...metadata,
          role_key: resolvedRoleKey,
          role_label: resolvedRoleLabel,
        },
      })
      .select('*')
      .single();
    if (error) throw error;
    return data as OrganizationInviteRecord;
  }

  async getInviteByToken(inviteToken: string): Promise<OrganizationInviteRecord | null> {
    const token = String(inviteToken || '').trim();
    if (!token) return null;

    const { data, error } = await supabase.rpc('get_organization_invite_by_token', {
      p_invite_token: token,
    });

    if (error) {
      throw error;
    }
    return (data as OrganizationInviteRecord | null) ?? null;
  }

  async markInviteOpenedByToken(inviteToken: string): Promise<OrganizationInviteRecord | null> {
    const token = String(inviteToken || '').trim();
    if (!token) return null;

    const { data, error } = await supabase.rpc('mark_organization_invite_opened', {
      p_invite_token: token,
    });
    if (error) throw error;
    return (data as OrganizationInviteRecord | null) ?? null;
  }

  async updateInviteStatus(
    inviteId: string,
    status: OrganizationInviteStatus,
    respondedAt: string | null = null,
    notes: string | null = null
  ): Promise<OrganizationInviteRecord> {
    const updates: Record<string, unknown> = {
      status,
      responded_at: respondedAt,
    };
    if (notes !== null) {
      updates.notes = notes;
    }

    const { data, error } = await supabase
      .from('organization_invites')
      .update(updates)
      .eq('id', inviteId)
      .select('*')
      .single();
    if (error) throw error;
    return data as OrganizationInviteRecord;
  }

  async acceptInviteForCurrentUser(inviteId: string): Promise<OrganizationInviteRecord> {
    const { data: inviteToken, error: inviteError } = await supabase.rpc(
      'get_organization_invite_token_by_id',
      { p_invite_id: inviteId }
    );
    if (inviteError) throw inviteError;

    const token = String(inviteToken || '').trim();
    if (!token) {
      throw new Error('Invite token is missing.');
    }

    return this.respondToInviteToken(token, 'accepted');
  }

  async acceptInviteTokenForCurrentUser(inviteToken: string): Promise<OrganizationInviteRecord> {
    const token = String(inviteToken || '').trim();
    if (!token) {
      throw new Error('Invite token is missing.');
    }
    return this.respondToInviteToken(token, 'accepted');
  }

  async respondToInviteToken(
    inviteToken: string,
    decision: 'accepted' | 'declined'
  ): Promise<OrganizationInviteRecord> {
    const token = String(inviteToken || '').trim();
    if (!token) {
      throw new Error('Invite token is missing.');
    }

    const { data, error } = await supabase.rpc('respond_to_organization_invite', {
      p_invite_token: token,
      p_decision: decision,
    });
    if (error) throw error;

    if (!data) {
      throw new Error('Invite not found.');
    }
    return data as OrganizationInviteRecord;
  }

  async acceptInviteByTokenForCurrentUser(inviteToken: string): Promise<OrganizationInviteRecord> {
    return this.acceptInviteTokenForCurrentUser(inviteToken);
  }

  async declineInviteByTokenForCurrentUser(inviteToken: string): Promise<OrganizationInviteRecord> {
    const token = String(inviteToken || '').trim();
    if (!token) {
      throw new Error('Invite token is missing.');
    }
    return this.respondToInviteToken(token, 'declined');
  }

  async declineInviteForCurrentUser(inviteId: string): Promise<OrganizationInviteRecord> {
    const { data: inviteToken, error: inviteError } = await supabase.rpc(
      'get_organization_invite_token_by_id',
      { p_invite_id: inviteId }
    );
    if (inviteError) throw inviteError;
    const token = String(inviteToken || '').trim();
    if (!token) {
      throw new Error('Invite token is missing.');
    }
    return this.respondToInviteToken(token, 'declined');
  }
}

export const organizationInviteService = new OrganizationInviteService();
