/**
 * useSailorSuggestions - Hook for Strava-style sailor suggestions
 *
 * Provides:
 * - Algorithm-based suggestions
 * - Search filtering (client-side over suggestions list AND server-side
 *   against profiles+users when the query is ≥ 2 chars, so emails or
 *   names of people outside the suggestion list still surface)
 * - Follow/unfollow functionality
 * - Follow state tracking
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { CrewFinderService, type SimilarSailor, type SailorProfileSummary } from '@/services/CrewFinderService';
import type { SailorSuggestion } from '@/components/search/SailorSuggestionCard';

interface UseSailorSuggestionsOptions {
  limit?: number;
}

export function useSailorSuggestions(
  searchQuery: string = '',
  options: UseSailorSuggestionsOptions = {}
) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { limit = 50 } = options;
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

  // Fetch similar sailors
  const { data, isLoading, refetch, error } = useQuery({
    queryKey: ['sailor-suggestions', user?.id],
    queryFn: async (): Promise<SimilarSailor[]> => {
      if (!user?.id) return [];
      return CrewFinderService.getSimilarSailors(user.id, { limit });
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Server-side search fallback — fires whenever the query is ≥ 2 chars.
  // Without this, emails and any name not in the local suggestion list
  // return zero matches (the original bug: searching by an exact email
  // surfaced nothing because suggestions never include that user).
  const trimmedQuery = searchQuery.trim();
  const { data: serverHits = [] } = useQuery({
    queryKey: ['sailor-search', trimmedQuery],
    queryFn: (): Promise<SailorProfileSummary[]> =>
      CrewFinderService.searchUsers(trimmedQuery, limit),
    enabled: trimmedQuery.length >= 2,
    staleTime: 30_000,
  });

  // Initialize followed IDs from the data
  useEffect(() => {
    if (data) {
      const ids = new Set(
        data.filter((s) => s.isFollowing).map((s) => s.userId)
      );
      setFollowedIds(ids);
    }
  }, [data]);

  // Transform to suggestions and filter by search
  const suggestions: SailorSuggestion[] = useMemo(() => {
    const base = data ?? [];
    const query = trimmedQuery.toLowerCase();

    // Local filter pass against the algorithm-derived suggestions.
    const localFiltered =
      query.length > 0
        ? base.filter(
            (s) =>
              s.fullName.toLowerCase().includes(query) ||
              s.similarityReasons.some((r) => r.toLowerCase().includes(query)),
          )
        : base;

    // getSimilarSailors can return the same person via multiple similarity
    // sources — keep the first (highest-ranked) row per user.
    const localTransformed: SailorSuggestion[] = [];
    const localSeen = new Set<string>();
    for (const sailor of localFiltered) {
      if (localSeen.has(sailor.userId)) continue;
      localSeen.add(sailor.userId);
      localTransformed.push({
        userId: sailor.userId,
        fullName: sailor.fullName,
        avatarEmoji: sailor.avatarEmoji,
        avatarColor: sailor.avatarColor,
        similarityReason: sailor.similarityReasons[0],
        followerCount: sailor.similarityScore, // Use score as proxy
      });
    }

    if (query.length === 0) return localTransformed;

    // Server-side hits — append any user not already in the local pass.
    // Self-row is filtered so the search never surfaces the viewer to
    // themselves (a common spam pattern when typing your own email).
    const seen = new Set(localTransformed.map((s) => s.userId));
    const serverTransformed: SailorSuggestion[] = serverHits
      .filter((hit) => hit.userId !== user?.id && !seen.has(hit.userId))
      .map((hit) => ({
        userId: hit.userId,
        fullName: hit.fullName,
        avatarEmoji: hit.avatarEmoji,
        avatarColor: hit.avatarColor,
        similarityReason: hit.email && query.includes('@') ? hit.email : undefined,
        followerCount: 0,
      }));

    return [...localTransformed, ...serverTransformed];
  }, [data, serverHits, trimmedQuery, user?.id]);

  // Follow mutation
  const followMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      await CrewFinderService.followUser(user.id, targetUserId);
      return targetUserId;
    },
    onSuccess: (targetUserId) => {
      setFollowedIds((prev) => new Set([...prev, targetUserId]));
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['following', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['discovery-feed'] });
      queryClient.invalidateQueries({ queryKey: ['sailor-suggestions', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['watch-feed'] });
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
      setFollowedIds((prev) => {
        const next = new Set(prev);
        next.delete(targetUserId);
        return next;
      });
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['following', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['discovery-feed'] });
      queryClient.invalidateQueries({ queryKey: ['sailor-suggestions', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['watch-feed'] });
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

  // Refresh
  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    suggestions,
    isLoading,
    error,
    refresh,
    toggleFollow,
    followedIds,
    isFollowing: (userId: string) => followedIds.has(userId),
    isToggling:
      followMutation.isPending || unfollowMutation.isPending,
  };
}
