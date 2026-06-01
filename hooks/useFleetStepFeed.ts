/**
 * useFleetStepFeed — recent step activity from active members of a fleet, for
 * the Watch tab's "By group" feed.
 *
 * A sail racer wants to read their fleet's practice steps (planning / doing /
 * reflecting), not the administrative fleet activity log. Following != fleet
 * membership, so this can't reuse useFollowedStepsFeed; instead it calls the
 * get_fleet_step_activity SECURITY DEFINER RPC, gated on active membership.
 *
 * Returns the FollowedStepItem shape so WatchCard renders it unchanged.
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

interface FleetStepRow {
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

export function useFleetStepFeed(
  fleetId: string | null | undefined,
  interestId?: string | null,
  limit = 50,
) {
  return useQuery({
    queryKey: ['fleet-step-feed', fleetId, interestId ?? null, limit],
    enabled: Boolean(fleetId),
    staleTime: 30_000,
    queryFn: async (): Promise<FollowedStepItem[]> => {
      if (!fleetId) return [];

      const { data, error } = await supabase.rpc('get_fleet_step_activity', {
        p_fleet_id: fleetId,
        p_interest_id: interestId ?? null,
        p_limit: limit,
      });
      if (error) {
        console.warn('[useFleetStepFeed] get_fleet_step_activity failed', error);
        return [];
      }

      const rows = (data ?? []) as FleetStepRow[];
      return rows.map((r): FollowedStepItem => {
        const name = r.person_name?.trim() || 'Sailor';
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
