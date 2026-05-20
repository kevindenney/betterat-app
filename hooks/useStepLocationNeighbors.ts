/**
 * useStepLocationNeighbors — counts how many distinct sailors have set step
 * locations within `radiusKm` of (lat, lng). Powers the social-proof tagline
 * on the Plan tab's Where card.
 *
 * Backed by the step_location_neighbor_count Postgres function — bbox-only
 * aggregate, no PostGIS dependency, no key dance.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

interface NeighborCount {
  sailors: number;
  pins: number;
}

export function useStepLocationNeighbors(
  lat: number | undefined,
  lng: number | undefined,
  radiusKm = 5,
) {
  return useQuery<NeighborCount>({
    queryKey: ['step-location-neighbors', lat, lng, radiusKm],
    enabled: lat != null && lng != null,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('step_location_neighbor_count', {
        target_lat: lat,
        target_lng: lng,
        radius_km: radiusKm,
      });
      if (error) throw error;
      // The RPC returns a single-row set; supabase-js gives us an array.
      const row = Array.isArray(data) ? data[0] : data;
      return {
        sailors: Number(row?.sailors ?? 0),
        pins: Number(row?.pins ?? 0),
      };
    },
  });
}
