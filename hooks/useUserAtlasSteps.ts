/**
 * useUserAtlasSteps — Phase A.2. Fetches the viewer's own timeline_steps
 * with location_lat/lng populated, scoped to a single interest slug, and
 * windowed to "interesting on the atlas right now":
 *   - planned within the next 14 days, OR
 *   - placed but unscheduled and touched within the last 14 days, OR
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
  | 'done-just-completed'
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

/**
 * Lightweight picker entry — every active or recently-done step the user
 * has for this interest, with or without a location. The picker strip
 * uses this to let the user find steps on the map (with place) or anchor
 * them to a place (without place).
 */
export interface PickerStep {
  step_id: string;
  title: string;
  status: UserStepStatus;
  /** True when the step has lat/lng (either column or metadata fallback). */
  has_place: boolean;
  lat: number | null;
  lng: number | null;
  location_name: string | null;
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
  created_at: string;
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
  // pending / in_progress — scheduled steps show if they are due soon.
  // Unscheduled placed steps still belong on Atlas briefly after edit,
  // otherwise adding a Where field from Plan never produces a map pin.
  if (!row.starts_at) {
    const touched = new Date(row.updated_at ?? row.created_at).getTime();
    if (touched >= now - 14 * day) return { status: 'planned-week', at_iso: row.updated_at ?? row.created_at };
    return null;
  }
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
        .select('id, title, status, starts_at, created_at, updated_at, location_lat, location_lng, location_name, metadata')
        .eq('user_id', userId)
        .eq('interest_id', interestRow.id)
        .limit(200);
      if (error) {
        console.warn('[atlas] useUserAtlasSteps query error', error);
        return [];
      }
      return rows ?? [];
    },
  });

  const steps = useMemo<UserAtlasStep[]>(() => {
    type Classified = UserAtlasStep & {
      raw_status: string;
      starts_at: string | null;
      created_at: string;
      updated_at: string;
    };
    const classified: Classified[] = [];
    for (const row of data) {
      const plan = (row.metadata as { plan?: { where_location?: unknown } } | null)?.plan;
      const whereLocation = plan?.where_location as
        | { lat?: unknown; lng?: unknown; name?: unknown }
        | undefined;
      const fallbackLat =
        typeof whereLocation?.lat === 'number' ? whereLocation.lat : null;
      const fallbackLng =
        typeof whereLocation?.lng === 'number' ? whereLocation.lng : null;
      const lat = row.location_lat ?? fallbackLat;
      const lng = row.location_lng ?? fallbackLng;
      if (lat == null || lng == null) continue;
      const cls = classify({
        status: row.status,
        starts_at: row.starts_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
      if (!cls) continue;
      classified.push({
        step_id: row.id,
        lat,
        lng,
        title: row.title,
        location_name:
          row.location_name ??
          (typeof whereLocation?.name === 'string' ? whereLocation.name : null),
        status: cls.status,
        at_iso: cls.at_iso,
        day_badge:
          cls.status === 'planned-week' || cls.status === 'planned-next'
            ? dayBadge(cls.at_iso)
            : null,
        raw_status: row.status,
        starts_at: row.starts_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    }
    // Promote one planned step to `planned-next` — the step to the
    // right of the timeline's NOW bar. Picker mirrors the timeline:
    // any in_progress step wins, else earliest starts_at, else
    // earliest created_at among non-completed.
    const activeIdxs = classified
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.raw_status !== 'completed' && s.raw_status !== 'reflected');
    const nextIdx = activeIdxs.sort((a, b) => {
      const aInProg = a.s.raw_status === 'in_progress' ? 0 : 1;
      const bInProg = b.s.raw_status === 'in_progress' ? 0 : 1;
      if (aInProg !== bInProg) return aInProg - bInProg;
      const aSched = a.s.starts_at ? new Date(a.s.starts_at).getTime() : Infinity;
      const bSched = b.s.starts_at ? new Date(b.s.starts_at).getTime() : Infinity;
      if (aSched !== bSched) return aSched - bSched;
      return new Date(a.s.created_at).getTime() - new Date(b.s.created_at).getTime();
    })[0]?.i;
    if (nextIdx != null) {
      classified[nextIdx].status = 'planned-next';
    }
    // Promote the single most-recently-completed step to
    // `done-just-completed` — the step to the left of NOW.
    const justDoneIdx = classified
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.raw_status === 'completed' || s.raw_status === 'reflected')
      .sort((a, b) => new Date(b.s.updated_at).getTime() - new Date(a.s.updated_at).getTime())[0]?.i;
    if (justDoneIdx != null) {
      classified[justDoneIdx].status = 'done-just-completed';
    }
    // Strip internal fields before returning.
    return classified.map(({ raw_status: _r, starts_at: _s, created_at: _c, updated_at: _u, ...rest }) => rest);
  }, [data]);

  // Picker dataset — every active or recent-done step regardless of
  // whether it has a location yet. Ordered: in_progress first, then
  // active steps by created_at ASC (oldest queued first — the ones the
  // user is most likely to be working on), then recent-done by
  // updated_at DESC.
  const pickerSteps = useMemo<PickerStep[]>(() => {
    const stepMap = new Map(steps.map((s) => [s.step_id, s]));
    type Row = {
      step_id: string;
      title: string;
      status: UserStepStatus;
      raw_status: string;
      lat: number | null;
      lng: number | null;
      location_name: string | null;
      starts_at: string | null;
      created_at: string;
      updated_at: string;
    };
    const rows: Row[] = [];
    for (const row of data) {
      const cls = classify({
        status: row.status,
        starts_at: row.starts_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
      if (!cls) continue;
      const plan = (row.metadata as { plan?: { where_location?: unknown } } | null)?.plan;
      const whereLocation = plan?.where_location as
        | { lat?: unknown; lng?: unknown; name?: unknown }
        | undefined;
      const fallbackLat =
        typeof whereLocation?.lat === 'number' ? whereLocation.lat : null;
      const fallbackLng =
        typeof whereLocation?.lng === 'number' ? whereLocation.lng : null;
      const lat = row.location_lat ?? fallbackLat;
      const lng = row.location_lng ?? fallbackLng;
      const placed = stepMap.get(row.id);
      rows.push({
        step_id: row.id,
        title: row.title,
        // If this step also made it into the placed-steps array, the
        // status may have been promoted (planned-next/done-just-completed).
        status: placed?.status ?? cls.status,
        raw_status: row.status,
        lat,
        lng,
        location_name:
          row.location_name ??
          (typeof whereLocation?.name === 'string' ? whereLocation.name : null),
        starts_at: row.starts_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    }
    rows.sort((a, b) => {
      const aDone = a.raw_status === 'completed' || a.raw_status === 'reflected';
      const bDone = b.raw_status === 'completed' || b.raw_status === 'reflected';
      if (aDone !== bDone) return aDone ? 1 : -1;
      if (!aDone) {
        const aInProg = a.raw_status === 'in_progress' ? 0 : 1;
        const bInProg = b.raw_status === 'in_progress' ? 0 : 1;
        if (aInProg !== bInProg) return aInProg - bInProg;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
    return rows.map((r) => ({
      step_id: r.step_id,
      title: r.title,
      status: r.status,
      has_place: r.lat != null && r.lng != null,
      lat: r.lat,
      lng: r.lng,
      location_name: r.location_name,
    }));
  }, [data, steps]);

  return { steps, pickerSteps, loading: isLoading };
}
