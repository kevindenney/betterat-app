/**
 * Location-picker search sources: `sailing_venues` (coordinate-bearing,
 * OSM-sourced — also keys racing-area lookups) and general Nominatim place
 * search. Selection is persisted via useSetLocationFocus (users table).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { nominatimService } from '@/services/location/NominatimService';

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

export interface PlaceSearchResult {
  id: string;
  name: string;
  detail: string | null;
  lat: number;
  lng: number;
}

/**
 * General place search via Nominatim (free OSM geocoding, rate-limited in
 * the service). Lets the picker resolve any town/harbour/campus — not just
 * rows in `sailing_venues`.
 */
export function usePlaceSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['place-search', trimmed],
    enabled: trimmed.length >= 3,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PlaceSearchResult[]> => {
      try {
        const results = await nominatimService.search(trimmed, { limit: 6 });
        return results.map((r) => {
          const [name, ...rest] = r.displayName.split(',');
          return {
            id: `${r.osmType}:${r.osmId}`,
            name: name.trim(),
            detail: rest.length > 0 ? rest.join(',').trim() : null,
            lat: r.lat,
            lng: r.lng,
          };
        });
      } catch (e) {
        console.warn('[location-picker] place search error', e);
        return [];
      }
    },
  });
}
