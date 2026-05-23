/**
 * useStepFellowSubscribers — Section H peers count for a given step.
 *
 * Counts how many OTHER users are subscribed to the same blueprint
 * (which is the cohort the design's "WITH N peers" refers to). Built
 * on the same `blueprint_subscriptions` table that
 * `computeFleetPosition` reads in the celebration view, so the row
 * count we surface here is consistent with what shows up at step
 * completion.
 *
 * Returns 0 when the step has no source blueprint (manual / template).
 * Returns 0 (not null) on auth gap so the UI can render a stable
 * empty state without flicker.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';

interface UseStepFellowSubscribersInput {
  blueprintId: string | null | undefined;
}

export function useStepFellowSubscribers({
  blueprintId,
}: UseStepFellowSubscribersInput) {
  const { user } = useAuth();
  const viewerId = user?.id ?? null;
  return useQuery<{ totalPeers: number }>({
    queryKey: ['step-fellow-subscribers', blueprintId, viewerId],
    queryFn: async () => {
      if (!blueprintId || !viewerId) return { totalPeers: 0 };
      const { data, error } = await supabase
        .from('blueprint_subscriptions')
        .select('subscriber_id')
        .eq('blueprint_id', blueprintId);
      if (error) return { totalPeers: 0 };
      const ids = ((data as { subscriber_id: string }[] | null) ?? [])
        .map((s) => s.subscriber_id)
        .filter((id) => id !== viewerId);
      return { totalPeers: ids.length };
    },
    enabled: Boolean(blueprintId && viewerId),
    staleTime: 60 * 1000,
  });
}
