/**
 * useInboxCount — count of pending items in the Practice Inbox.
 *
 * Sums:
 *   - The same hydrated inbox_items list useInboxItems returns (so the
 *     bottom tab badge stays in lockstep with the Inbox summary counts
 *     — no separate count query that can drift via RLS, LIMIT,
 *     or cache divergence)
 *   - Unread social notifications (Option-4 Pass 2: the Inbox tab badge
 *     reflects everything that lives inside, including messages and Activity)
 *
 * Used by InboxIcon in the Practice header to render the red-dot badge.
 */

import { useInboxItems } from '@/hooks/useInboxItems';
import { useFleetInvites } from '@/hooks/useFleetInvites';
import { useCrewThreads } from '@/hooks/useCrewThreads';
import { useNotifications } from '@/hooks/useNotifications';

export function useInboxCount() {
  const itemsQuery = useInboxItems();
  const fleetInvitesQuery = useFleetInvites();
  const { threads } = useCrewThreads();
  const { unreadGroups } = useNotifications();

  const itemsCount = itemsQuery.data?.length ?? 0;
  // Pending fleet invites render as actionable cards in the Act panel.
  const fleetInviteCount = fleetInvitesQuery.data?.length ?? 0;
  // Messages render from crew-thread unread state, so new_message
  // notification rows are suppressed to avoid counting the same thread twice.
  const messageThreadCount = threads.filter((thread) => thread.unreadCount > 0).length;
  // GROUPED unread count (one per digest thread), not raw — the Read panel
  // collapses an unread burst into a single digest card, so the badge must
  // count threads to match what's actually rendered.
  const activityCount = unreadGroups.filter((group) => group.latest.type !== 'new_message').length;
  const total = itemsCount + fleetInviteCount + messageThreadCount + activityCount;
  // Preserve the shape callers depend on by wrapping the merged total
  // back into the original query result.
  return { ...itemsQuery, data: total };
}
