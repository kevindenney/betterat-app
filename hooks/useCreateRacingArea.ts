/**
 * useCreateRacingArea — INSERTs a user-defined racing area into
 * venue_racing_areas. The community RLS policy (see
 * 20260106000000_community_racing_areas) requires
 * source='community' AND created_by=auth.uid().
 *
 * Returns the inserted row so callers can route into a detail sheet
 * or zoom the map to the new area. Invalidates the read-side
 * `atlas-racing-areas` queries on success.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';

export interface CreateRacingAreaInput {
  /** Display name, e.g. "Middle Island". */
  name: string;
  centerLat: number;
  centerLng: number;
  /** Radius of the circular area in meters. Default 1500. */
  radiusMeters?: number;
  /**
   * Boat classes that race here (free-text tags so users can write
   * their own class names — e.g. "Dragon", "J/80", "Etchells").
   */
  classesUsed?: string[];
  /** Optional human-language note shown in the area detail sheet. */
  description?: string;
}

export interface CreatedRacingArea {
  id: string;
  area_name: string;
  center_lat: number;
  center_lng: number;
  radius_meters: number;
  source: 'community';
  verification_status: 'pending';
  classes_used: string[];
  created_by: string;
}

export function useCreateRacingArea() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateRacingAreaInput): Promise<CreatedRacingArea> => {
      if (!user?.id) {
        throw new Error('Must be signed in to create a racing area');
      }
      const trimmedName = input.name.trim();
      if (!trimmedName) {
        throw new Error('Racing area needs a name');
      }
      const radiusMeters = input.radiusMeters ?? 1500;
      const classesUsed = (input.classesUsed ?? [])
        .map((c) => c.trim())
        .filter(Boolean);
      const { data, error } = await supabase
        .from('venue_racing_areas')
        .insert({
          area_name: trimmedName,
          area_type: 'racing_area',
          source: 'community',
          created_by: user.id,
          center_lat: input.centerLat,
          center_lng: input.centerLng,
          radius_meters: radiusMeters,
          classes_used: classesUsed,
          description: input.description?.trim() || null,
          // Point geometry mirrors the seed shape so any consumer that
          // still reads `geometry` directly gets a usable centroid.
          geometry: {
            type: 'Point',
            coordinates: [input.centerLng, input.centerLat],
          },
        })
        .select(
          'id, area_name, center_lat, center_lng, radius_meters, source, verification_status, classes_used, created_by',
        )
        .single();
      if (error) {
        // PostgrestError isn't an Error instance — surface code+message
        // so callers and Sentry get usable detail.
        console.warn('[atlas] create racing area failed', error);
        throw new Error(error.message || 'Could not save racing area');
      }
      return data as CreatedRacingArea;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atlas-racing-areas'] });
    },
  });
}
