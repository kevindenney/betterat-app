/**
 * useCrewFinder Hook
 *
 * Hook for crew finder functionality including:
 * - Searching users
 * - Getting fleet mates
 * - Getting public fleets
 * - User discovery and following
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import {
  CrewFinderService,
  SailorProfileSummary,
  FleetWithMembers,
  PublicFleet,
  DiscoverableUser,
} from '@/services/CrewFinderService';
import { RaceCollaborationService } from '@/services/RaceCollaborationService';
import { AccessLevel } from '@/types/raceCollaboration';
import { invalidateFollowQueries } from '@/hooks/followInvalidations';

interface UseCrewFinderResult {
  // Search users
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: SailorProfileSummary[];
  isSearching: boolean;

  // All users (when no search)
  allUsers: SailorProfileSummary[];
  isLoadingUsers: boolean;

  // Fleet mates
  fleetMates: FleetWithMembers[];
  isLoadingFleetMates: boolean;

  // Public fleets
  publicFleets: PublicFleet[];
  isLoadingPublicFleets: boolean;

  // Invite user to race
  inviteUser: (userId: string, regattaId: string, accessLevel?: AccessLevel) => Promise<void>;
  isInviting: boolean;
  inviteError: Error | null;

  // Join fleet
  joinFleet: (fleetId: string) => Promise<void>;
  isJoiningFleet: boolean;

  // Discovery - browse all users with follow status
  discoverUsers: DiscoverableUser[];
  isLoadingDiscoverUsers: boolean;
  hasMoreDiscoverUsers: boolean;
  loadMoreDiscoverUsers: () => void;
  refetchDiscoverUsers: () => void;

  // Following state
  followingIds: Set<string>;
  isLoadingFollowingIds: boolean;

  // Follow/unfollow mutations
  followUser: (userId: string) => Promise<void>;
  unfollowUser: (userId: string) => Promise<void>;
  isFollowingUser: (userId: string) => boolean;
  isFollowLoading: boolean;
}

interface UseCrewFinderOptions {
  /** Optional userId to use instead of the one from useAuth() */
  userId?: string;
}

export function useCrewFinder(options?: UseCrewFinderOptions): UseCrewFinderResult {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Use the provided userId if available, otherwise fall back to auth user
  const effectiveUserId = options?.userId || user?.id;


  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<Error | null>(null);
  const [isJoiningFleet, setIsJoiningFleet] = useState(false);

  // Discovery pagination state
  const [discoverOffset, setDiscoverOffset] = useState(0);
  const DISCOVER_PAGE_SIZE = 30;

  // Search users query
  const {
    data: searchResults = [],
    isLoading: isSearching,
  } = useQuery({
    queryKey: ['crew-finder-search', searchQuery],
    queryFn: () => CrewFinderService.searchUsers(searchQuery),
    enabled: searchQuery.length >= 2,
    staleTime: 30000,
  });

  // All users query (when no search)
  const {
    data: allUsers = [],
    isLoading: isLoadingUsers,
  } = useQuery({
    queryKey: ['crew-finder-all-users'],
    queryFn: () => CrewFinderService.getAllUsers(50),
    enabled: searchQuery.length < 2,
    staleTime: 60000,
  });

  // Fleet mates query
  const {
    data: fleetMates = [],
    isLoading: isLoadingFleetMates,
  } = useQuery({
    queryKey: ['crew-finder-fleet-mates', effectiveUserId],
    queryFn: () => CrewFinderService.getFleetMatesForUser(effectiveUserId!),
    enabled: !!effectiveUserId,
    staleTime: 60000,
  });

  // Public fleets query
  const {
    data: publicFleets = [],
    isLoading: isLoadingPublicFleets,
  } = useQuery({
    queryKey: ['crew-finder-public-fleets', effectiveUserId],
    queryFn: () => CrewFinderService.getPublicFleets(effectiveUserId!, { limit: 50 }),
    enabled: !!effectiveUserId,
    staleTime: 60000,
  });

  // ===========================================================================
  // DISCOVERY & FOLLOWING
  // ===========================================================================

  // User discovery query (paginated)
  const {
    data: discoverData,
    isLoading: isLoadingDiscoverUsers,
    refetch: refetchDiscoverUsers,
  } = useQuery({
    queryKey: ['crew-finder-discover', effectiveUserId, discoverOffset],
    queryFn: () =>
      CrewFinderService.getAllUsersForDiscovery(
        effectiveUserId!,
        DISCOVER_PAGE_SIZE,
        discoverOffset
      ),
    enabled: !!effectiveUserId,
    staleTime: 30000,
  });

  const discoverUsers = discoverData?.users ?? [];
  const hasMoreDiscoverUsers = discoverData?.hasMore ?? false;

  const loadMoreDiscoverUsers = useCallback(() => {
    if (hasMoreDiscoverUsers) {
      setDiscoverOffset((prev) => prev + DISCOVER_PAGE_SIZE);
    }
  }, [hasMoreDiscoverUsers]);

  // Following IDs query
  const {
    data: followingIdsArray = [],
    isLoading: isLoadingFollowingIds,
  } = useQuery({
    queryKey: ['crew-finder-following-ids', effectiveUserId],
    queryFn: () => CrewFinderService.getFollowingIds(effectiveUserId!),
    enabled: !!effectiveUserId,
    staleTime: 30000,
  });

  // Memoize the Set for efficient lookups
  const followingIds = useMemo(
    () => new Set(followingIdsArray),
    [followingIdsArray]
  );

  // Follow user mutation
  const followMutation = useMutation({
    mutationFn: (followingId: string) =>
      CrewFinderService.followUser(effectiveUserId!, followingId),
    onMutate: async (followingId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['crew-finder-following-ids', effectiveUserId] });

      // Snapshot the previous value
      const previousFollowingIds = queryClient.getQueryData<string[]>([
        'crew-finder-following-ids',
        effectiveUserId,
      ]);

      // Optimistically update to the new value
      queryClient.setQueryData<string[]>(
        ['crew-finder-following-ids', effectiveUserId],
        (old) => [...(old || []), followingId]
      );

      // Also update the discover users list optimistically
      queryClient.setQueryData(
        ['crew-finder-discover', effectiveUserId, discoverOffset],
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            users: old.users.map((u: DiscoverableUser) =>
              u.userId === followingId ? { ...u, isFollowing: true } : u
            ),
          };
        }
      );

      return { previousFollowingIds };
    },
    onError: (_err, _followingId, context) => {
      // Roll back on error
      if (context?.previousFollowingIds) {
        queryClient.setQueryData(
          ['crew-finder-following-ids', effectiveUserId],
          context.previousFollowingIds
        );
      }
    },
    onSettled: () => {
      // Invalidate queries to refetch
      queryClient.invalidateQueries({ queryKey: ['crew-finder-following-ids', effectiveUserId] });
      queryClient.invalidateQueries({ queryKey: ['crew-finder-discover', effectiveUserId] });
      // Also refresh the shared follows-derived surfaces (Watch, Library
      // "Following", discovery) so a follow made here isn't stale elsewhere.
      invalidateFollowQueries(queryClient, effectiveUserId);
    },
  });

  // Unfollow user mutation
  const unfollowMutation = useMutation({
    mutationFn: (followingId: string) =>
      CrewFinderService.unfollowUser(effectiveUserId!, followingId),
    onMutate: async (followingId) => {
      await queryClient.cancelQueries({ queryKey: ['crew-finder-following-ids', effectiveUserId] });

      const previousFollowingIds = queryClient.getQueryData<string[]>([
        'crew-finder-following-ids',
        effectiveUserId,
      ]);

      // Optimistically update
      queryClient.setQueryData<string[]>(
        ['crew-finder-following-ids', effectiveUserId],
        (old) => (old || []).filter((id) => id !== followingId)
      );

      // Update discover users list
      queryClient.setQueryData(
        ['crew-finder-discover', effectiveUserId, discoverOffset],
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            users: old.users.map((u: DiscoverableUser) =>
              u.userId === followingId ? { ...u, isFollowing: false } : u
            ),
          };
        }
      );

      return { previousFollowingIds };
    },
    onError: (_err, _followingId, context) => {
      if (context?.previousFollowingIds) {
        queryClient.setQueryData(
          ['crew-finder-following-ids', effectiveUserId],
          context.previousFollowingIds
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['crew-finder-following-ids', effectiveUserId] });
      queryClient.invalidateQueries({ queryKey: ['crew-finder-discover', effectiveUserId] });
      invalidateFollowQueries(queryClient, effectiveUserId);
    },
  });

  const followUser = useCallback(
    async (userId: string) => {
      await followMutation.mutateAsync(userId);
    },
    [followMutation]
  );

  const unfollowUser = useCallback(
    async (userId: string) => {
      await unfollowMutation.mutateAsync(userId);
    },
    [unfollowMutation]
  );

  const isFollowingUser = useCallback(
    (userId: string) => followingIds.has(userId),
    [followingIds]
  );

  const isFollowLoading = followMutation.isPending || unfollowMutation.isPending;

  // Invite user mutation
  const inviteUser = useCallback(async (
    userId: string,
    regattaId: string,
    accessLevel: AccessLevel = 'view'
  ) => {
    setIsInviting(true);
    setInviteError(null);
    try {
      await RaceCollaborationService.inviteUser(regattaId, userId, accessLevel);
      // Invalidate collaborators query
      queryClient.invalidateQueries({ queryKey: ['race-collaborators', regattaId] });
    } catch (error) {
      setInviteError(error as Error);
      throw error;
    } finally {
      setIsInviting(false);
    }
  }, [queryClient]);

  // Join fleet mutation
  const joinFleet = useCallback(async (fleetId: string) => {
    if (!effectiveUserId) return;
    setIsJoiningFleet(true);
    try {
      await CrewFinderService.joinFleet(effectiveUserId, fleetId);
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['crew-finder-fleet-mates'] });
      queryClient.invalidateQueries({ queryKey: ['crew-finder-public-fleets'] });
    } finally {
      setIsJoiningFleet(false);
    }
  }, [effectiveUserId, queryClient]);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    allUsers,
    isLoadingUsers,
    fleetMates,
    isLoadingFleetMates,
    publicFleets,
    isLoadingPublicFleets,
    inviteUser,
    isInviting,
    inviteError,
    joinFleet,
    isJoiningFleet,
    // Discovery
    discoverUsers,
    isLoadingDiscoverUsers,
    hasMoreDiscoverUsers,
    loadMoreDiscoverUsers,
    refetchDiscoverUsers,
    // Following
    followingIds,
    isLoadingFollowingIds,
    followUser,
    unfollowUser,
    isFollowingUser,
    isFollowLoading,
  };
}
