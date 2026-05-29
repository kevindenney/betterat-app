/**
 * useHomeVenuePicker — search `sailing_venues` and persist the chosen one as
 * the user's home venue.
 *
 * Home venue anchors the Nearby surfaces (Discover/Watch/Atlas) on a
 * coordinate. Clubs carry no lat/lng, so the picker draws from
 * `sailing_venues` (OSM-sourced, coordinate-bearing) and snapshots the
 * selection's id/name/lat/lng onto `sailor_profiles`.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { USER_HOME_VENUE_KEY } from '@/hooks/useUserHomeVenue';

export interface VenueSearchResult {
  id: string;
  name: string;
  lat: number;
  lng: number;
  region: string | null;
  country: string | null;
}

interface SailingVenueRow {
  id: string;
  name: string | null;
  coordinates_lat: string | number | null;
  coordinates_lng: string | number | null;
  region: string | null;
  country: string | null;
}

function toNum(v: string | number | null): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/** Debounced-ish venue search by name. Caller passes the trimmed query. */
export function useVenueSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['venue-search', trimmed],
    enabled: trimmed.length >= 2,
    staleTime: 60_000,
    queryFn: async (): Promise<VenueSearchResult[]> => {
      const { data, error } = await supabase
        .from('sailing_venues')
        .select('id, name, coordinates_lat, coordinates_lng, region, country')
        .ilike('name', `%${trimmed}%`)
        .not('coordinates_lat', 'is', null)
        .limit(30);
      if (error) {
        console.warn('[home-venue] venue search error', error);
        return [];
      }
      return ((data ?? []) as SailingVenueRow[])
        .map((r) => {
          const lat = toNum(r.coordinates_lat);
          const lng = toNum(r.coordinates_lng);
          if (lat == null || lng == null || !r.name) return null;
          return {
            id: r.id,
            name: r.name,
            lat,
            lng,
            region: r.region && r.region !== 'Unknown' ? r.region : null,
            country: r.country && r.country !== 'Unknown' ? r.country : null,
          } as VenueSearchResult;
        })
        .filter((r): r is VenueSearchResult => r !== null);
    },
  });
}

export function useSetHomeVenue() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  return useMutation({
    mutationFn: async (venue: VenueSearchResult) => {
      if (!userId) throw new Error('Not signed in.');
      const patch = {
        home_venue_id: venue.id,
        home_venue_name: venue.name,
        home_venue_lat: venue.lat,
        home_venue_lng: venue.lng,
      };
      const { data, error } = await supabase
        .from('sailor_profiles')
        .update(patch)
        .eq('user_id', userId)
        .select('id');
      if (error) throw error;
      // No profile row yet — create one so the home venue persists.
      if (!data || data.length === 0) {
        const { error: insertError } = await supabase
          .from('sailor_profiles')
          .insert({ user_id: userId, ...patch });
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USER_HOME_VENUE_KEY, userId] });
    },
  });
}
