/**
 * useAdminPersonPractice — backs /admin/[orgId]/person/[userId].
 *
 * Calls admin_person_practice_steps RPC (SECURITY DEFINER + admin gate).
 * Returns one row per step the user has logged for the given org, sorted
 * newest-first, with site name and the org-competencies the step evidenced.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export interface PersonPracticeStep {
  stepId: string;
  title: string;
  status: string;
  category: string;
  completedAt: string | null;
  createdAt: string | null;
  poiId: string | null;
  poiName: string | null;
  competencyShortLabels: string[];
  competencyFullLabels: string[];
}

type RpcRow = {
  step_id: string;
  title: string;
  status: string;
  category: string;
  completed_at: string | null;
  created_at: string | null;
  poi_id: string | null;
  poi_name: string | null;
  competency_short_labels: string[] | null;
  competency_full_labels: string[] | null;
};

export function useAdminPersonPractice(orgId: string, userId: string) {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['admin-person-practice', orgId, userId],
    enabled: !!orgId && !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<PersonPracticeStep[]> => {
      const { data: rows, error: rpcErr } = await supabase.rpc(
        'admin_person_practice_steps',
        { p_org_id: orgId, p_user_id: userId },
      );
      if (rpcErr) {
        console.warn('[useAdminPersonPractice] RPC failed', rpcErr);
        return [];
      }
      return ((rows ?? []) as RpcRow[]).map((r) => ({
        stepId: r.step_id,
        title: r.title,
        status: r.status,
        category: r.category,
        completedAt: r.completed_at,
        createdAt: r.created_at,
        poiId: r.poi_id,
        poiName: r.poi_name,
        competencyShortLabels: r.competency_short_labels ?? [],
        competencyFullLabels: r.competency_full_labels ?? [],
      }));
    },
  });

  return { steps: data, loading: isLoading, error };
}
