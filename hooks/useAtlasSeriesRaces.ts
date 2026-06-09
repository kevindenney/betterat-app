/**
 * useAtlasSeriesRaces — list the race steps that make up one on-map series,
 * scoped to the signed-in user's (season_id, course_id) pair. Powers the
 * sheet that opens when the Atlas "N races · {Series}" caption is tapped.
 *
 * Mirrors attachSeriesInfo's sourcing in useAtlasNextEvent: scope the query
 * by season (cheap — a season holds a handful of races) and match course_id
 * on race_plan client-side, since a nested-jsonb PostgREST filter is brittle.
 */

import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';

export interface AtlasSeriesRace {
  id: string;
  title: string;
  startsAt: string | null;
}

const SERIES_RACES_KEY = 'atlas-series-races';

type SeriesRaceRow = {
  id: string;
  title: string | null;
  starts_at: string | null;
  metadata: Record<string, unknown> | null;
};

export function useAtlasSeriesRaces(
  seasonId: string | null | undefined,
  courseId: string | null | undefined,
): AtlasSeriesRace[] {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: [SERIES_RACES_KEY, user?.id, seasonId, courseId],
    enabled: Boolean(user?.id && seasonId && courseId),
    queryFn: async (): Promise<AtlasSeriesRace[]> => {
      const { data, error } = await supabase
        .from('timeline_steps')
        .select('id, title, starts_at, metadata')
        .eq('user_id', user!.id)
        .eq('is_race', true)
        .eq('season_id', seasonId!)
        .order('starts_at', { ascending: true });
      if (error || !data) return [];
      return (data as SeriesRaceRow[])
        .filter((row) => {
          const meta = row.metadata;
          const plan =
            meta && typeof meta === 'object'
              ? (meta as { race_plan?: { course_id?: unknown } }).race_plan
              : null;
          return plan?.course_id === courseId;
        })
        .map((row) => ({
          id: row.id,
          title: row.title?.trim() || 'Race',
          startsAt: row.starts_at,
        }));
    },
    staleTime: 60_000,
  });

  return query.data ?? [];
}
