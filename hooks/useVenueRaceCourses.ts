/**
 * useVenueRaceCourses — fetch the reusable race courses authored for a
 * racing area and/or venue from venue_race_courses, parsed into typed
 * VenueRaceCourse rows.
 *
 * Each row stores only CourseGeometryParams (committee/pin endpoints,
 * wind axis, leg length, tack angle, boat length, start-box depth) in
 * course_geometry JSONB. The full tactical overlay is derived later at
 * render time by lib/courseGeometry — this hook just sources and
 * validates the params. Malformed rows (missing endpoints or scalars)
 * are dropped rather than crashing the Atlas canvas.
 *
 * Pass at least one of racingAreaId / venueId; with neither, the query
 * is disabled and the hook returns an empty list.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/services/supabase';
import type { VenueRaceCourse } from '@/types/courses';
import { type RawCourse, toCourse } from '@/hooks/useVenueRaceCourses.utils';

interface UseVenueRaceCoursesArgs {
  racingAreaId?: string | null;
  venueId?: string | null;
  enabled?: boolean;
}

export function useVenueRaceCourses({
  racingAreaId,
  venueId,
  enabled = true,
}: UseVenueRaceCoursesArgs) {
  const queryEnabled = enabled && Boolean(racingAreaId || venueId);

  const query = useQuery({
    queryKey: ['venue-race-courses', racingAreaId ?? null, venueId ?? null],
    enabled: queryEnabled,
    staleTime: 60_000,
    queryFn: async (): Promise<RawCourse[]> => {
      let q = supabase
        .from('venue_race_courses')
        .select(
          'id, racing_area_id, venue_id, name, course_type, course_geometry, classes_used, is_active, created_by, created_at, updated_at',
        )
        .eq('is_active', true);

      // Match either anchor. `.or()` builds a single OR group; when only
      // one id is present we filter on just that column.
      if (racingAreaId && venueId) {
        q = q.or(`racing_area_id.eq.${racingAreaId},venue_id.eq.${venueId}`);
      } else if (racingAreaId) {
        q = q.eq('racing_area_id', racingAreaId);
      } else if (venueId) {
        q = q.eq('venue_id', venueId);
      }

      const { data, error } = await q;
      if (error) {
        console.warn('[atlas] venue_race_courses fetch error', error);
        return [];
      }
      return (data ?? []) as RawCourse[];
    },
  });

  const courses = useMemo<VenueRaceCourse[]>(() => {
    const rows = query.data ?? [];
    return rows
      .map(toCourse)
      .filter((c): c is VenueRaceCourse => c !== null);
  }, [query.data]);

  return {
    courses,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
