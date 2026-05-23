/**
 * useCohortHeatmap — bbox-bounded grid aggregation of nursing cohort step
 * pins for the Atlas F4 z11+ overlay. Calls the SECURITY DEFINER RPC
 * `atlas_cohort_step_hex` which enforces the design's HIPAA gate: returns
 * cell-level counts + dominant competency cluster, never individual pins.
 *
 * The map renders one semi-transparent "cell" pin per row — color
 * encoded by the dominant competency cluster (cardiac=coral, respiratory=
 * slate, medication=amber, general=neutral). Cells with <2 steps are
 * filtered out server-side so the overlay never reveals a singleton.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import type { AtlasPinSpec } from '@/components/ios-register/atlas/AtlasMapLibreCanvas';

export interface CohortHexCell {
  cell_lat: number;
  cell_lng: number;
  step_count: number;
  dominant_cluster: 'cardiac' | 'respiratory' | 'medication' | 'general' | string;
  sample_step_id: string;
}

interface UseCohortHeatmapArgs {
  /** Center of the bbox — F4 camera centroid is the default. */
  centerLat: number;
  centerLng: number;
  /** Half-side of the bbox in km. Default 25. */
  radiusKm?: number;
  /** Interest slug filter — nursing for F4. */
  interestSlug?: string | null;
  /** Cell edge length in km — controls density. Default 0.5. */
  cellKm?: number;
  /** Chip-gated visibility. */
  enabled?: boolean;
}

export function useCohortHeatmap({
  centerLat,
  centerLng,
  radiusKm = 25,
  interestSlug = null,
  cellKm = 0.5,
  enabled = true,
}: UseCohortHeatmapArgs) {
  return useQuery({
    queryKey: ['cohort-heatmap', centerLat, centerLng, radiusKm, interestSlug, cellKm],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<AtlasPinSpec[]> => {
      const { data, error } = await supabase.rpc('atlas_cohort_step_hex', {
        target_lat: centerLat,
        target_lng: centerLng,
        radius_km: radiusKm,
        interest_filter: interestSlug,
        cell_km: cellKm,
      });
      if (error || !data) return [];
      const cells = data as CohortHexCell[];
      return cells.map((c) => ({
        id: `cohort-cell:${c.sample_step_id}`,
        lat: Number(c.cell_lat),
        lng: Number(c.cell_lng),
        kind: 'cohort-cell' as const,
        // count|cluster — renderer parses both
        label: `${c.step_count}|${c.dominant_cluster}`,
      }));
    },
  });
}
