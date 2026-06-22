/**
 * useCohortStepFeed — recent step activity from members of an org cohort, for
 * the Watch tab's "Groups" lens (the cohort analogue of useFleetStepFeed).
 *
 * Fleets are sailing-only, so non-sailing interests have no fleet to read; a
 * nursing student's group is their JHU cohort. This calls the
 * get_cohort_step_activity SECURITY DEFINER RPC, gated on cohort membership and
 * excluding the viewer's own steps. Returns the FollowedStepItem shape so
 * WatchCard renders it unchanged.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { coarseLocationLabel } from '@/hooks/useNearestNamedPlace';
import type { FollowedStepItem, FollowedStepStatus } from '@/hooks/useFollowedStepsFeed';

const STATUS_MAP: Record<string, FollowedStepStatus> = {
  pending: 'planning',
  in_progress: 'doing',
  settled: 'reflected',
  completed: 'completed',
};

interface CohortStepRow {
  id: string;
  user_id: string;
  person_name: string | null;
  avatar_url: string | null;
  title: string | null;
  description: string | null;
  status: string | null;
  interest_id: string | null;
  organization_id: string | null;
  organization_name: string | null;
  source_blueprint_id: string | null;
  location_name: string | null;
  updated_at: string;
}

export function useCohortStepFeed(
  cohortId: string | null | undefined,
  interestId?: string | null,
  limit = 50,
) {
  return useQuery({
    queryKey: ['cohort-step-feed', cohortId, interestId ?? null, limit],
    enabled: Boolean(cohortId),
    staleTime: 30_000,
    queryFn: async (): Promise<FollowedStepItem[]> => {
      if (!cohortId) return [];

      const { data, error } = await supabase.rpc('get_cohort_step_activity', {
        p_cohort_id: cohortId,
        p_interest_id: interestId ?? null,
        p_limit: limit,
      });
      if (error) {
        console.warn('[useCohortStepFeed] get_cohort_step_activity failed', error);
        return [];
      }

      const rows = (data ?? []) as CohortStepRow[];
      return rows.map((r): FollowedStepItem => {
        const name = r.person_name?.trim() || 'A cohort member';
        return {
          id: r.id,
          personId: r.user_id,
          personName: name,
          personInitial: name.charAt(0).toUpperCase() || '?',
          personAvatarUrl: r.avatar_url ?? null,
          stepTitle: r.title ?? 'Untitled step',
          description: r.description,
          status: STATUS_MAP[r.status ?? ''] ?? 'planning',
          organizationName: r.organization_name ?? null,
          locationName: coarseLocationLabel(r.location_name),
          updatedAt: r.updated_at,
          sourceBlueprintId: r.source_blueprint_id,
          interestId: r.interest_id,
        };
      });
    },
  });
}
