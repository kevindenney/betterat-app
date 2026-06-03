/**
 * useAtlasOrgSteps — fetches org-published located steps inside a bbox around
 * (lat, lng) via the `atlas_org_steps_near` RPC. Each row is an attendable
 * piece of activity an organization put on the map (e.g. a race briefing, a
 * learn-to-sail session), carrying org + blueprint provenance.
 *
 * This is the "what's my org doing nearby" lens — distinct from useAtlasPeerSteps
 * ("who in my graph is nearby"). Org events are NOT privacy-jittered: you need
 * the exact spot to show up. Visibility (public vs org-members-only) is gated
 * server-side in the SECURITY DEFINER RPC.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';

export interface AtlasOrgStep {
  step_id: string;
  lat: number;
  lng: number;
  /** Event/step title ("Dragon Saturday Series — Race Briefing"). */
  title: string | null;
  /** Named place the step is pinned to ("Kellett Island Clubhouse"). */
  place_name: string | null;
  org_id: string;
  org_name: string | null;
  org_slug: string | null;
  /** Source blueprint/program title, when the step came from one. */
  blueprint_title: string | null;
  set_at: string | null;
}

interface UseAtlasOrgStepsArgs {
  /** bbox center latitude */
  lat: number | null;
  /** bbox center longitude */
  lng: number | null;
  /** half-side of the bbox in km. Default 25 (org events are venue-scale). */
  radiusKm?: number;
  /** Optional interest filter ('sail-racing', 'nursing', ...). Null = all. */
  interestSlug?: string | null;
  /** Skip the query entirely when false (e.g. no auth yet). */
  enabled?: boolean;
}

export function useAtlasOrgSteps({
  lat,
  lng,
  radiusKm = 25,
  interestSlug = null,
  enabled = true,
}: UseAtlasOrgStepsArgs) {
  // The RPC reads auth.uid() for the org-member visibility branch. Gate on a
  // resolved user id and include it in the key so a pre-auth empty result
  // isn't cached against the signed-in viewer.
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryEnabled = enabled && !!userId && lat != null && lng != null;
  return useQuery({
    queryKey: ['atlas-org-steps', userId, lat, lng, radiusKm, interestSlug],
    enabled: queryEnabled,
    staleTime: 60_000,
    queryFn: async (): Promise<AtlasOrgStep[]> => {
      const { data, error } = await supabase.rpc('atlas_org_steps_near', {
        target_lat: lat,
        target_lng: lng,
        radius_km: radiusKm,
        interest_filter: interestSlug,
      });
      if (error) {
        console.warn('[atlas] atlas_org_steps_near error', error);
        return [];
      }
      return (data ?? []) as AtlasOrgStep[];
    },
  });
}
