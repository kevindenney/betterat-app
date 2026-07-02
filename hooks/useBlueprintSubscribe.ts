/**
 * useBlueprintSubscribe — the single mutation behind BlueprintSubscribeSheet.
 *
 * Wraps the source-agnostic `subscribeToBlueprint` service (System-A peer,
 * institutional Studio, marketplace) and invalidates every surface that reads
 * subscriptions, timeline steps, Library Plans/counts, or follow-derived feeds.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { invalidateFollowQueries } from '@/hooks/followInvalidations';
import {
  subscribeToBlueprint,
  type BlueprintSystem,
  type EntryGranularity,
  type SubscribeToBlueprintResult,
} from '@/services/BlueprintSubscribeService';

export interface UseBlueprintSubscribeVars {
  blueprintId: string;
  blueprintSystem: BlueprintSystem;
  targetInterestId: string | null;
  entryGranularity: EntryGranularity;
  viewedSeasonId?: string | null;
}

export function useBlueprintSubscribe() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<SubscribeToBlueprintResult, Error, UseBlueprintSubscribeVars>({
    mutationFn: (vars) => {
      if (!user?.id) throw new Error('Must be logged in to subscribe');
      return subscribeToBlueprint({ userId: user.id, ...vars });
    },
    onSuccess: () => {
      // Subscription relationship + counts.
      queryClient.invalidateQueries({ queryKey: ['blueprint-subscriptions'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['blueprint-subscribed'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['blueprint-new-steps'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['blueprint-suggested-next'], refetchType: 'all' });
      // Materialized steps land on the timeline.
      queryClient.invalidateQueries({ queryKey: ['timeline-steps'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['for-you-suggestions'], refetchType: 'all' });
      // Library "Plans" zone + the assigned-blueprint surfaces.
      queryClient.invalidateQueries({ queryKey: ['library-plans'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['library-counts'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['library-zones-data'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['assigned-blueprints', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['assigned-blueprint-detail', user?.id] });
      // subscribeToBlueprint auto-follows the author.
      invalidateFollowQueries(queryClient, user?.id);
    },
  });
}
