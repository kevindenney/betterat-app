/**
 * useLocationFocus — the user's *current* location anchor for the Nearby /
 * Atlas surfaces.
 *
 * Replaces the "home venue" concept: people travel, so the anchor is a
 * movable focus (users.location_focus_*) rather than a fixed home base.
 * The old sailing home venue (sailor_profiles.home_venue_*) remains as a
 * fallback anchor and as the key for racing-area lookups.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { nominatimService } from '@/services/location/NominatimService';
import { useAuth } from '@/providers/AuthProvider';
import { USER_HOME_VENUE_KEY } from '@/hooks/useUserHomeVenue';

/**
 * Human label for raw coordinates: nearest named Atlas place first (RPC),
 * Nominatim reverse-geocode second, "lat, lng" as the last resort.
 */
export async function labelForCoords(lat: number, lng: number): Promise<string> {
  try {
    const { data } = await supabase.rpc('nearest_named_place', {
      target_lat: lat,
      target_lng: lng,
      max_km: 25,
    });
    const row = Array.isArray(data) ? data[0] : null;
    if (row?.short_name || row?.name) return row.short_name ?? row.name;
  } catch {
    // fall through to reverse geocode
  }
  try {
    // zoom 14 = village/suburb granularity ("Yung Shue Wan"), not the
    // nearest shop the default building-level reverse would return.
    const rev = await nominatimService.reverse(lat, lng, { zoom: 14 });
    if (rev?.displayName) return rev.displayName.split(',')[0].trim();
  } catch {
    // fall through to raw coords
  }
  return `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
}

export interface SetLocationFocusInput {
  lat: number;
  lng: number;
  label: string;
  /**
   * sailing_venues.id when the pick came from the venue search. Also
   * snapshots home_venue_* so racing-area lookups stay keyed for sailors.
   */
  venueId?: string | null;
}

export function useSetLocationFocus() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  return useMutation({
    mutationFn: async (input: SetLocationFocusInput) => {
      if (!userId) throw new Error('Not signed in.');
      const { error } = await supabase
        .from('users')
        .update({
          location_focus_lat: input.lat,
          location_focus_lng: input.lng,
          location_focus_label: input.label,
          location_focus_set_at: new Date().toISOString(),
        })
        .eq('id', userId);
      if (error) throw error;

      if (input.venueId) {
        const patch = {
          home_venue_id: input.venueId,
          home_venue_name: input.label,
          home_venue_lat: input.lat,
          home_venue_lng: input.lng,
        };
        const { data } = await supabase
          .from('sailor_profiles')
          .update(patch)
          .eq('user_id', userId)
          .select('id');
        if (!data || data.length === 0) {
          await supabase.from('sailor_profiles').insert({ user_id: userId, ...patch });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USER_HOME_VENUE_KEY, userId] });
    },
  });
}
