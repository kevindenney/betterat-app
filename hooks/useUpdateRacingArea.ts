/**
 * useUpdateRacingArea — UPDATEs an existing user-defined racing area in
 * atlas_pois. Mirrors useCreateRacingArea but writes by id. RLS only
 * lets the author update their own user_proposed rows.
 *
 * The sailing specifics (radius_meters, classes_used, …) live inside the
 * `metadata` jsonb, so the row's current metadata is read first and merged —
 * a blind overwrite would drop venue_id/description written elsewhere.
 *
 * Invalidates the racing-area queries so the polygon shape, name, or
 * classes flip on the canvas immediately.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Polygon } from 'geojson';

import { supabase } from '@/services/supabase';

import { invalidateRacingAreaQueries } from './racingAreaInvalidations';

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
      const { data: existing, error: readError } = await supabase
        .from('atlas_pois')
        .select('metadata')
        .eq('id', input.id)
        .single();
      if (readError) {
        console.warn('[atlas] update racing area read failed', readError);
        throw new Error(readError.message || 'Could not save changes');
      }
      const metadata = {
        ...((existing?.metadata as Record<string, unknown> | null) ?? {}),
        radius_meters: radiusMeters,
        classes_used: classesUsed,
      };
      const { error } = await supabase
        .from('atlas_pois')
        .update({
          name: trimmedName,
          lat: input.centerLat,
          lng: input.centerLng,
          geometry,
          metadata,
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
      invalidateRacingAreaQueries(queryClient);
    },
  });
}
