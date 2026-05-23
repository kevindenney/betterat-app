/**
 * useAdminOrgRecentPractice — recent activity feed for /admin/[orgId]/overview.
 * Wraps admin_org_recent_practice_steps RPC.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export interface OrgRecentPracticeStep {
  stepId: string;
  userId: string;
  userName: string;
  userInitials: string;
  title: string;
  status: string;
  completedAt: string | null;
  createdAt: string | null;
  poiId: string | null;
  poiName: string | null;
  competencyShortLabels: string[];
}

type RpcRow = {
  step_id: string;
  user_id: string;
  user_name: string;
  user_initials: string;
  title: string;
  status: string;
  completed_at: string | null;
  created_at: string | null;
  poi_id: string | null;
  poi_name: string | null;
  competency_short_labels: string[] | null;
};

export function useAdminOrgRecentPractice(orgId: string, limit = 10) {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['admin-org-recent-practice', orgId, limit],
    enabled: !!orgId,
    staleTime: 30_000,
    queryFn: async (): Promise<OrgRecentPracticeStep[]> => {
      const { data: rows, error: rpcErr } = await supabase.rpc(
        'admin_org_recent_practice_steps',
        { p_org_id: orgId, p_limit: limit },
      );
      if (rpcErr) {
        console.warn('[useAdminOrgRecentPractice] RPC failed', rpcErr);
        return [];
      }
      return ((rows ?? []) as RpcRow[]).map((r) => ({
        stepId: r.step_id,
        userId: r.user_id,
        userName: r.user_name,
        userInitials: r.user_initials,
        title: r.title,
        status: r.status,
        completedAt: r.completed_at,
        createdAt: r.created_at,
        poiId: r.poi_id,
        poiName: r.poi_name,
        competencyShortLabels: r.competency_short_labels ?? [],
      }));
    },
  });

  return { steps: data, loading: isLoading, error };
}
