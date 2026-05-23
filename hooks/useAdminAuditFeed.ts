/**
 * useAdminAuditFeed — admin audit log feed for /admin/[orgId]/audit.
 * Wraps admin_audit_feed RPC (SECURITY DEFINER + is_org_admin_member gate).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export type AuditVerb =
  | 'role_changed'
  | 'published'
  | 'invited'
  | 'edited'
  | 'claimed'
  | 'removed'
  | 'sso_config'
  | 'cohort_edit'
  | 'blueprint_publish'
  | 'site_claim'
  | 'membership_added'
  | 'membership_removed'
  | 'login'
  | 'config_change';

export type AuditTone = 'navy' | 'brown' | 'warm' | 'green';

export interface AuditEvent {
  id: string;
  occurredAt: string;
  actorUserId: string | null;
  actorName: string;
  actorInitials: string;
  actorTone: AuditTone;
  verb: AuditVerb;
  verbLabel: string;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  description: string;
  payload: Record<string, unknown>;
  ip: string | null;
  userAgent: string | null;
}

type RpcRow = {
  id: string;
  occurred_at: string;
  actor_user_id: string | null;
  actor_name: string;
  actor_initials: string;
  actor_tone: string;
  verb: string;
  verb_label: string;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  description: string;
  payload: Record<string, unknown>;
  ip: string | null;
  user_agent: string | null;
};

export function useAdminAuditFeed(orgId: string, limit = 50) {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['admin-audit-feed', orgId, limit],
    enabled: !!orgId,
    staleTime: 30_000,
    queryFn: async (): Promise<AuditEvent[]> => {
      const { data: rows, error: rpcErr } = await supabase.rpc('admin_audit_feed', {
        p_org_id: orgId,
        p_limit: limit,
      });
      if (rpcErr) {
        console.warn('[useAdminAuditFeed] RPC failed', rpcErr);
        return [];
      }
      return ((rows ?? []) as RpcRow[]).map((r) => ({
        id: r.id,
        occurredAt: r.occurred_at,
        actorUserId: r.actor_user_id,
        actorName: r.actor_name,
        actorInitials: r.actor_initials,
        actorTone: (r.actor_tone as AuditTone) ?? 'navy',
        verb: r.verb as AuditVerb,
        verbLabel: r.verb_label,
        targetType: r.target_type,
        targetId: r.target_id,
        targetLabel: r.target_label,
        description: r.description,
        payload: r.payload ?? {},
        ip: r.ip,
        userAgent: r.user_agent,
      }));
    },
  });

  return { events: data, loading: isLoading, error };
}
