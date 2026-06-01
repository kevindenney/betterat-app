/**
 * useNearestNamedPlace — resolve raw lat/lng to a human-readable venue
 * name by querying the nearest club or sailing POI within `maxKm`.
 *
 * Used to swap "Dropped pin (22.366, 114.270)" style labels (which are
 * literally how the commit-mode flow stamps a location) with the
 * recognizable venue name nearby — e.g. "Hebe Haven" or "RHKYC".
 *
 * Returns null when nothing is in range (caller should keep the
 * original label) or until the query resolves.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export interface NearestNamedPlace {
  name: string;
  short_name: string | null;
  kind: string;
  distance_km: number;
}

interface UseNearestNamedPlaceArgs {
  lat: number | null | undefined;
  lng: number | null | undefined;
  /** Half-side radius in km. Default 0.5 (tight — venue, not region). */
  maxKm?: number;
  enabled?: boolean;
}

export function useNearestNamedPlace({
  lat,
  lng,
  maxKm = 0.5,
  enabled = true,
}: UseNearestNamedPlaceArgs): NearestNamedPlace | null {
  const queryEnabled = enabled && lat != null && lng != null;

  const { data } = useQuery({
    queryKey: ['nearest-named-place', lat, lng, maxKm],
    enabled: queryEnabled,
    staleTime: 60 * 60 * 1000, // 1h — places don't move
    queryFn: async (): Promise<NearestNamedPlace | null> => {
      const { data: rows, error } = await supabase.rpc('nearest_named_place', {
        target_lat: lat,
        target_lng: lng,
        max_km: maxKm,
      });
      if (error || !rows || (rows as unknown[]).length === 0) return null;
      const row = (rows as NearestNamedPlace[])[0];
      return {
        ...row,
        distance_km: Number(row.distance_km),
      };
    },
  });

  return data ?? null;
}

/**
 * Helper: given a location.name + lat/lng, return a friendly display
 * label. When the stored name reads "Dropped pin (...)" (or is empty
 * but lat/lng are present), this resolver swaps in a nearby venue
 * name. Otherwise returns the original name unchanged.
 */
export function isCoordOnlyLabel(name: string | null | undefined): boolean {
  if (!name) return true;
  const trimmed = name.trim().toLowerCase();
  return trimmed.startsWith('dropped pin') || /^\(?\s*-?\d+\.\d+\s*,/.test(trimmed);
}

/**
 * Strip exact coordinates out of an auto-stamped pin label so surfaces that
 * can't resolve a venue name (e.g. a social feed) never expose a precise
 * lat/lng. "Pinned location (22.33, 114.26)" → "Pinned location", bare
 * "22.33, 114.26" → "Pinned location". Any human-written name is returned
 * unchanged. Returns null for empty/missing input.
 */
export function coarseLocationLabel(name: string | null | undefined): string | null {
  if (name == null) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  const prefixed = trimmed.match(/^(dropped pin|pinned location)\b/i);
  if (prefixed) return prefixed[0];
  if (/^\(?\s*-?\d+\.\d+\s*,\s*-?\d+\.\d+\s*\)?$/.test(trimmed)) return 'Pinned location';
  return trimmed;
}
