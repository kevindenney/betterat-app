/**
 * useCreateRacingArea — INSERTs a user-defined racing area into
 * atlas_pois (kind='racing_area'). The RLS policy requires
 * source='user_proposed' AND created_by=auth.uid().
 *
 * Returns the inserted row so callers can route into a detail sheet
 * or zoom the map to the new area. Invalidates the read-side
 * racing-area queries on success.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Polygon } from 'geojson';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';

import { invalidateRacingAreaQueries } from './racingAreaInvalidations';

export interface CreateRacingAreaInput {
  /** Display name, e.g. "Middle Island". */
  name: string;
  centerLat: number;
  centerLng: number;
  /**
   * Radius of the circular area in meters. Used as a fallback when no
   * polygon is provided, and also stored on every row so consumers that
   * read the simplified point+radius metadata keep working.
   */
  radiusMeters?: number;
  /**
   * Explicit Polygon geometry. When provided this becomes the canonical
   * shape (rectangle, hand-drawn polygon, etc.) and `radiusMeters` is
   * used only for the fallback metadata field.
   */
  polygon?: Polygon;
  /**
   * Boat classes that race here (free-text tags so users can write
   * their own class names — e.g. "Dragon", "J/80", "Etchells").
   */
  classesUsed?: string[];
  /** Optional human-language note shown in the area detail sheet. */
  description?: string;
  /**
   * Links the area to a venue (stored as metadata.venue_id) so
   * venue-scoped reads like useVenueRacingAreas pick it up.
   */
  venueId?: string;
}

export interface CreatedRacingArea {
  id: string;
  area_name: string;
  center_lat: number;
  center_lng: number;
  radius_meters: number;
  source: 'user_proposed';
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
      // Polygon geometry wins when provided (rectangles, hand-drawn).
      // Otherwise fall back to a Point so simplified center+radius
      // consumers still get a usable centroid.
      const geometry = input.polygon
        ? input.polygon
        : {
            type: 'Point',
            coordinates: [input.centerLng, input.centerLat],
          };
      const metadata: Record<string, unknown> = {
        area_type: 'racing_area',
        radius_meters: radiusMeters,
        classes_used: classesUsed,
      };
      const description = input.description?.trim();
      if (description) metadata.description = description;
      if (input.venueId) metadata.venue_id = input.venueId;
      const { data, error } = await supabase
        .from('atlas_pois')
        .insert({
          name: trimmedName,
          kind: 'racing_area',
          interest_slug: 'sail-racing',
          source: 'user_proposed',
          created_by: user.id,
          lat: input.centerLat,
          lng: input.centerLng,
          verification_status: 'pending',
          geometry,
          metadata,
        })
        .select('id, name, lat, lng, source, verification_status, created_by, metadata')
        .single();
      if (error) {
        // PostgrestError isn't an Error instance — surface code+message
        // so callers and Sentry get usable detail.
        console.warn(
          `[atlas] create racing area failed: code=${error.code} message=${error.message} details=${error.details} hint=${error.hint}`,
        );
        throw new Error(error.message || 'Could not save racing area');
      }
      const row = data as {
        id: string;
        name: string;
        lat: number;
        lng: number;
        created_by: string;
        metadata: { radius_meters?: number; classes_used?: string[] } | null;
      };
      return {
        id: row.id,
        area_name: row.name,
        center_lat: row.lat,
        center_lng: row.lng,
        radius_meters: row.metadata?.radius_meters ?? radiusMeters,
        source: 'user_proposed',
        verification_status: 'pending',
        classes_used: row.metadata?.classes_used ?? classesUsed,
        created_by: row.created_by,
      };
    },
    onSuccess: () => {
      invalidateRacingAreaQueries(queryClient);
    },
  });
}
