/**
 * useFollowedTimelines Hook
 *
 * Fetches race timelines for users the current user follows.
 * Used for the social sailing multi-timeline view (TikTok-style swipe navigation).
 *
 * Returns:
 * - myTimeline: Current user's races (always first in navigation)
 * - followedTimelines: Array of followed users with their races
 * - Combined: All timelines for easy navigation indexing
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { CrewFinderService, FollowedUserTimeline } from '@/services/CrewFinderService';
import { invalidateFollowQueries } from '@/hooks/followInvalidations';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('useFollowedTimelines');

/**
 * Avatar configuration for display
 */
export interface AvatarConfig {
  emoji?: string;
  color?: string;
}

/**
 * User info for timeline header
 */
export interface TimelineUser {
  id: string;
  name: string;
  avatar: AvatarConfig;
  isCurrentUser: boolean;
}

/**
 * A single timeline (user + their races)
 */
export interface Timeline {
  user: TimelineUser;
  races: any[]; // EnrichedRace[]
  isLoading: boolean;
  isEmpty: boolean;
}

/**
 * Hook return type
 */
export interface UseFollowedTimelinesResult {
  /** Current user's timeline (always index 0) */
  myTimeline: Timeline | null;
  /** Followed users' timelines */
  followedTimelines: Timeline[];
  /** All timelines combined (myTimeline + followedTimelines) */
  allTimelines: Timeline[];
  /** Whether initial data is loading */
  isLoading: boolean;
  /** Whether any timelines are available */
  hasTimelines: boolean;
  /** Total number of timelines */
  timelineCount: number;
  /** Refresh all timeline data */
  refresh: () => Promise<void>;
  /** Error message if any */
  error: string | null;
}

/**
 * Hook to fetch followed users' race timelines
 */
export function useFollowedTimelines(
  /** Current user's races (already enriched from parent) */
  myRaces: any[] = []
): UseFollowedTimelinesResult {
  const { user, userProfile, isGuest } = useAuth();
  const [followedData, setFollowedData] = useState<FollowedUserTimeline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const fetchRunIdRef = useRef(0);
  const activeUserIdRef = useRef<string | null>(user?.id ?? null);

  const userId = user?.id;

  useEffect(() => {
    activeUserIdRef.current = userId ?? null;
  }, [userId]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      fetchRunIdRef.current += 1;
    };
  }, []);

  // Build current user's timeline
  const myTimeline: Timeline | null = useMemo(() => {
    if (!userId) return null;

    const userName = userProfile?.full_name || 'My Timeline';
    const sailorProfile = userProfile as any;

    return {
      user: {
        id: userId,
        name: userName,
        avatar: {
          emoji: sailorProfile?.avatar_emoji || '⛵',
          color: sailorProfile?.avatar_color || '#3B82F6',
        },
        isCurrentUser: true,
      },
      races: myRaces,
      isLoading: false,
      isEmpty: myRaces.length === 0,
    };
  }, [userId, userProfile, myRaces]);

  // Fetch followed users' data
  const fetchFollowedTimelines = useCallback(async () => {
    const runId = ++fetchRunIdRef.current;
    const targetUserId = userId ?? null;
    const canCommit = () =>
      isMountedRef.current &&
      runId === fetchRunIdRef.current &&
      activeUserIdRef.current === targetUserId;

    if (!targetUserId || isGuest) {
      if (!canCommit()) return;
      setFollowedData([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (!canCommit()) return;
    setIsLoading(true);
    setError(null);

    try {
      logger.info('[useFollowedTimelines] Fetching followed users with races...');

      const data = await CrewFinderService.getFollowedUsersWithRaces(targetUserId, {
        includeRaces: true,
        racesLimit: 20,
      });

      logger.info('[useFollowedTimelines] Fetched data:', {
        followedCount: data.length,
        totalRaces: data.reduce((sum, u) => sum + u.raceCount, 0),
      });

      if (!canCommit()) return;
      setFollowedData(data);
    } catch (err: any) {
      logger.error('[useFollowedTimelines] Error fetching data:', err);
      if (!canCommit()) return;
      setError(err?.message || 'Failed to load followed timelines');
      setFollowedData([]);
    } finally {
      if (!canCommit()) return;
      setIsLoading(false);
    }
  }, [userId, isGuest]);

  // Initial fetch
  useEffect(() => {
    fetchFollowedTimelines();
  }, [fetchFollowedTimelines]);

  // Build followed timelines from fetched data
  const followedTimelines: Timeline[] = useMemo(() => {
    return followedData.map((userData) => ({
      user: {
        id: userData.user.userId,
        name: userData.user.fullName,
        avatar: {
          emoji: userData.user.avatarEmoji || '⛵',
          color: userData.user.avatarColor || '#64748B',
        },
        isCurrentUser: false,
      },
      races: userData.races,
      isLoading: false,
      isEmpty: userData.races.length === 0,
    }));
  }, [followedData]);

  // Combine all timelines (my timeline first, then followed)
  const allTimelines: Timeline[] = useMemo(() => {
    const timelines: Timeline[] = [];

    if (myTimeline) {
      timelines.push(myTimeline);
    }

    timelines.push(...followedTimelines);

    return timelines;
  }, [myTimeline, followedTimelines]);

  // Refresh function
  const refresh = useCallback(async () => {
    await fetchFollowedTimelines();
  }, [fetchFollowedTimelines]);

  return useMemo(() => ({
    myTimeline,
    followedTimelines,
    allTimelines,
    isLoading,
    hasTimelines: allTimelines.length > 0,
    timelineCount: allTimelines.length,
    refresh,
    error,
  }), [myTimeline, followedTimelines, allTimelines, isLoading, refresh, error]);
}

/**
 * Hook to check if a specific user is followed
 */
export function useIsFollowing(targetUserId: string | null): {
  isFollowing: boolean;
  isLoading: boolean;
  toggleFollow: () => Promise<void>;
} {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isMountedRef = useRef(true);
  const checkRunIdRef = useRef(0);
  const activeUserIdRef = useRef<string | null>(user?.id ?? null);
  const activeTargetUserIdRef = useRef<string | null>(targetUserId);

  const userId = user?.id;

  useEffect(() => {
    activeUserIdRef.current = userId ?? null;
    activeTargetUserIdRef.current = targetUserId;
  }, [userId, targetUserId]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      checkRunIdRef.current += 1;
    };
  }, []);

  // Check follow status
  useEffect(() => {
    const runId = ++checkRunIdRef.current;
    const targetUser = userId ?? null;
    const targetFollowee = targetUserId;
    const canCommit = () =>
      isMountedRef.current &&
      runId === checkRunIdRef.current &&
      activeUserIdRef.current === targetUser &&
      activeTargetUserIdRef.current === targetFollowee;

    if (!userId || !targetUserId) {
      if (!canCommit()) return;
      setIsFollowing(false);
      setIsLoading(false);
      return;
    }

    const checkFollowStatus = async () => {
      if (!canCommit()) return;
      setIsLoading(true);
      try {
        const following = await CrewFinderService.isFollowing(targetUser, targetFollowee);
        if (!canCommit()) return;
        setIsFollowing(following);
      } catch (err) {
        logger.error('[useIsFollowing] Error checking status:', err);
        if (!canCommit()) return;
        setIsFollowing(false);
      } finally {
        if (!canCommit()) return;
        setIsLoading(false);
      }
    };

    void checkFollowStatus();
  }, [userId, targetUserId]);

  // Toggle follow/unfollow
  const toggleFollow = useCallback(async () => {
    const targetUser = userId ?? null;
    const targetFollowee = targetUserId;
    if (!targetUser || !targetFollowee) return;

    if (
      !isMountedRef.current ||
      activeUserIdRef.current !== targetUser ||
      activeTargetUserIdRef.current !== targetFollowee
    ) {
      return;
    }
    setIsLoading(true);
    try {
      if (isFollowing) {
        await CrewFinderService.unfollowUser(targetUser, targetFollowee);
        if (
          !isMountedRef.current ||
          activeUserIdRef.current !== targetUser ||
          activeTargetUserIdRef.current !== targetFollowee
        ) {
          return;
        }
        setIsFollowing(false);
      } else {
        await CrewFinderService.followUser(targetUser, targetFollowee);
        if (
          !isMountedRef.current ||
          activeUserIdRef.current !== targetUser ||
          activeTargetUserIdRef.current !== targetFollowee
        ) {
          return;
        }
        setIsFollowing(true);
      }
      // Refresh every follows-derived reader (Watch feed, Library "Following"
      // list + counts, discovery/suggestions). This hook only flipped local
      // state before, so those surfaces went stale after a follow/unfollow.
      invalidateFollowQueries(queryClient, targetUser);
    } catch (err) {
      logger.error('[useIsFollowing] Error toggling follow:', err);
    } finally {
      if (
        !isMountedRef.current ||
        activeUserIdRef.current !== targetUser ||
        activeTargetUserIdRef.current !== targetFollowee
      ) {
        return;
      }
      setIsLoading(false);
    }
  }, [userId, targetUserId, isFollowing, queryClient]);

  return { isFollowing, isLoading, toggleFollow };
}

export default useFollowedTimelines;
