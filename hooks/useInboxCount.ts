/**
 * useInboxCount — count of pending items in the Practice Inbox.
 *
 * Reads from the `inbox_items` view (UNION of step_suggestions + step_deck
 * + plan-push pending entries). Used by InboxIcon in the Practice header
 * to render the red-dot badge.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

const STALE_MS = 30_000;

export function useInboxCount() {
  return useQuery<number>({
    queryKey: ['practice-inbox-count'],
    staleTime: STALE_MS,
    queryFn: async () => {
      // inbox_items view already filters on its sources: pending step
      // suggestions UNION ALL on_deck step_deck entries — both belong in
      // the count.
      const { count, error } = await supabase
        .from('inbox_items')
        .select('id', { count: 'exact', head: true });
      if (error) {
        return 0;
      }
      return count ?? 0;
    },
  });
}
