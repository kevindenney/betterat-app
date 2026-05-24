/**
 * useAtlasPeerSteps — fetches peer step pins inside a bbox around (lat, lng)
 * via the `atlas_peer_steps_near` RPC. Returns one row per visible step with
 * its relationship to the viewer (self/crew/cohort/fleet/following/public),
 * already privacy-jittered for neighborhood/site precision.
 *
 * Audience filtering, jitter, and relationship labels happen server-side —
 * see the SECURITY DEFINER RPC. The client just renders.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export type AtlasPeerRelationship =
  | 'self'
  | 'crew'
  | 'cohort'
  | 'fleet'
  | 'following'
  | 'public';

export interface AtlasPeerStep {
  step_id: string;
  lat: number;
  lng: number;
  set_by: string;
  relationship: AtlasPeerRelationship;
  preview_name: string | null;
  loc_precision: string | null;
  poi_id: string | null;
  set_at: string;
}

interface UseAtlasPeerStepsArgs {
  /** bbox center latitude */
  lat: number | null;
  /** bbox center longitude */
  lng: number | null;
  /** half-side of the bbox in km. Default 5. */
  radiusKm?: number;
  /** Optional interest filter ('sail-racing', 'nursing', ...). Null = all. */
  interestSlug?: string | null;
  /** Skip the query entirely when false (e.g. no auth yet). */
  enabled?: boolean;
}

export function useAtlasPeerSteps({
  lat,
  lng,
  radiusKm = 5,
  interestSlug = null,
  enabled = true,
}: UseAtlasPeerStepsArgs) {
  const queryEnabled = enabled && lat != null && lng != null;
  return useQuery({
    queryKey: ['atlas-peer-steps', lat, lng, radiusKm, interestSlug],
    enabled: queryEnabled,
    staleTime: 30_000,
    queryFn: async (): Promise<AtlasPeerStep[]> => {
      const { data, error } = await supabase.rpc('atlas_peer_steps_near', {
        target_lat: lat,
        target_lng: lng,
        radius_km: radiusKm,
        interest_filter: interestSlug,
      });
      if (error) {
        // Surface RPC failures — silently swallowing them once already
        // hid the RETURNS-TABLE column-shadow bug that wiped peer pins.
        console.warn('[atlas] atlas_peer_steps_near error', error);
        return [];
      }
      return (data ?? []) as AtlasPeerStep[];
    },
  });
}
