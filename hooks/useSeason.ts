/**
 * Season Hooks
 *
 * React Query hooks for season data fetching.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SeasonService } from '@/services/SeasonService';
import { useAuth } from '@/providers/AuthProvider';
import type {
  CreateSeasonInput,
  UpdateSeasonInput,
  SeasonStatus,
} from '@/types/season';

// =============================================================================
// QUERY KEYS
// =============================================================================

export const seasonKeys = {
  all: ['seasons'] as const,
  lists: () => [...seasonKeys.all, 'list'] as const,
  list: (userId: string, status?: SeasonStatus | SeasonStatus[]) =>
    [...seasonKeys.lists(), userId, status] as const,
  current: (userId: string) => [...seasonKeys.all, 'current', userId] as const,
  details: () => [...seasonKeys.all, 'detail'] as const,
  detail: (id: string) => [...seasonKeys.details(), id] as const,
  standings: (seasonId: string) => [...seasonKeys.all, 'standings', seasonId] as const,
  regattas: (seasonId: string) => [...seasonKeys.all, 'regattas', seasonId] as const,
};

// =============================================================================
// CURRENT SEASON HOOK
// =============================================================================

/**
 * Get the current active season for the logged-in user
 */
export function useCurrentSeason() {
  const { user } = useAuth();

  return useQuery({
    queryKey: seasonKeys.current(user?.id || ''),
    queryFn: async () => {
      if (!user?.id) return null;
      return SeasonService.getCurrentSeason(user.id);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// =============================================================================
// USER SEASONS HOOK
// =============================================================================

/**
 * Get all seasons for the logged-in user
 */
export function useUserSeasons(options?: {
  status?: SeasonStatus | SeasonStatus[];
  limit?: number;
}) {
  const { user } = useAuth();

  return useQuery({
    queryKey: seasonKeys.list(user?.id || '', options?.status),
    queryFn: async () => {
      if (!user?.id) return [];
      return SeasonService.getUserSeasons(user.id, options);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get archived seasons for the logged-in user
 */
export function useArchivedSeasons() {
  const { user } = useAuth();

  return useQuery({
    queryKey: seasonKeys.list(user?.id || '', 'archived'),
    queryFn: async () => {
      if (!user?.id) return [];
      return SeasonService.getArchivedSeasons(user.id);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
}

// =============================================================================
// SEASON DETAIL HOOK
// =============================================================================

/**
 * Get a specific season with full details
 */
export function useSeasonDetail(seasonId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: seasonKeys.detail(seasonId || ''),
    queryFn: async () => {
      if (!seasonId) return null;
      return SeasonService.getSeasonWithDetails(seasonId, user?.id);
    },
    enabled: !!seasonId,
    staleTime: 5 * 60 * 1000,
  });
}

// =============================================================================
// SEASON STANDINGS HOOK
// =============================================================================

/**
 * Get standings for a season
 */
export function useSeasonStandings(seasonId: string | undefined, options?: {
  division?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: seasonKeys.standings(seasonId || ''),
    queryFn: async () => {
      if (!seasonId) return [];
      return SeasonService.getSeasonStandings(seasonId, options);
    },
    enabled: !!seasonId,
    staleTime: 2 * 60 * 1000, // 2 minutes (standings may update more frequently)
  });
}

// =============================================================================
// SEASON REGATTAS HOOK
// =============================================================================

/**
 * Get regattas in a season
 */
export function useSeasonRegattas(seasonId: string | undefined) {
  return useQuery({
    queryKey: seasonKeys.regattas(seasonId || ''),
    queryFn: async () => {
      if (!seasonId) return [];
      return SeasonService.getSeasonRegattas(seasonId);
    },
    enabled: !!seasonId,
    staleTime: 5 * 60 * 1000,
  });
}

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Create a new season
 */
export function useCreateSeason() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateSeasonInput) => {
      if (!user?.id) throw new Error('User not authenticated');
      return SeasonService.createSeason(input, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: seasonKeys.lists() });
      // "Current" is the newest-start-date active season, so a freshly
      // created arc usually IS the new current one. Without this the
      // timeline keeps the old arc selected and renders the new arc as a
      // dataless past lane ("archived · 0 weeks").
      queryClient.invalidateQueries({ queryKey: seasonKeys.current(user?.id || '') });
    },
  });
}

/**
 * Update a season
 */
export function useUpdateSeason() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ seasonId, input }: { seasonId: string; input: UpdateSeasonInput }) => {
      return SeasonService.updateSeason(seasonId, input);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: seasonKeys.lists() });
      queryClient.invalidateQueries({ queryKey: seasonKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: seasonKeys.current(data.user_id || '') });
    },
  });
}

/**
 * Archive a season
 */
export function useArchiveSeason() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (seasonId: string) => {
      return SeasonService.archiveSeason(seasonId);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: seasonKeys.lists() });
      queryClient.invalidateQueries({ queryKey: seasonKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: seasonKeys.current(data.user_id || '') });
    },
  });
}

/**
 * Delete a season
 */
export function useDeleteSeason() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (seasonId: string) => {
      return SeasonService.deleteSeason(seasonId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: seasonKeys.lists() });
    },
  });
}

/**
 * Compute season standings
 */
export function useComputeSeasonStandings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (seasonId: string) => {
      return SeasonService.computeSeasonStandings(seasonId);
    },
    onSuccess: (_, seasonId) => {
      queryClient.invalidateQueries({ queryKey: seasonKeys.standings(seasonId) });
      queryClient.invalidateQueries({ queryKey: seasonKeys.detail(seasonId) });
    },
  });
}

/**
 * Add a regatta to a season
 */
export function useAddRegattaToSeason() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      seasonId,
      regattaId,
      options,
    }: {
      seasonId: string;
      regattaId: string;
      options?: { sequence?: number; weight?: number; is_championship?: boolean };
    }) => {
      return SeasonService.addRegattaToSeason(seasonId, regattaId, options);
    },
    onSuccess: (_, { seasonId }) => {
      queryClient.invalidateQueries({ queryKey: seasonKeys.regattas(seasonId) });
      queryClient.invalidateQueries({ queryKey: seasonKeys.detail(seasonId) });
    },
  });
}

/**
 * Remove a regatta from a season
 */
export function useRemoveRegattaFromSeason() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ seasonId, regattaId }: { seasonId: string; regattaId: string }) => {
      return SeasonService.removeRegattaFromSeason(seasonId, regattaId);
    },
    onSuccess: (_, { seasonId }) => {
      queryClient.invalidateQueries({ queryKey: seasonKeys.regattas(seasonId) });
      queryClient.invalidateQueries({ queryKey: seasonKeys.detail(seasonId) });
    },
  });
}
