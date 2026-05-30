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
import { useAuth } from '@/providers/AuthProvider';
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
  /**
   * Optional roster filter. When set, the RPC scopes peer steps to these
   * user_ids only. Used by Atlas chip-row contextual groups (Dragon HK,
   * 2026 Anesthesia, etc.) so the SQL narrows at the bbox query stage
   * rather than relying on client-side filtering.
   */
  restrictUserIds?: string[] | null;
  /** Skip the query entirely when false (e.g. no auth yet). */
  enabled?: boolean;
}

export function useAtlasPeerSteps({
  lat,
  lng,
  radiusKm = 5,
  interestSlug = null,
  restrictUserIds = null,
  enabled = true,
}: UseAtlasPeerStepsArgs) {
  // atlas_peer_steps_near uses auth.uid() inside the RPC. If this query
  // fires before auth is ready, the RPC returns no rows and React Query can
  // cache that empty result. Include user.id in the key and gate execution
  // until auth is available.
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryEnabled = enabled && !!userId && lat != null && lng != null;
  // Stable cache key for restrictUserIds — sort + join so the same set
  // hits cache regardless of insertion order.
  const restrictKey = restrictUserIds && restrictUserIds.length > 0
    ? [...restrictUserIds].sort().join(',')
    : null;
  return useQuery({
    queryKey: ['atlas-peer-steps', userId, lat, lng, radiusKm, interestSlug, restrictKey],
    enabled: queryEnabled,
    staleTime: 30_000,
    queryFn: async (): Promise<AtlasPeerStep[]> => {
      const { data, error } = await supabase.rpc('atlas_peer_steps_near', {
        target_lat: lat,
        target_lng: lng,
        radius_km: radiusKm,
        interest_filter: interestSlug,
        restrict_user_ids: restrictUserIds && restrictUserIds.length > 0 ? restrictUserIds : null,
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
