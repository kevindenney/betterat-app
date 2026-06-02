/**
 * useUserClubs Hook
 *
 * Fetches clubs the current user is a member of.
 * Also includes clubs from their boats' home_club_id references.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import { isMissingRelationError } from '@/lib/utils/supabaseSchemaFallback';

const logger = createLogger('useUserClubs');
const ACTIVE_MEMBERSHIP_STATUSES = ['active', 'approved', 'confirmed', 'current'];

export interface UserClub {
  id: string;
  name: string;
  short_name?: string;
  logo_url?: string;
  website?: string;
  city?: string;
  country?: string;
  /** Whether user is a member through club_members table */
  isMember?: boolean;
  /** Whether this is user's home club (from a boat) */
  isHomeClub?: boolean;
}

interface UseUserClubsOptions {
  /** Whether to include clubs from boat home_club references */
  includeHomeClubs?: boolean;
  /** Whether to enable fetching */
  enabled?: boolean;
}

interface UseUserClubsReturn {
  /** List of user's clubs */
  clubs: UserClub[];
  /** Whether data is loading */
  isLoading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Refetch clubs */
  refetch: () => Promise<void>;
  /** Whether user has any clubs */
  hasClubs: boolean;
}

async function fetchClubsByIds(clubIds: string[]): Promise<UserClub[]> {
  if (clubIds.length === 0) return [];

  const clubsById = new Map<string, UserClub>();

  const clubsResult = await supabase
    .from('clubs')
    .select('id, name, short_name, logo_url, website, location')
    .in('id', clubIds);

  if (!clubsResult.error && clubsResult.data) {
    (clubsResult.data as any[]).forEach((club) => {
      if (!club?.id) return;
      clubsById.set(club.id, {
        id: club.id,
        name: club.name || 'Sailing Club',
        short_name: club.short_name || undefined,
        logo_url: club.logo_url || undefined,
        website: club.website || undefined,
        city: club.location || undefined,
      });
    });
  }

  const unresolvedAfterClubs = clubIds.filter((clubId) => !clubsById.has(clubId));
  if (unresolvedAfterClubs.length > 0 || isMissingRelationError(clubsResult.error)) {
    const idsToResolve = unresolvedAfterClubs.length > 0 ? unresolvedAfterClubs : clubIds;
    const profilesResult = await supabase
      .from('club_profiles')
      .select('id, organization_name, acronym, logo_url, website')
      .in('id', idsToResolve);

    if (!profilesResult.error && profilesResult.data) {
      (profilesResult.data as any[]).forEach((profile) => {
        if (!profile?.id) return;
        clubsById.set(profile.id, {
          id: profile.id,
          name: profile.organization_name || 'Sailing Club',
          short_name: profile.acronym || undefined,
          logo_url: profile.logo_url || undefined,
          website: profile.website || undefined,
        });
      });
    }
  }

  const unresolvedAfterProfiles = clubIds.filter((clubId) => !clubsById.has(clubId));
  if (unresolvedAfterProfiles.length > 0 || isMissingRelationError(clubsResult.error)) {
    const idsToResolve = unresolvedAfterProfiles.length > 0 ? unresolvedAfterProfiles : clubIds;
    const yachtResult = await supabase
      .from('yacht_clubs')
      .select('id, name, short_name, website, formatted_address')
      .in('id', idsToResolve);

    if (!yachtResult.error && yachtResult.data) {
      (yachtResult.data as any[]).forEach((club) => {
        if (!club?.id) return;
        clubsById.set(club.id, {
          id: club.id,
          name: club.name || 'Sailing Club',
          short_name: club.short_name || undefined,
          website: club.website || undefined,
          city: club.formatted_address || undefined,
        });
      });
    }
  }

  const unresolvedAfterYacht = clubIds.filter((clubId) => !clubsById.has(clubId));
  if (unresolvedAfterYacht.length > 0 || isMissingRelationError(clubsResult.error)) {
    const idsToResolve = unresolvedAfterYacht.length > 0 ? unresolvedAfterYacht : clubIds;
    const globalResult = await supabase
      .from('global_clubs')
      .select('id, name, short_name, city, country, website, logo_url, platform_club_id')
      .or(
        `id.in.(${idsToResolve.join(',')}),platform_club_id.in.(${idsToResolve.join(',')})`
      );

    if (!globalResult.error && globalResult.data) {
      (globalResult.data as any[]).forEach((club) => {
        const name = club?.name || 'Sailing Club';
        const clubData = {
          id: club?.platform_club_id || club?.id,
          name,
          short_name: club?.short_name || undefined,
          logo_url: club?.logo_url || undefined,
          website: club?.website || undefined,
          city: club?.city || undefined,
          country: club?.country || undefined,
        } satisfies UserClub;

        if (club?.id && idsToResolve.includes(club.id)) {
          clubsById.set(club.id, clubData);
        }
        if (club?.platform_club_id && idsToResolve.includes(club.platform_club_id)) {
          clubsById.set(club.platform_club_id, clubData);
        }
      });
    }
  }

  return clubIds
    .map((clubId) => clubsById.get(clubId))
    .filter((club): club is UserClub => Boolean(club));
}

export function useUserClubs(options: UseUserClubsOptions = {}): UseUserClubsReturn {
  const { includeHomeClubs = true, enabled = true } = options;
  const { user, ready: authReady } = useAuth();

  // Only enable query when auth is ready and we have a user
  const queryEnabled = enabled && authReady && !!user?.id;

  const {
    data: clubs = [],
    isLoading: queryLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['user-clubs', user?.id, includeHomeClubs],
    queryFn: async () => {
      if (!user?.id) {
        logger.debug('[useUserClubs] No user ID, returning empty');
        return [];
      }

      logger.debug('[useUserClubs] Fetching clubs for user:', user.id);

      const clubMap = new Map<string, UserClub>();

      // 1. Fetch clubs from club_members table
      try {
        let memberships: { club_id?: string | null }[] | null = null;

        const activeMembershipsResult = await supabase
          .from('club_members')
          .select('club_id')
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (!activeMembershipsResult.error) {
          memberships = activeMembershipsResult.data as { club_id?: string | null }[];
        } else {
          // Fallback for schemas that use status instead of is_active.
          const statusMembershipsResult = await supabase
            .from('club_members')
            .select('club_id')
            .eq('user_id', user.id)
            .in('status', ACTIVE_MEMBERSHIP_STATUSES);

          if (!statusMembershipsResult.error) {
            memberships = statusMembershipsResult.data as { club_id?: string | null }[];
          } else {
            const legacyMembershipsResult = await supabase
              .from('club_memberships')
              .select('club_id')
              .eq('user_id', user.id);
            if (!legacyMembershipsResult.error) {
              memberships = legacyMembershipsResult.data as { club_id?: string | null }[];
            }
          }
        }

        if (memberships) {
          const membershipClubIds = Array.from(
            new Set((memberships as { club_id?: string | null }[])
              .map((membership) => membership.club_id)
              .filter(Boolean))
          ) as string[];

          const globalMembershipResult = await supabase
            .from('global_club_members')
            .select('global_club_id')
            .eq('user_id', user.id);
          if (!globalMembershipResult.error && globalMembershipResult.data) {
            const globalClubIds = Array.from(
              new Set(
                (globalMembershipResult.data as any[])
                  .map((row) => row?.global_club_id)
                  .filter(Boolean)
              )
            ) as string[];

            if (globalClubIds.length > 0) {
              const globalClubsResult = await supabase
                .from('global_clubs')
                .select('id, platform_club_id')
                .in('id', globalClubIds);

              if (!globalClubsResult.error && globalClubsResult.data) {
                (globalClubsResult.data as any[]).forEach((club) => {
                  const resolvedClubId = club?.platform_club_id || club?.id;
                  if (resolvedClubId) {
                    membershipClubIds.push(resolvedClubId);
                  }
                });
              }
            }
          }

          const uniqueMembershipClubIds = Array.from(new Set(membershipClubIds));

          if (uniqueMembershipClubIds.length > 0) {
            const memberClubs = await fetchClubsByIds(uniqueMembershipClubIds);
            memberClubs.forEach((club) => {
              clubMap.set(club.id, {
                ...club,
                isMember: true,
              });
            });
          }
        }
      } catch (e) {
        logger.warn('[useUserClubs] Error fetching club memberships:', e);
      }

      // 2. Fetch home clubs from boats (if enabled)
      if (includeHomeClubs) {
        try {
          const { data: boats, error: boatError } = await supabase
            .from('sailor_boats')
            .select('home_club_id')
            .eq('sailor_id', user.id)
            .not('home_club_id', 'is', null);

          if (!boatError && boats) {
            const homeClubIds = Array.from(
              new Set((boats as { home_club_id?: string | null }[])
                .map((boat) => boat.home_club_id)
                .filter(Boolean))
            ) as string[];

            if (homeClubIds.length > 0) {
              const homeClubs = await fetchClubsByIds(homeClubIds);
              homeClubs.forEach((club) => {
                if (!clubMap.has(club.id)) {
                  clubMap.set(club.id, {
                    ...club,
                    isHomeClub: true,
                  });
                } else {
                  const existing = clubMap.get(club.id)!;
                  existing.isHomeClub = true;
                }
              });
            }
          }
        } catch (e) {
          logger.warn('[useUserClubs] Error fetching home clubs from boats:', e);
        }
      }

      const result = Array.from(clubMap.values());

      logger.debug('[useUserClubs] Fetched clubs:', {
        count: result.length,
        clubs: result.map(c => ({ id: c.id, name: c.name })),
      });

      return result;
    },
    enabled: queryEnabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Show loading while auth is not ready OR query is loading
  const isLoading = !authReady || queryLoading;

  return {
    clubs,
    isLoading,
    error: error as Error | null,
    refetch: async () => {
      await refetch();
    },
    hasClubs: clubs.length > 0,
  };
}

/**
 * Fetch all available clubs (for selection when user has no clubs)
 * This is a separate hook to avoid fetching all clubs unless needed.
 */
export function useAllClubs(options: { enabled?: boolean; limit?: number } = {}) {
  const { enabled = true, limit = 50 } = options;

  return useQuery({
    queryKey: ['all-clubs', limit],
    queryFn: async () => {
      const clubsResult = await supabase
        .from('clubs')
        .select('id, name, short_name, logo_url, website, location')
        .order('name', { ascending: true })
        .limit(limit);

      const globalResult = await supabase
        .from('global_clubs')
        .select('id, name, short_name, logo_url, city, country, platform_club_id')
        .order('name', { ascending: true })
        .limit(limit);

      const globalClubs = !globalResult.error && globalResult.data
        ? (globalResult.data as any[]).map((club) => ({
            id: club.platform_club_id || club.id,
            name: club.name || 'Sailing Club',
            short_name: club.short_name || undefined,
            logo_url: club.logo_url || undefined,
            city: club.city || undefined,
            country: club.country || undefined,
          }))
        : [];

      if (!clubsResult.error && clubsResult.data && clubsResult.data.length > 0) {
        const mappedClubs = (clubsResult.data as any[]).map((club) => ({
          id: club.id,
          name: club.name || 'Sailing Club',
          short_name: club.short_name || undefined,
          logo_url: club.logo_url || undefined,
          website: club.website || undefined,
          city: club.location || undefined,
        }));
        const merged = [...globalClubs, ...mappedClubs];
        return Array.from(new Map(merged.map((club) => [club.id, club])).values());
      }

      const yachtResult = await supabase
        .from('yacht_clubs')
        .select('id, name, short_name, website, formatted_address')
        .order('name', { ascending: true })
        .limit(limit);
      if (!yachtResult.error && yachtResult.data && yachtResult.data.length > 0) {
        const mappedYacht = (yachtResult.data as any[]).map((club) => ({
          id: club.id,
          name: club.name || 'Sailing Club',
          short_name: club.short_name || undefined,
          website: club.website || undefined,
          city: club.formatted_address || undefined,
        }));
        const merged = [...globalClubs, ...mappedYacht];
        return Array.from(new Map(merged.map((club) => [club.id, club])).values());
      }

      const profilesResult = await supabase
        .from('club_profiles')
        .select('id, organization_name, acronym, logo_url, website')
        .order('organization_name', { ascending: true })
        .limit(limit);
      if (!profilesResult.error && profilesResult.data && profilesResult.data.length > 0) {
        const mappedProfiles = (profilesResult.data as any[]).map((profile) => ({
          id: profile.id,
          name: profile.organization_name || 'Sailing Club',
          short_name: profile.acronym || undefined,
          logo_url: profile.logo_url || undefined,
          website: profile.website || undefined,
        }));
        const merged = [...globalClubs, ...mappedProfiles];
        return Array.from(new Map(merged.map((club) => [club.id, club])).values());
      }

      const finalError = clubsResult.error || yachtResult.error || profilesResult.error;
      if (finalError && !isMissingRelationError(finalError)) {
        logger.error('[useAllClubs] Error fetching clubs:', finalError);
        throw finalError;
      }

      return globalClubs;
    },
    enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes - clubs don't change often
  });
}

export type { UseUserClubsOptions, UseUserClubsReturn };
