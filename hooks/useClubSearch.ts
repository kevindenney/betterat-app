/**
 * useClubSearch - Hook for searching and filtering clubs
 *
 * Provides:
 * - Club search with query
 * - Filter by location/boat class
 * - Join/leave functionality
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { ClubDiscoveryService } from '@/services/ClubDiscoveryService';
import { organizationDiscoveryService } from '@/services/OrganizationDiscoveryService';
import type { ClubSearchResult } from '@/components/search/ClubSearchRow';

const normalizeName = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

interface UseClubSearchOptions {
  query?: string;
  filter?: string | null;
  location?: string;
  countryCode?: string;
  boatClassId?: string;
  limit?: number;
}

export function useClubSearch(options: UseClubSearchOptions = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { query = '', filter, location, countryCode, boatClassId, limit = 50 } = options;
  const isMountedRef = useRef(true);
  const activeUserIdRef = useRef<string | null>(user?.id ?? null);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    isMountedRef.current = true;
    activeUserIdRef.current = user?.id ?? null;
    return () => {
      isMountedRef.current = false;
    };
  }, [user?.id]);

  // Fetch clubs
  const {
    data,
    isLoading,
    refetch,
    error,
  } = useQuery({
    queryKey: ['club-search', query, filter, location, countryCode, boatClassId],
    queryFn: async () => {
      // Use ClubDiscoveryService to search the sailing club directory.
      const clubs = await ClubDiscoveryService.searchClubs({
        query: query || undefined,
        region: location,
        countryCode,
        boatClassId,
        limit,
      });

      // Merge in platform organizations (incl. user-started orgs) so a club
      // someone created shows up where they look for it. searchOrganizations
      // returns [] for an empty query, so browse mode stays directory-only.
      const orgs = query.trim()
        ? await organizationDiscoveryService.searchOrganizations({
            query: query.trim(),
            limit,
          })
        : [];

      const clubNames = new Set(clubs.map((c: any) => normalizeName(c.name || '')));
      const orgRows = orgs
        .filter((o) => o.slug && !clubNames.has(normalizeName(o.name)))
        .map((o) => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
          description: null,
          region: o.organization_type
            ? o.organization_type.replace(/_/g, ' ')
            : null,
          memberCount: 0,
          source: 'org' as const,
          official: o.official ?? false,
        }));

      return [...clubs, ...orgRows];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch user's joined clubs to check membership
  const { data: userClubs } = useQuery({
    queryKey: ['club-search-user-clubs', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return ClubDiscoveryService.getUserClubs(user.id);
    },
    enabled: !!user?.id,
  });

  // Update joined IDs when user clubs load
  useEffect(() => {
    if (!isMountedRef.current) return;
    if (!user?.id || !userClubs) {
      setJoinedIds(new Set());
      return;
    }
    setJoinedIds(new Set(userClubs.map((c: any) => c.id)));
  }, [user?.id, userClubs]);

  // Transform to ClubSearchResult format
  const clubs: ClubSearchResult[] = useMemo(() => {
    if (!data) return [];

    return data.map((club: any) => ({
      id: club.id,
      name: club.name,
      slug: club.slug,
      description: club.description,
      location: club.region || club.location,
      logoUrl: club.logoUrl,
      memberCount: club.memberCount || 0,
      boatClassName: club.boatClassName,
      isJoined: joinedIds.has(club.id),
      source: club.source as 'platform' | 'directory' | 'org' | undefined,
      official: club.official,
    }));
  }, [data, joinedIds]);

  // Join mutation
  const joinMutation = useMutation({
    mutationFn: async (clubId: string) => {
      const targetUserId = activeUserIdRef.current;
      if (!targetUserId) throw new Error('Not authenticated');
      await ClubDiscoveryService.joinClub(targetUserId, clubId);
      return clubId;
    },
    onSuccess: (clubId) => {
      const targetUserId = activeUserIdRef.current;
      if (!isMountedRef.current || !targetUserId) return;
      setJoinedIds((prev) => new Set([...prev, clubId]));
      queryClient.invalidateQueries({ queryKey: ['club-search-user-clubs', targetUserId] });
    },
  });

  // Leave mutation
  const leaveMutation = useMutation({
    mutationFn: async (clubId: string) => {
      const targetUserId = activeUserIdRef.current;
      if (!targetUserId) throw new Error('Not authenticated');
      await ClubDiscoveryService.leaveClub(targetUserId, clubId);
      return clubId;
    },
    onSuccess: (clubId) => {
      const targetUserId = activeUserIdRef.current;
      if (!isMountedRef.current || !targetUserId) return;
      setJoinedIds((prev) => {
        const next = new Set(prev);
        next.delete(clubId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['club-search-user-clubs', targetUserId] });
    },
  });

  // Toggle join
  const toggleJoin = useCallback(
    async (clubId: string) => {
      if (joinedIds.has(clubId)) {
        await leaveMutation.mutateAsync(clubId);
      } else {
        await joinMutation.mutateAsync(clubId);
      }
    },
    [joinedIds, joinMutation, leaveMutation]
  );

  // Refresh
  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    clubs,
    isLoading,
    error,
    refresh,
    toggleJoin,
    joinedIds,
    isJoined: (clubId: string) => joinedIds.has(clubId),
    isToggling: joinMutation.isPending || leaveMutation.isPending,
  };
}
