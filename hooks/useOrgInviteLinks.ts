/**
 * useOrgInviteLinks — list / create / revoke tokenized invite URLs for
 * one org. Powers the AddPersonSheet "Share invite link" tab.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { logAuditEvent } from '@/services/auditLog';

export type InviteRole = 'member' | 'faculty' | 'preceptor' | 'admin';

export interface OrgInviteLink {
  id: string;
  token: string;
  label: string | null;
  roleKey: InviteRole;
  cohortId: string | null;
  autoSubscribe: boolean;
  maxUses: number | null;
  usesCount: number;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  url: string;
}

interface Row {
  id: string;
  token: string;
  label: string | null;
  role_key: InviteRole;
  cohort_id: string | null;
  auto_subscribe: boolean;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface CreateInviteLinkInput {
  label?: string | null;
  roleKey: InviteRole;
  cohortId?: string | null;
  autoSubscribe?: boolean;
  maxUses?: number | null;
  expiresAt?: string | null;
}

function generateToken(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  // URL-safe base32-ish from hex
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function baseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://betterat.app';
}

export function useOrgInviteLinks(orgId: string) {
  const queryClient = useQueryClient();
  const queryKey = ['org-invite-links', orgId];

  const { data: links = [], isLoading } = useQuery({
    queryKey,
    enabled: !!orgId,
    staleTime: 30_000,
    queryFn: async (): Promise<OrgInviteLink[]> => {
      const { data, error } = await supabase
        .from('org_invite_links')
        .select(
          'id, token, label, role_key, cohort_id, auto_subscribe, max_uses, uses_count, expires_at, revoked_at, created_at',
        )
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) {
        console.warn('[useOrgInviteLinks] query failed', error);
        return [];
      }
      const origin = baseUrl();
      return ((data ?? []) as Row[]).map((r) => ({
        id: r.id,
        token: r.token,
        label: r.label,
        roleKey: r.role_key,
        cohortId: r.cohort_id,
        autoSubscribe: r.auto_subscribe,
        maxUses: r.max_uses,
        usesCount: r.uses_count,
        expiresAt: r.expires_at,
        revokedAt: r.revoked_at,
        createdAt: r.created_at,
        url: `${origin}/redeem/${r.token}`,
      }));
    },
  });

  const create = useMutation({
    mutationFn: async (input: CreateInviteLinkInput) => {
      const token = generateToken();
      const { data, error } = await supabase
        .from('org_invite_links')
        .insert({
          org_id: orgId,
          token,
          label: input.label ?? null,
          role_key: input.roleKey,
          cohort_id: input.cohortId ?? null,
          auto_subscribe: input.autoSubscribe ?? true,
          max_uses: input.maxUses ?? null,
          expires_at: input.expiresAt ?? null,
        })
        .select('id')
        .single();
      if (error) throw error;
      return { id: data?.id, token, roleKey: input.roleKey };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey });
      void logAuditEvent({
        orgId,
        verb: 'config_change',
        verbLabel: 'Created invite link',
        description: `Created a ${result.roleKey} invite link.`,
        payload: { token: result.token, role_key: result.roleKey },
      });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-feed', orgId] });
    },
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('org_invite_links')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', id)
        .eq('org_id', orgId)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Invite link not found or no longer belongs to this organization.');
      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      void logAuditEvent({
        orgId,
        verb: 'config_change',
        verbLabel: 'Revoked invite link',
        description: 'Revoked an invite link.',
      });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-feed', orgId] });
    },
  });

  return {
    links,
    loading: isLoading,
    create,
    revoke,
  };
}
