/**
 * useAtlasRaceCourses — source the venue race courses that the Atlas canvas
 * paints (start/finish lines, laylines, start box, marks) as a single
 * MapLibre-ready FeatureCollection.
 *
 * Like useAtlasRacingAreas, this does a full SELECT of active rows rather
 * than a bbox query: the global course count is small, and course rows are
 * anchored by racing_area_id / venue_id (no centroid column to bbox on
 * yet). The canvas gates visibility by zoom + the sailing.course toggle, so
 * fetching everything and letting the camera decide what's on-screen is
 * fine until there's a real spatial RPC.
 *
 * Row parsing + GeoJSON derivation are the same pure helpers the
 * venue-scoped path uses (toCourse, venueCoursesToFeatureCollection), so a
 * malformed course_geometry blob drops that one course instead of crashing
 * the layer.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { FeatureCollection } from 'geojson';

import { supabase } from '@/services/supabase';
import { type RawCourse, toCourse } from '@/hooks/useVenueRaceCourses.utils';
import { type CourseEnvironment, venueCoursesToFeatureCollection } from '@/lib/venueCourseGeoJSON';
import type { VenueRaceCourse } from '@/types/courses';

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

interface UseAtlasRaceCoursesArgs {
  enabled?: boolean;
  /**
   * Live conditions. `windDirection` re-orients each saved course to the
   * current breeze; `currentDirection`/`currentSpeed` drive favored-side
   * shading.
   */
  env?: CourseEnvironment;
}

export function useAtlasRaceCourses({ enabled = true, env = {} }: UseAtlasRaceCoursesArgs = {}) {
  const query = useQuery({
    queryKey: ['atlas-race-courses'],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<RawCourse[]> => {
      const { data, error } = await supabase
        .from('venue_race_courses')
        .select(
          'id, racing_area_id, venue_id, name, course_type, course_geometry, classes_used, is_active, created_by, created_at, updated_at',
        )
        .eq('is_active', true);
      if (error) {
        console.warn('[atlas] venue_race_courses fetch error', error);
        return [];
      }
      return (data ?? []) as RawCourse[];
    },
  });

  const courses = useMemo<VenueRaceCourse[]>(() => {
    const rows = query.data ?? [];
    return rows.map(toCourse).filter((c): c is VenueRaceCourse => c !== null);
  }, [query.data]);

  const featureCollection = useMemo<FeatureCollection>(() => {
    if (courses.length === 0) return EMPTY;
    return venueCoursesToFeatureCollection(courses, env);
  }, [courses, env]);

  return {
    featureCollection,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
