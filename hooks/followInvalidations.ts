/**
 * Shared invalidation list for follow/unfollow mutations. Following someone
 * changes every follows-derived reader: the discovery/suggestion feeds, the
 * Watch feed, and — easy to forget — the Library "Following" people list +
 * counts and the followed-steps feed. Callsites historically refreshed only
 * the discovery side, so the Library count/list went stale after a follow
 * ("saved but didn't appear", per feedback_query_cache_key_invalidation_audit).
 */

import type { QueryClient } from '@tanstack/react-query';

export function invalidateFollowQueries(
  queryClient: QueryClient,
  actorUserId: string | undefined,
): void {
  queryClient.invalidateQueries({ queryKey: ['following', actorUserId] });
  queryClient.invalidateQueries({ queryKey: ['discovery-feed'] });
  queryClient.invalidateQueries({ queryKey: ['sailor-suggestions', actorUserId] });
  queryClient.invalidateQueries({ queryKey: ['watch-feed'] });
  // Library "Following" zone + its counts and the followed-steps feed all read
  // the follows table and are keyed by the viewer id (prefix match covers the
  // interest/limit suffixes).
  queryClient.invalidateQueries({ queryKey: ['library-people', actorUserId] });
  queryClient.invalidateQueries({ queryKey: ['library-counts', actorUserId] });
  queryClient.invalidateQueries({ queryKey: ['followed-steps-feed', actorUserId] });
}
