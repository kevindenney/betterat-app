/**
 * useInboxCount — count of pending items in the Practice Inbox.
 *
 * Sums:
 *   - The same hydrated inbox_items list useInboxItems returns (so the
 *     bottom tab badge stays in lockstep with the Read/Act/Done segment
 *     pills — no separate count query that can drift via RLS, LIMIT,
 *     or cache divergence)
 *   - Unread social notifications (Option-4 Pass 2: the Inbox tab badge
 *     reflects everything that lives inside, including the Activity group
 *     in the Read panel)
 *
 * Used by InboxIcon in the Practice header to render the red-dot badge.
 */

import { useInboxItems } from '@/hooks/useInboxItems';
import { useNotifications } from '@/hooks/useNotifications';

export function useInboxCount() {
  const itemsQuery = useInboxItems();
  const { unreadCount: notifUnread } = useNotifications();

  const itemsCount = itemsQuery.data?.length ?? 0;
  const total = itemsCount + (notifUnread ?? 0);
  // Preserve the shape callers depend on by wrapping the merged total
  // back into the original query result.
  return { ...itemsQuery, data: total };
}
