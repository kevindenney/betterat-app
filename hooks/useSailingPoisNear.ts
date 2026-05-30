/**
 * useSailingPoisNear — fetch sailing land-side POIs (marinas, sail
 * lofts, chandlers, repair, rigging) inside a bounding box.
 *
 * Backs the Atlas "Marinas & clubs" and "Sail services" layer toggles.
 * The Marinas toggle scopes to kind='marina'; Sail services scopes to
 * kind in ('sail_loft', 'chandler', 'repair', 'rigging'). Callers pass
 * whichever subset they want via the `kinds` arg.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export type SailingPoiKind = 'marina' | 'sail_loft' | 'chandler' | 'repair' | 'rigging';

export interface SailingPoiRow {
  id: string;
  kind: SailingPoiKind;
  name: string;
  short_name: string | null;
  latitude: number;
  longitude: number;
  club_id: string | null;
}

interface UseSailingPoisNearArgs {
  /** Bounding box. When null, query is disabled. */
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number } | null;
  /**
   * Optional kind filter. When omitted, all five kinds are returned;
   * pass e.g. `['marina']` to scope to just marinas.
   */
  kinds?: SailingPoiKind[];
}

async function fetchSailingPoisNear(
  bbox: NonNullable<UseSailingPoisNearArgs['bbox']>,
  kinds?: SailingPoiKind[],
): Promise<SailingPoiRow[]> {
  const { data, error } = await supabase.rpc('atlas_sailing_pois_near', {
    min_lat: bbox.minLat,
    max_lat: bbox.maxLat,
    min_lng: bbox.minLng,
    max_lng: bbox.maxLng,
    kinds: kinds ?? null,
  });
  if (error) throw error;
  return (data as SailingPoiRow[]) ?? [];
}

export function useSailingPoisNear({ bbox, kinds }: UseSailingPoisNearArgs) {
  const kindsKey = kinds ? [...kinds].sort().join(',') : 'all';
  return useQuery({
    queryKey: ['sailing-pois-near', bbox, kindsKey],
    queryFn: () => fetchSailingPoisNear(bbox!, kinds),
    enabled: Boolean(bbox),
    staleTime: 5 * 60 * 1000,
  });
}
