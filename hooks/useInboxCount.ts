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
import { useFleetInvites } from '@/hooks/useFleetInvites';
import { useNotifications } from '@/hooks/useNotifications';

export function useInboxCount() {
  const itemsQuery = useInboxItems();
  const fleetInvitesQuery = useFleetInvites();
  const { unreadGroupCount } = useNotifications();

  const itemsCount = itemsQuery.data?.length ?? 0;
  // Pending fleet invites render as actionable cards in the Act panel.
  const fleetInviteCount = fleetInvitesQuery.data?.length ?? 0;
  // GROUPED unread count (one per digest thread), not raw — the Read panel
  // collapses an unread burst into a single digest card, so the badge must
  // count threads to match what's actually rendered.
  const total = itemsCount + fleetInviteCount + unreadGroupCount;
  // Preserve the shape callers depend on by wrapping the merged total
  // back into the original query result.
  return { ...itemsQuery, data: total };
}
