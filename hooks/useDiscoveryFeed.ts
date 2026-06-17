/**
 * useDiscoveryFeed Hook
 *
 * Unified feed hook for Instagram-style sailor discovery.
 * Handles three feed modes:
 * - global: No follows → show all public races (pure discovery)
 * - following: Has follows → show followed users' races + "Discover More" section
 * - tailored: Has follows + boat class → following + class experts header + discovery
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { CrewFinderService, PublicRacePreview } from '@/services/CrewFinderService';
import { useUserBoatClass } from '@/hooks/useClassExperts';
import { createLogger } from '@/lib/utils/logger';
import { showAlert } from '@/lib/utils/crossPlatformAlert';

const logger = createLogger('useDiscoveryFeed');

/**
 * Feed item types for FlatList
 */
export type FeedItemType = 'race_card' | 'section_header' | 'loading_indicator';

export interface FeedItem {
  id: string;
  type: FeedItemType;
  data?: PublicRacePreview;
  title?: string; // For section headers
}

/**
 * Feed modes
 */
export type FeedMode = 'global' | 'following' | 'tailored';

/**
 * Hook return type
 */
export interface UseDiscoveryFeedResult {
  /** Feed items for FlatList */
  feedItems: FeedItem[];
  /** Current feed mode */
  feedMode: FeedMode;
  /** Number of users being followed */
  followingCount: number;
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Load more items (for infinite scroll) */
  loadMore: () => Promise<void>;
  /** Refresh feed */
  refresh: () => Promise<void>;
  /** Toggle follow state for a user */
  toggleFollow: (userId: string) => Promise<void>;
  /** Loading state */
  isLoading: boolean;
  /** Loading more state */
  isLoadingMore: boolean;
  /** Error message */
  error: string | null;
  /** User has boat class (for tailored mode) */
  hasBoatClass: boolean;
  /** Followed users' race IDs for quick lookup */
  followedUserIds: Set<string>;
  /** Raw following races array (for grouped list view) */
  followingRaces: PublicRacePreview[];
  /** Raw discovery races array (for grouped list view) */
  discoveryRaces: PublicRacePreview[];
}

const PAGE_SIZE = 20;

/**
 * Hook for unified discovery feed
 */
export function useDiscoveryFeed(): UseDiscoveryFeedResult {
  const { user, isGuest } = useAuth();
  const { classId, isLoading: classLoading } = useUserBoatClass();

  // State
  const [followingRaces, setFollowingRaces] = useState<PublicRacePreview[]>([]);
  const [discoveryRaces, setDiscoveryRaces] = useState<PublicRacePreview[]>([]);
  const [followingCount, setFollowingCount] = useState(0);
  const [hasMoreFollowing, setHasMoreFollowing] = useState(false);
  const [hasMoreDiscovery, setHasMoreDiscovery] = useState(false);
  const [followingOffset, setFollowingOffset] = useState(0);
  const [discoveryOffset, setDiscoveryOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followedUserIds, setFollowedUserIds] = useState<Set<string>>(new Set());
  const isMountedRef = useRef(true);
  const fetchRunIdRef = useRef(0);
  const loadMoreRunIdRef = useRef(0);
  const activeUserIdRef = useRef<string | null>(user?.id ?? null);

  useEffect(() => {
    activeUserIdRef.current = user?.id ?? null;
  }, [user?.id]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      fetchRunIdRef.current += 1;
      loadMoreRunIdRef.current += 1;
    };
  }, []);

  const userId = user?.id;

  // Determine feed mode
  const feedMode: FeedMode = useMemo(() => {
    if (followingCount === 0) return 'global';
    if (classId && !classLoading) return 'tailored';
    return 'following';
  }, [followingCount, classId, classLoading]);

  const hasBoatClass = !!classId && !classLoading;

  /**
   * Fetch initial feed data
   */
  const fetchFeed = useCallback(async () => {
    const runId = ++fetchRunIdRef.current;
    const targetUserId = userId ?? null;
    const canCommit = () =>
      isMountedRef.current &&
      runId === fetchRunIdRef.current &&
      activeUserIdRef.current === targetUserId;

    if (!targetUserId || isGuest) {
      if (!canCommit()) return;
      setFollowingRaces([]);
      setDiscoveryRaces([]);
      setFollowingCount(0);
      setHasMoreFollowing(false);
      setHasMoreDiscovery(false);
      setFollowingOffset(0);
      setDiscoveryOffset(0);
      setFollowedUserIds(new Set());
      setError(null);
      setIsLoading(false);
      return;
    }

    if (!canCommit()) return;
    setIsLoading(true);
    setError(null);

    try {
      logger.info('[useDiscoveryFeed] Fetching feed for user:', userId);

      // Fetch followed users' races
      const followedResult = await CrewFinderService.getFollowedUsersRaces({
        userId: targetUserId,
        limit: PAGE_SIZE,
        offset: 0,
      });

      if (!canCommit()) return;
      setFollowingRaces(followedResult.races);
      setFollowingCount(followedResult.followingCount);
      setHasMoreFollowing(followedResult.hasMore);
      setFollowingOffset(PAGE_SIZE);

      // Build set of followed user IDs
      const followedIds = new Set(followedResult.races.map((r) => r.userId));
      if (!canCommit()) return;
      setFollowedUserIds(followedIds);

      // Fetch discovery races (excluding followed users if there are any)
      const excludeUserIds =
        followedResult.followingCount > 0 ? Array.from(followedIds) : [];

      const discoveryResult = await CrewFinderService.getPublicRaces({
          limit: PAGE_SIZE,
          offset: 0,
          excludeUserId: targetUserId,
          excludeUserIds,
        });

      if (!canCommit()) return;
      setDiscoveryRaces(discoveryResult.races);
      setHasMoreDiscovery(discoveryResult.hasMore);
      setDiscoveryOffset(PAGE_SIZE);

      logger.info('[useDiscoveryFeed] Feed loaded:', {
        followingRaces: followedResult.races.length,
        discoveryRaces: discoveryResult.races.length,
        followingCount: followedResult.followingCount,
        mode: followedResult.followingCount > 0 ? 'following' : 'global',
      });
    } catch (err: any) {
      logger.error('[useDiscoveryFeed] Error fetching feed:', err);
      if (!canCommit()) return;
      setError(err?.message || 'Failed to load feed');
    } finally {
      if (!canCommit()) return;
      setIsLoading(false);
    }
  }, [userId, isGuest]);

  /**
   * Load more items (infinite scroll)
   */
  const loadMore = useCallback(async () => {
    const runId = ++loadMoreRunIdRef.current;
    const targetUserId = userId ?? null;
    const canCommit = () =>
      isMountedRef.current &&
      runId === loadMoreRunIdRef.current &&
      activeUserIdRef.current === targetUserId;

    if (!targetUserId || isLoadingMore) return;

    // Decide which section to load more from
    // If we have following races and more to load, load those first
    // Otherwise load more discovery races
    const loadMoreFollowing = hasMoreFollowing;
    const loadMoreDiscovery = hasMoreDiscovery && !hasMoreFollowing;

    if (!loadMoreFollowing && !loadMoreDiscovery) return;

    if (!canCommit()) return;
    setIsLoadingMore(true);

    try {
      if (loadMoreFollowing) {
        logger.info('[useDiscoveryFeed] Loading more following races');
        const result = await CrewFinderService.getFollowedUsersRaces({
          userId: targetUserId,
          limit: PAGE_SIZE,
          offset: followingOffset,
        });

        if (!canCommit()) return;
        setFollowingRaces((prev) => {
          const merged = [...prev, ...result.races];
          setFollowedUserIds(new Set(merged.map((r) => r.userId)));
          return merged;
        });
        setHasMoreFollowing(result.hasMore);
        setFollowingOffset((prev) => prev + PAGE_SIZE);
      } else if (loadMoreDiscovery) {
        logger.info('[useDiscoveryFeed] Loading more discovery races');
        const excludeUserIds = Array.from(followedUserIds);

        const result = await CrewFinderService.getPublicRaces({
          limit: PAGE_SIZE,
          offset: discoveryOffset,
          excludeUserId: targetUserId,
          excludeUserIds,
        });

        if (!canCommit()) return;
        setDiscoveryRaces((prev) => [...prev, ...result.races]);
        setHasMoreDiscovery(result.hasMore);
        setDiscoveryOffset((prev) => prev + PAGE_SIZE);
      }
    } catch (err: any) {
      logger.error('[useDiscoveryFeed] Error loading more:', err);
    } finally {
      if (!canCommit()) return;
      setIsLoadingMore(false);
    }
  }, [
    userId,
    isLoadingMore,
    hasMoreFollowing,
    hasMoreDiscovery,
    followingOffset,
    discoveryOffset,
    followedUserIds,
  ]);

  /**
   * Refresh feed
   */
  const refresh = useCallback(async () => {
    setFollowingOffset(0);
    setDiscoveryOffset(0);
    await fetchFeed();
  }, [fetchFeed]);

  /**
   * Toggle follow for a user
   */
  const toggleFollow = useCallback(
    async (targetUserId: string) => {
      const actorUserId = userId ?? null;
      if (!actorUserId) return;

      const isCurrentlyFollowing = followedUserIds.has(targetUserId);

      try {
        if (isCurrentlyFollowing) {
          await CrewFinderService.unfollowUser(actorUserId, targetUserId);
          if (!isMountedRef.current || activeUserIdRef.current !== actorUserId) return;
          // Update local state
          setFollowedUserIds((prev) => {
            const next = new Set(prev);
            next.delete(targetUserId);
            return next;
          });
          setFollowingCount((prev) => Math.max(0, prev - 1));

          // Update following races - remove races from unfollowed user
          setFollowingRaces((prev) => prev.filter((r) => r.userId !== targetUserId));

          // Move their races to discovery (they'll appear on next refresh)
        } else {
          await CrewFinderService.followUser(actorUserId, targetUserId);
          if (!isMountedRef.current || activeUserIdRef.current !== actorUserId) return;
          // Update local state
          setFollowedUserIds((prev) => {
            const next = new Set(prev);
            next.add(targetUserId);
            return next;
          });
          setFollowingCount((prev) => prev + 1);

          // Move races from discovery to following
          const racesToMove = discoveryRaces.filter((r) => r.userId === targetUserId);
          if (racesToMove.length > 0) {
            setFollowingRaces((prev) => [
              ...racesToMove.map((r) => ({ ...r, isFollowing: true })),
              ...prev,
            ]);
            setDiscoveryRaces((prev) => prev.filter((r) => r.userId !== targetUserId));
          }
        }

        if (!isMountedRef.current || activeUserIdRef.current !== actorUserId) return;
        // Update isFollowing flag in current races
        setFollowingRaces((prev) =>
          prev.map((r) =>
            r.userId === targetUserId ? { ...r, isFollowing: !isCurrentlyFollowing } : r
          )
        );
        setDiscoveryRaces((prev) =>
          prev.map((r) =>
            r.userId === targetUserId ? { ...r, isFollowing: !isCurrentlyFollowing } : r
          )
        );

        logger.info('[useDiscoveryFeed] Toggle follow:', {
          targetUserId,
          newState: !isCurrentlyFollowing,
        });
      } catch (err: any) {
        logger.error('[useDiscoveryFeed] Error toggling follow:', err);
        showAlert(
          isCurrentlyFollowing ? 'Could Not Unfollow' : 'Could Not Follow',
          err?.message || 'Something went wrong. Please try again.',
        );
        // Revert local state on error by refreshing
        if (!isMountedRef.current || activeUserIdRef.current !== actorUserId) return;
        await refresh();
      }
    },
    [userId, followedUserIds, discoveryRaces, refresh]
  );

  // Build feed items for FlatList
  const feedItems: FeedItem[] = useMemo(() => {
    const items: FeedItem[] = [];

    if (feedMode === 'global') {
      // Pure discovery mode - show all public races
      discoveryRaces.forEach((race) => {
        items.push({
          id: `race_${race.id}`,
          type: 'race_card',
          data: race,
        });
      });
    } else {
      // Following or Tailored mode
      // Show followed users' races first
      followingRaces.forEach((race) => {
        items.push({
          id: `race_${race.id}`,
          type: 'race_card',
          data: race,
        });
      });

      // Add "Discover More" section if there are discovery races
      if (discoveryRaces.length > 0) {
        items.push({
          id: 'section_discover_more',
          type: 'section_header',
          title: 'Discover More Sailors',
        });

        discoveryRaces.forEach((race) => {
          items.push({
            id: `discover_${race.id}`,
            type: 'race_card',
            data: race,
          });
        });
      }
    }

    return items;
  }, [feedMode, followingRaces, discoveryRaces]);

  // Initial fetch
  useEffect(() => {
    void fetchFeed();
  }, [fetchFeed]);

  return {
    feedItems,
    feedMode,
    followingCount,
    hasMore: hasMoreFollowing || hasMoreDiscovery,
    loadMore,
    refresh,
    toggleFollow,
    isLoading,
    isLoadingMore,
    error,
    hasBoatClass,
    followedUserIds,
    followingRaces,
    discoveryRaces,
  };
}

export default useDiscoveryFeed;
