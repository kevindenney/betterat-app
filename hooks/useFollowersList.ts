/**
 * useFollowersList - Hook for fetching followers or following list
 */

import { useState, useCallback, useMemo } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { SailorProfileService } from '@/services/SailorProfileService';
import { CrewFinderService } from '@/services/CrewFinderService';

const PAGE_SIZE = 50;

interface UserListItem {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  avatarEmoji?: string;
  avatarColor?: string;
  isFollowing: boolean;
}

export function useFollowersList(
  userId: string,
  type: 'followers' | 'following'
) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // Optimistic overrides applied on top of the server's isFollowing flags.
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['user-list', type, userId],
    queryFn: async ({ pageParam = 0 }) => {
      if (type === 'followers') {
        return SailorProfileService.getFollowers(userId, user?.id, {
          limit: PAGE_SIZE,
          offset: pageParam,
        });
      } else {
        return SailorProfileService.getFollowing(userId, user?.id, {
          limit: PAGE_SIZE,
          offset: pageParam,
        });
      }
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return allPages.length * PAGE_SIZE;
    },
    initialPageParam: 0,
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const users: UserListItem[] = useMemo(
    () => data?.pages.flatMap((page) => page.users) ?? [],
    [data]
  );

  // Derive the followed set from server data, then apply optimistic overrides.
  const followedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const u of users) {
      if (u.isFollowing) ids.add(u.userId);
    }
    for (const [uid, following] of overrides) {
      if (following) ids.add(uid);
      else ids.delete(uid);
    }
    return ids;
  }, [users, overrides]);

  // Follow mutation
  const followMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      await CrewFinderService.followUser(user.id, targetUserId);
      return targetUserId;
    },
    onSuccess: (targetUserId) => {
      setOverrides((prev) => new Map(prev).set(targetUserId, true));
      queryClient.invalidateQueries({ queryKey: ['following', user?.id] });
    },
  });

  // Unfollow mutation
  const unfollowMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      await CrewFinderService.unfollowUser(user.id, targetUserId);
      return targetUserId;
    },
    onSuccess: (targetUserId) => {
      setOverrides((prev) => new Map(prev).set(targetUserId, false));
      queryClient.invalidateQueries({ queryKey: ['following', user?.id] });
    },
  });

  // Toggle follow
  const toggleFollow = useCallback(
    async (targetUserId: string) => {
      if (followedIds.has(targetUserId)) {
        await unfollowMutation.mutateAsync(targetUserId);
      } else {
        await followMutation.mutateAsync(targetUserId);
      }
    },
    [followedIds, followMutation, unfollowMutation]
  );

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const isFollowing = useCallback(
    (uid: string) => followedIds.has(uid),
    [followedIds]
  );

  return {
    users,
    isLoading,
    error,
    hasMore: hasNextPage || false,
    loadMore,
    isLoadingMore: isFetchingNextPage,
    refresh,
    toggleFollow,
    isFollowing,
  };
}
