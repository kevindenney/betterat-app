/**
 * useNearestPlace — calls the `nearest_named_place(lat, lng, max_km)`
 * RPC to reverse-geocode a long-press / dropped pin against the
 * union of clubs + sailing_pois, returning the closest known place
 * within `radiusKm`. Used to swap raw "Dropped pin (22.366, 114.270)"
 * labels for human-readable "Near Hebe Haven" / "Near RHKYC" copy.
 *
 * Cached per coord pair (rounded to 4dp ~ 11m) so a slider drag or
 * minor pin nudge doesn't refetch.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export interface NearestPlace {
  name: string;
  shortName: string | null;
  kind: string | null;
  distanceKm: number;
}

interface UseNearestPlaceArgs {
  lat: number | null;
  lng: number | null;
  /** Search radius in km. Default 2. */
  radiusKm?: number;
  enabled?: boolean;
}

function roundCoord(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function useNearestPlace({
  lat,
  lng,
  radiusKm = 2,
  enabled = true,
}: UseNearestPlaceArgs) {
  const queryEnabled = enabled && lat != null && lng != null;
  const roundedLat = lat != null ? roundCoord(lat) : null;
  const roundedLng = lng != null ? roundCoord(lng) : null;

  return useQuery({
    queryKey: ['nearest-place', roundedLat, roundedLng, radiusKm],
    enabled: queryEnabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<NearestPlace | null> => {
      if (lat == null || lng == null) return null;
      const { data, error } = await supabase.rpc('nearest_named_place', {
        target_lat: lat,
        target_lng: lng,
        max_km: radiusKm,
      });
      if (error) {
        console.warn('[atlas] nearest_named_place error', error);
        return null;
      }
      const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
      if (!row) return null;
      return {
        name: row.name,
        shortName: row.short_name ?? null,
        kind: row.kind ?? null,
        distanceKm: Number(row.distance_km),
      };
    },
  });
}

/**
 * Formats a near-place label for sheet bodies. Falls back to raw
 * coordinates when no place is in range.
 */
export function formatNearLabel(
  place: NearestPlace | null | undefined,
  lat: number,
  lng: number,
): string {
  if (place) {
    const label = place.shortName ?? place.name;
    return `Near ${label}`;
  }
  return `${lat.toFixed(4)} N · ${lng.toFixed(4)} E`;
}
