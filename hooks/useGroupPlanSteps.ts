/**
 * useGroupPlanSteps — the attached blueprint's steps, in order, for a group's
 * shared prep timeline.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export interface GroupPlanStep {
  id: string;
  title: string | null;
  description: string | null;
  category: string | null;
  status: 'pending';
}

export function useGroupPlanSteps(
  groupId: string | null | undefined,
  enabled: boolean,
) {
  return useQuery<GroupPlanStep[]>({
    queryKey: ['group-plan-steps', groupId],
    enabled: Boolean(groupId) && enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_affinity_group_plan_steps', { p_group_id: groupId as string });
      if (error) throw error;
      return ((data ?? []) as {
        id: string;
        title: string | null;
        description: string | null;
        category: string | null;
      }[]).map((row) => ({ ...row, status: 'pending' as const }));
    },
  });
}
