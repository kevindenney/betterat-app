/**
 * useVenueRecord — the viewer's all-time record at one racing area: how
 * many races they've completed there and their most recent review note.
 * Powers the "Record here" row of the Atlas venue-mastery sheet (V.2).
 *
 * Mirrors useAtlasSeriesRaces' sourcing: fetch the user's completed race
 * steps and match race_plan.area_id client-side — a nested-jsonb PostgREST
 * filter is brittle, and one user's lifetime race count is small.
 */

import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';

export interface VenueRecord {
  /** Completed races at this area, all time. */
  raceCount: number;
  /** Most recent review note captured at this area, if any. */
  lastNote: {
    body: string;
    stepTitle: string;
    startsAt: string | null;
  } | null;
}

export const VENUE_RECORD_KEY = 'venue-record';

type VenueRecordRow = {
  id: string;
  title: string | null;
  starts_at: string | null;
  metadata: Record<string, unknown> | null;
};

function readAreaId(metadata: Record<string, unknown> | null): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const plan = (metadata as { race_plan?: { area_id?: unknown } }).race_plan;
  return plan && typeof plan.area_id === 'string' ? plan.area_id : null;
}

function readLatestReviewBody(metadata: Record<string, unknown> | null): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const review = (metadata as { review?: { sections?: unknown } }).review;
  const sections = Array.isArray(review?.sections) ? review.sections : [];
  for (let i = sections.length - 1; i >= 0; i--) {
    const body = (sections[i] as { body?: unknown })?.body;
    if (typeof body === 'string' && body.trim().length > 0) return body.trim();
  }
  return null;
}

export function useVenueRecord(areaPoiId: string | null | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [VENUE_RECORD_KEY, user?.id, areaPoiId],
    enabled: Boolean(user?.id && areaPoiId),
    staleTime: 60_000,
    queryFn: async (): Promise<VenueRecord> => {
      const { data, error } = await supabase
        .from('timeline_steps')
        .select('id, title, starts_at, metadata')
        .eq('user_id', user!.id)
        .eq('is_race', true)
        .eq('status', 'completed')
        .order('starts_at', { ascending: false });
      if (error || !data) return { raceCount: 0, lastNote: null };

      const atArea = (data as VenueRecordRow[]).filter(
        (row) => readAreaId(row.metadata) === areaPoiId,
      );
      let lastNote: VenueRecord['lastNote'] = null;
      for (const row of atArea) {
        const body = readLatestReviewBody(row.metadata);
        if (body) {
          lastNote = {
            body,
            stepTitle: row.title?.trim() || 'Race',
            startsAt: row.starts_at,
          };
          break;
        }
      }
      return { raceCount: atArea.length, lastNote };
    },
  });
}
