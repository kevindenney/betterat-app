/**
 * useUpdateRacingArea — UPDATEs an existing user-defined racing area.
 * Mirrors useCreateRacingArea but writes by id. The RLS policy on
 * venue_racing_areas accepts any authenticated user; ownership gating
 * is enforced at the UI layer (community list filters to non-official
 * areas only).
 *
 * Invalidates `atlas-racing-areas` so the polygon shape, name, or
 * classes flip on the canvas immediately.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Polygon } from 'geojson';

import { supabase } from '@/services/supabase';

export interface UpdateRacingAreaInput {
  id: string;
  name: string;
  centerLat: number;
  centerLng: number;
  radiusMeters?: number;
  polygon?: Polygon;
  classesUsed?: string[];
}

export function useUpdateRacingArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateRacingAreaInput) => {
      const trimmedName = input.name.trim();
      if (!trimmedName) {
        throw new Error('Racing area needs a name');
      }
      const radiusMeters = input.radiusMeters ?? 1500;
      const classesUsed = (input.classesUsed ?? [])
        .map((c) => c.trim())
        .filter(Boolean);
      const geometry: Record<string, unknown> = input.polygon
        ? (input.polygon as unknown as Record<string, unknown>)
        : {
            type: 'Point',
            coordinates: [input.centerLng, input.centerLat],
          };
      const { error } = await supabase
        .from('venue_racing_areas')
        .update({
          area_name: trimmedName,
          center_lat: input.centerLat,
          center_lng: input.centerLng,
          radius_meters: radiusMeters,
          geometry,
          classes_used: classesUsed,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id);
      if (error) {
        console.warn('[atlas] update racing area failed', error);
        throw new Error(error.message || 'Could not save changes');
      }
      return input.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atlas-racing-areas'] });
    },
  });
}
