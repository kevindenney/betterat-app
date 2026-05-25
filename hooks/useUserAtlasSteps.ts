/**
 * useUserAtlasSteps — Phase A.2. Fetches the viewer's own timeline_steps
 * with location_lat/lng populated, scoped to a single interest slug, and
 * windowed to "interesting on the atlas right now":
 *   - planned within the next 14 days, OR
 *   - completed within the last 30 days
 *
 * Each row is classified into a status the canvas uses to pick a marker
 * variant (planned-week / done-recent / done-old / planned-next). Tap
 * routes back to the live tab via onPinPress so the user opens the step
 * detail instead of duplicating it via "Plan a step here".
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';

export type UserStepStatus =
  | 'planned-week'
  | 'planned-next'
  | 'done-recent'
  | 'done-old';

export interface UserAtlasStep {
  step_id: string;
  lat: number;
  lng: number;
  title: string;
  location_name: string | null;
  status: UserStepStatus;
  /** ISO timestamp the row carries — either starts_at (planned) or updated_at (done). */
  at_iso: string;
  /** 3-letter day-of-week badge for planned steps (e.g. "MON"). null for done. */
  day_badge: string | null;
}

interface UseUserAtlasStepsArgs {
  /** Interest slug ('sail-racing', 'nursing', 'lac-craft-business'). */
  interestSlug: string | null;
  /** Skip the query when false. */
  enabled?: boolean;
}

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function classify(row: {
  status: string;
  starts_at: string | null;
  updated_at: string;
}): { status: UserStepStatus; at_iso: string } | null {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  if (row.status === 'completed') {
    const at = new Date(row.updated_at).getTime();
    if (at >= now - 7 * day) return { status: 'done-recent', at_iso: row.updated_at };
    if (at >= now - 30 * day) return { status: 'done-old', at_iso: row.updated_at };
    return null;
  }
  // pending / in_progress — must have a starts_at to be place-able on the atlas
  if (!row.starts_at) return null;
  const starts = new Date(row.starts_at).getTime();
  if (starts < now - 1 * day) return null; // missed; drop
  if (starts <= now + 14 * day) return { status: 'planned-week', at_iso: row.starts_at };
  return null;
}

function dayBadge(iso: string): string {
  const d = new Date(iso);
  return DAY_LABELS[d.getDay()] ?? '';
}

export function useUserAtlasSteps({ interestSlug, enabled = true }: UseUserAtlasStepsArgs) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const { data = [], isLoading } = useQuery({
    queryKey: ['user-atlas-steps', userId, interestSlug],
    enabled: enabled && !!userId && !!interestSlug,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: interestRow, error: interestErr } = await supabase
        .from('interests')
        .select('id')
        .eq('slug', interestSlug)
        .maybeSingle();
      if (interestErr || !interestRow) return [];
      const { data: rows, error } = await supabase
        .from('timeline_steps')
        .select('id, title, status, starts_at, updated_at, location_lat, location_lng, location_name')
        .eq('user_id', userId)
        .eq('interest_id', interestRow.id)
        .not('location_lat', 'is', null)
        .not('location_lng', 'is', null)
        .limit(200);
      if (error) {
        console.warn('[atlas] useUserAtlasSteps query error', error);
        return [];
      }
      return rows ?? [];
    },
  });

  const steps = useMemo<UserAtlasStep[]>(() => {
    const classified: Omit<UserAtlasStep, 'status'> & { status: UserStepStatus }[] = [];
    for (const row of data) {
      if (row.location_lat == null || row.location_lng == null) continue;
      const cls = classify({
        status: row.status,
        starts_at: row.starts_at,
        updated_at: row.updated_at,
      });
      if (!cls) continue;
      classified.push({
        step_id: row.id,
        lat: row.location_lat,
        lng: row.location_lng,
        title: row.title,
        location_name: row.location_name,
        status: cls.status,
        at_iso: cls.at_iso,
        day_badge:
          cls.status === 'planned-week' || cls.status === 'planned-next'
            ? dayBadge(cls.at_iso)
            : null,
      });
    }
    // Promote the soonest planned-week step to planned-next so the
    // canvas knows which one to anchor the amber NEXT pill to.
    const plannedSoonestIdx = classified
      .map((s, i) => ({ i, t: new Date(s.at_iso).getTime(), st: s.status }))
      .filter((x) => x.st === 'planned-week')
      .sort((a, b) => a.t - b.t)[0]?.i;
    if (plannedSoonestIdx != null) {
      classified[plannedSoonestIdx].status = 'planned-next';
    }
    return classified;
  }, [data]);

  return { steps, loading: isLoading };
}
