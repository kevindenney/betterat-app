/**
 * useSailorFullProfile - Hook for fetching complete sailor profile data
 *
 * Used on sailor profile pages to fetch all profile details including
 * stats, achievements, boats, and follow status.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import {
  SailorProfileService,
  type FullSailorProfile,
} from '@/services/SailorProfileService';
import { CrewFinderService } from '@/services/CrewFinderService';
import { invalidateFollowQueries } from '@/hooks/followInvalidations';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('useSailorFullProfile');

export function useSailorFullProfile(userId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const profileFetchRunRef = useRef(0);

  const profileQueryKey = ['sailor-full-profile', userId];

  // Fetch full profile data
  const {
    data: profile,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: profileQueryKey,
    queryFn: async () => {
      const run = ++profileFetchRunRef.current;
      logger.info('[diagnostic] profile query start', {
        run,
        userId,
        viewerId: user?.id || null,
      });
      const profileResult = await SailorProfileService.getFullProfile(userId, user?.id);
      logger.info('[diagnostic] profile query result', {
        run,
        userId,
        foundProfile: !!profileResult,
        displayName: profileResult?.displayName || null,
      });
      return profileResult;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  useEffect(() => {
    if (!error) return;
    logger.warn('[diagnostic] profile query error', {
      userId,
      error: (error as any)?.message || String(error),
    });
  }, [error, userId]);

  // Follow mutation
  const followMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      await CrewFinderService.followUser(user.id, userId);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: profileQueryKey });
      const previous = queryClient.getQueryData<FullSailorProfile>(profileQueryKey);
      if (previous) {
        queryClient.setQueryData<FullSailorProfile>(profileQueryKey, {
          ...previous,
          isFollowing: true,
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(profileQueryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: profileQueryKey });
      invalidateFollowQueries(queryClient, user?.id);
    },
  });

  // Unfollow mutation
  const unfollowMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      await CrewFinderService.unfollowUser(user.id, userId);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: profileQueryKey });
      const previous = queryClient.getQueryData<FullSailorProfile>(profileQueryKey);
      if (previous) {
        queryClient.setQueryData<FullSailorProfile>(profileQueryKey, {
          ...previous,
          isFollowing: false,
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(profileQueryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: profileQueryKey });
      invalidateFollowQueries(queryClient, user?.id);
    },
  });

  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      return CrewFinderService.toggleFavorite(user.id, userId);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: profileQueryKey });
      const previous = queryClient.getQueryData<FullSailorProfile>(profileQueryKey);
      if (previous) {
        queryClient.setQueryData<FullSailorProfile>(profileQueryKey, {
          ...previous,
          isFavorite: !previous.isFavorite,
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(profileQueryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: profileQueryKey });
    },
  });

  // Toggle notifications mutation
  const toggleNotificationsMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      return CrewFinderService.toggleNotifications(user.id, userId);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: profileQueryKey });
      const previous = queryClient.getQueryData<FullSailorProfile>(profileQueryKey);
      if (previous) {
        queryClient.setQueryData<FullSailorProfile>(profileQueryKey, {
          ...previous,
          notificationsEnabled: !previous.notificationsEnabled,
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(profileQueryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: profileQueryKey });
    },
  });

  // Toggle mute mutation
  const toggleMuteMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      return CrewFinderService.toggleMute(user.id, userId);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: profileQueryKey });
      const previous = queryClient.getQueryData<FullSailorProfile>(profileQueryKey);
      if (previous) {
        queryClient.setQueryData<FullSailorProfile>(profileQueryKey, {
          ...previous,
          isMuted: !previous.isMuted,
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(profileQueryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: profileQueryKey });
    },
  });

  // Toggle follow
  const toggleFollow = useCallback(async () => {
    if (!profile) return;

    if (profile.isFollowing) {
      await unfollowMutation.mutateAsync();
    } else {
      await followMutation.mutateAsync();
    }
  }, [profile, followMutation, unfollowMutation]);

  const toggleFavorite = useCallback(() => {
    toggleFavoriteMutation.mutate();
  }, [toggleFavoriteMutation]);

  const toggleNotifications = useCallback(() => {
    toggleNotificationsMutation.mutate();
  }, [toggleNotificationsMutation]);

  const toggleMute = useCallback(() => {
    toggleMuteMutation.mutate();
  }, [toggleMuteMutation]);

  // Check if viewing own profile
  const isOwnProfile = user?.id === userId;

  return {
    profile,
    isLoading,
    error,
    refetch,
    toggleFollow,
    toggleFavorite,
    toggleNotifications,
    toggleMute,
    isFollowing: profile?.isFollowing ?? false,
    isFavorite: profile?.isFavorite ?? false,
    notificationsEnabled: profile?.notificationsEnabled ?? false,
    isMuted: profile?.isMuted ?? false,
    isOwnProfile,
    isToggling: followMutation.isPending || unfollowMutation.isPending,
  };
}
