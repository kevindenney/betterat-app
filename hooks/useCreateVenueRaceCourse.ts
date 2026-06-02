/**
 * useCreateVenueRaceCourse — INSERTs an authored race course into
 * venue_race_courses. The stored geometry is CourseGeometryParams
 * (committee/pin endpoints + wind axis + scalars) as a JSONB blob in
 * course_geometry; everything downstream (marks, laylines, start box)
 * is derived from it at render time.
 *
 * A course is anchored to a racing_area_id and/or venue_id. Returns the
 * inserted row so the caller can route into a detail view or recenter.
 *
 * Invalidates BOTH read keys on success:
 *   - ['venue-race-courses', …]  (venue-scoped useVenueRaceCourses)
 *   - ['atlas-race-courses']     (the Atlas canvas overlay)
 * Skipping either leaves a freshly-saved course invisible on that surface.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';
import type { CourseGeometryParams, CourseType } from '@/types/courses';

export interface CreateVenueRaceCourseInput {
  /** Display name, e.g. "Victoria Harbour — W/L". */
  name: string;
  /** Anchor to a racing area (at least one of racingAreaId/venueId required). */
  racingAreaId?: string | null;
  venueId?: string | null;
  courseType?: CourseType;
  /** Derived course geometry — see buildCourseParams. */
  geometry: CourseGeometryParams;
  /** Free-text boat-class tags, e.g. ["Dragon"]. */
  classesUsed?: string[];
}

export interface CreatedVenueRaceCourse {
  id: string;
  racing_area_id: string | null;
  venue_id: string | null;
  name: string;
  course_type: string;
  classes_used: string[];
  is_active: boolean;
  created_by: string;
}

export function useCreateVenueRaceCourse() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: CreateVenueRaceCourseInput,
    ): Promise<CreatedVenueRaceCourse> => {
      if (!user?.id) {
        throw new Error('Must be signed in to create a race course');
      }
      const trimmedName = input.name.trim();
      if (!trimmedName) {
        throw new Error('Race course needs a name');
      }
      if (!input.racingAreaId && !input.venueId) {
        throw new Error('Race course needs a racing area or venue');
      }
      const classesUsed = (input.classesUsed ?? [])
        .map((c) => c.trim())
        .filter(Boolean);
      const { data, error } = await supabase
        .from('venue_race_courses')
        .insert({
          name: trimmedName,
          racing_area_id: input.racingAreaId ?? null,
          venue_id: input.venueId ?? null,
          course_type: input.courseType ?? input.geometry.courseType,
          course_geometry: input.geometry,
          classes_used: classesUsed,
          is_active: true,
          created_by: user.id,
        })
        .select(
          'id, racing_area_id, venue_id, name, course_type, classes_used, is_active, created_by',
        )
        .single();
      if (error) {
        // PostgrestError isn't an Error instance — surface message for callers/Sentry.
        console.warn('[atlas] create race course failed', error);
        throw new Error(error.message || 'Could not save race course');
      }
      return data as CreatedVenueRaceCourse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-race-courses'] });
      queryClient.invalidateQueries({ queryKey: ['atlas-race-courses'] });
    },
  });
}
