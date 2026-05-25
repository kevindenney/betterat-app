/**
 * useInboxCount — count of pending items in the Practice Inbox.
 *
 * Sums:
 *   - inbox_items view (UNION of step_suggestions + step_deck + plan-push
 *     pending entries)
 *   - unread social notifications (Option-4 Pass 2: the Inbox tab badge
 *     reflects everything that lives inside, including the Activity group
 *     in the Read panel)
 *
 * Used by InboxIcon in the Practice header to render the red-dot badge.
 */

import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

const STALE_MS = 30_000;

export function useInboxCount() {
  const itemsQuery = useQuery<number>({
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
  const { unreadCount: notifUnread } = useUnreadNotificationCount();

  const itemsCount = itemsQuery.data ?? 0;
  const total = itemsCount + (notifUnread ?? 0);
  // Preserve the shape callers depend on by wrapping the merged total
  // back into the original query result.
  return { ...itemsQuery, data: total };
}
