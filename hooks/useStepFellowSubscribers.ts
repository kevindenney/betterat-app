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

export interface FellowSubscriber {
  userId: string;
  displayName: string;
  avatarColor: string | null;
}

export function useStepFellowSubscribers({
  blueprintId,
}: UseStepFellowSubscribersInput) {
  const { user } = useAuth();
  const viewerId = user?.id ?? null;
  return useQuery<{ totalPeers: number; peers: FellowSubscriber[] }>({
    queryKey: ['step-fellow-subscribers', blueprintId, viewerId],
    queryFn: async () => {
      if (!blueprintId || !viewerId) return { totalPeers: 0, peers: [] };
      const { data: subs, error } = await supabase
        .from('blueprint_subscriptions')
        .select('subscriber_id')
        .eq('blueprint_id', blueprintId);
      if (error) return { totalPeers: 0, peers: [] };
      const ids = ((subs as { subscriber_id: string }[] | null) ?? [])
        .map((s) => s.subscriber_id)
        .filter((id) => id !== viewerId);

      if (ids.length === 0) return { totalPeers: 0, peers: [] };

      // Resolve names via the `profiles` table — never reach into auth.users
      // directly. The `profile_public` column drives an RLS discovery policy
      // that already permits cross-user reads of public/followed/org peers.
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', ids);

      const profilesById = new Map<string, string>();
      for (const row of (profiles as { id: string; full_name: string | null }[] | null) ??
        []) {
        if (row.id && row.full_name) {
          profilesById.set(row.id, row.full_name);
        }
      }
      const peers: FellowSubscriber[] = ids.map((id) => ({
        userId: id,
        displayName: profilesById.get(id) ?? 'Unknown',
        avatarColor: null,
      }));
      return { totalPeers: ids.length, peers };
    },
    enabled: Boolean(blueprintId && viewerId),
    staleTime: 60 * 1000,
  });
}
