/**
 * useInviteRedemption — read + redeem an org_invite_links token by its
 * public token. resolve is anon-safe; redeem requires a session.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export type InviteLinkStatus = 'active' | 'expired' | 'revoked' | 'exhausted';

export interface InviteLinkPreview {
  ok: boolean;
  reason?: 'not_found';
  status?: InviteLinkStatus;
  orgId?: string;
  orgName?: string;
  orgShortName?: string;
  roleKey?: 'member' | 'faculty' | 'preceptor' | 'admin';
  cohortId?: string | null;
  cohortName?: string | null;
  autoSubscribe?: boolean;
  maxUses?: number | null;
  usesCount?: number;
  expiresAt?: string | null;
}

interface ResolveRow {
  ok: boolean;
  reason?: 'not_found';
  status?: InviteLinkStatus;
  org_id?: string;
  org_name?: string;
  org_short_name?: string;
  role_key?: 'member' | 'faculty' | 'preceptor' | 'admin';
  cohort_id?: string | null;
  cohort_name?: string | null;
  auto_subscribe?: boolean;
  max_uses?: number | null;
  uses_count?: number;
  expires_at?: string | null;
}

interface RedeemResult {
  ok: boolean;
  orgId: string;
  role: string;
  cohortId: string | null;
  alreadyMember: boolean;
}

export function useInviteRedemption(token: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['invite-link-preview', token];

  const { data: preview, isLoading } = useQuery({
    queryKey,
    enabled: !!token,
    staleTime: 30_000,
    queryFn: async (): Promise<InviteLinkPreview> => {
      const { data, error } = await supabase.rpc('resolve_invite_link', {
        p_token: token,
      });
      if (error) {
        console.warn('[useInviteRedemption] resolve failed', error);
        return { ok: false, reason: 'not_found' };
      }
      const row = (data ?? {}) as ResolveRow;
      if (!row.ok) return { ok: false, reason: row.reason };
      return {
        ok: true,
        status: row.status,
        orgId: row.org_id,
        orgName: row.org_name,
        orgShortName: row.org_short_name,
        roleKey: row.role_key,
        cohortId: row.cohort_id,
        cohortName: row.cohort_name,
        autoSubscribe: row.auto_subscribe,
        maxUses: row.max_uses ?? null,
        usesCount: row.uses_count ?? 0,
        expiresAt: row.expires_at ?? null,
      };
    },
  });

  const redeem = useMutation({
    mutationFn: async (): Promise<RedeemResult> => {
      const { data, error } = await supabase.rpc('redeem_invite_link', {
        p_token: token,
      });
      if (error) throw new Error(error.message);
      const row = (data ?? {}) as {
        ok: boolean;
        org_id: string;
        role: string;
        cohort_id: string | null;
        already_member: boolean;
      };
      return {
        ok: row.ok,
        orgId: row.org_id,
        role: row.role,
        cohortId: row.cohort_id,
        alreadyMember: row.already_member,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['org-invite-links'] });
    },
  });

  return {
    preview: preview ?? null,
    loading: isLoading,
    redeem,
  };
}
