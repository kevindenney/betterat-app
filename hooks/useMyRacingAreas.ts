/**
 * useMyRacingAreas — the racing areas a user can pick when flagging a step
 * a race. Unions two sources so the picker matches what the Atlas tab shows:
 *
 *   1. Areas the user created on Atlas (created_by = me) — surfaced
 *      regardless of venue, since a hand-drawn area may have no venue_id.
 *   2. The step venue's mapped areas (venue_id = venueId) — the official /
 *      community areas already pinned for that water.
 *
 * Only active rows. User-created areas are always active; venue seeds can be
 * inactive (see project_venue_racing_areas_inactive_seed), so the venue side
 * may legitimately come back empty even when pins render on the map.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';
import type { RacingAreaGeometry } from '@/hooks/useVenueRacingAreas';

export interface MyRacingArea {
  id: string;
  areaName: string;
  geometry?: RacingAreaGeometry;
  centerLat: number | null;
  centerLng: number | null;
  typicalCourses?: string[];
  /** True when the current user authored this area on Atlas. */
  ownedByMe: boolean;
}

interface RawRow {
  id: string;
  area_name: string;
  geometry: RacingAreaGeometry | null;
  center_lat: number | null;
  center_lng: number | null;
  typical_courses: string[] | null;
  created_by: string | null;
}

const SELECT = 'id, area_name, geometry, center_lat, center_lng, typical_courses, created_by';

export function useMyRacingAreas(venueId?: string | null) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: ['my-racing-areas', userId, venueId ?? null],
    enabled: Boolean(userId) || Boolean(venueId),
    staleTime: 60_000,
    queryFn: async (): Promise<MyRacingArea[]> => {
      // Two narrow reads beat a single `.or()` here: the user-owned read is
      // not venue-scoped, and venue seeds carry an is_active gate that the
      // owned read must not inherit.
      const reqs: Promise<RawRow[]>[] = [];

      if (userId) {
        reqs.push(
          Promise.resolve(supabase
            .from('venue_racing_areas')
            .select(SELECT)
            .eq('created_by', userId)
            .then(({ data, error }) => {
              if (error) {
                console.warn('[my-racing-areas] owned fetch error', error);
                return [];
              }
              return (data ?? []) as RawRow[];
            })),
        );
      }

      if (venueId) {
        reqs.push(
          Promise.resolve(supabase
            .from('venue_racing_areas')
            .select(SELECT)
            .eq('venue_id', venueId)
            .eq('is_active', true)
            .then(({ data, error }) => {
              if (error) {
                console.warn('[my-racing-areas] venue fetch error', error);
                return [];
              }
              return (data ?? []) as RawRow[];
            })),
        );
      }

      const groups = await Promise.all(reqs);
      const byId = new Map<string, MyRacingArea>();
      for (const rows of groups) {
        for (const row of rows) {
          const existing = byId.get(row.id);
          const ownedByMe = row.created_by != null && row.created_by === userId;
          if (existing) {
            existing.ownedByMe = existing.ownedByMe || ownedByMe;
            continue;
          }
          byId.set(row.id, {
            id: row.id,
            areaName: row.area_name,
            geometry: row.geometry ?? undefined,
            centerLat: row.center_lat,
            centerLng: row.center_lng,
            typicalCourses: row.typical_courses ?? undefined,
            ownedByMe,
          });
        }
      }

      // My own areas first, then alphabetical within each group.
      return Array.from(byId.values()).sort((a, b) => {
        if (a.ownedByMe !== b.ownedByMe) return a.ownedByMe ? -1 : 1;
        return a.areaName.localeCompare(b.areaName);
      });
    },
  });

  return {
    racingAreas: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export default useMyRacingAreas;
