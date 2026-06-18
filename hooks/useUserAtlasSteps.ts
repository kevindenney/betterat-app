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

import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useCurrentSeason } from '@/hooks/useSeason';

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
  /** Freeform activity category — fed to stepKindFor() for the Atlas kind lens. */
  category: string | null;
  /** Phase N.4 — explicit race flag; drives the ⛵ race pin + race cockpit. */
  is_race: boolean;
  /**
   * Display-only race course context, lifted from metadata.race_plan /
   * metadata.atlas.race_course_context. Lets the Atlas race-pin callout show
   * "Victoria Harbour · Windward–Leeward · 3 laps" without a second fetch.
   * null on non-race steps (or races saved before the picker existed).
   */
  raceContext: { areaName: string | null; courseLabel: string | null } | null;
  location_name: string | null;
  status: UserStepStatus;
  /** ISO timestamp the row carries — either starts_at (planned) or updated_at (done). */
  at_iso: string;
  /** Explicit scheduled start, used by race pins for race-time forecasts. */
  starts_at: string | null;
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
  /** atlas_pois id this step is anchored at, when its where_location names one. */
  poi_id: string | null;
}

/**
 * Archive entry — a step OUTSIDE the near-now window (classify() rejected
 * it: completed >30d ago, scheduled >14d out, or stale unscheduled). The
 * Saved sheet groups these by arc (season) so older work stays one tap away
 * without crowding the near-now picker. Carries the fields arc resolution
 * needs (explicit metadata season pin → date containment → season column).
 */
export interface ArchivePickerStep extends PickerStep {
  starts_at: string | null;
  created_at: string;
  /** seasons.id from the timeline_steps.season_id column, if set. */
  season_id: string | null;
  /** Explicit arc pin from metadata.season_id (timeline move-to-arc). */
  meta_season_id: string | null;
  /** Timeline display order within the arc (timeline_steps.sort_order). */
  sort_order: number;
}

interface RaceAreaCenter {
  id: string;
  name: string;
  center: { lat: number; lng: number };
}

interface UseUserAtlasStepsArgs {
  /** Interest slug ('sail-racing', 'nursing', 'lac-craft-business'). */
  interestSlug: string | null;
  /** Skip the query when false. */
  enabled?: boolean;
  /**
   * Map scope. Default: current-arc steps only (the working set). With the
   * History chip on, other-arc / long-done located steps surface too.
   */
  includeHistory?: boolean;
}

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// 'settled' and 'reflected' are both post-completion states; treating them
// as active made backfilled old steps render as planned pins.
function isDoneStatus(status: string): boolean {
  return status === 'completed' || status === 'settled' || status === 'reflected';
}

function classify(row: {
  status: string;
  starts_at: string | null;
  created_at: string;
  updated_at: string;
}): { status: UserStepStatus; at_iso: string } | null {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  if (isDoneStatus(row.status)) {
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
  if (starts < now - 1 * day) {
    // Past-dated but still active — it's still the user's plan (often a
    // backdated starts_at), so keep the pin while the step is recently
    // touched. Hard-dropping these left the step visible in the picker but
    // absent from the map, which read as a bug.
    const touched = new Date(row.updated_at ?? row.created_at).getTime();
    if (touched >= now - 14 * day) return { status: 'planned-week', at_iso: row.updated_at ?? row.created_at };
    return null;
  }
  if (starts <= now + 14 * day) return { status: 'planned-week', at_iso: row.starts_at };
  return null;
}

function dayBadge(iso: string): string {
  const d = new Date(iso);
  return DAY_LABELS[d.getDay()] ?? '';
}

function normalizeAreaName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function geometryCenter(geom: unknown): { lat: number; lng: number } | null {
  if (!geom || typeof geom !== 'object') return null;
  const g = geom as { type?: string; coordinates?: unknown };
  if (!g.coordinates) return null;
  const collect = (coords: unknown): number[][] => {
    if (!Array.isArray(coords)) return [];
    if (typeof coords[0] === 'number') return [coords as number[]];
    return coords.flatMap(collect);
  };
  const points =
    g.type === 'Polygon' && Array.isArray(g.coordinates)
      ? ((g.coordinates as number[][][])[0] ?? [])
      : collect(g.coordinates);
  const valid = points.filter(
    (p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]),
  );
  if (valid.length === 0) return null;
  const sum = valid.reduce(
    (acc, [lng, lat]) => ({ lng: acc.lng + lng, lat: acc.lat + lat }),
    { lng: 0, lat: 0 },
  );
  return { lat: sum.lat / valid.length, lng: sum.lng / valid.length };
}

/**
 * Lift the race course chips off a step's metadata. Prefers the pre-formatted
 * atlas.race_course_context (scrub_title / scrub_label, written by the
 * composer), falling back to raw race_plan so races saved before that block
 * existed still get an area + course label.
 */
function extractRaceContext(
  metadata: Record<string, unknown> | null,
): { areaName: string | null; courseLabel: string | null } | null {
  if (!metadata) return null;
  const plan = metadata.race_plan as
    | { area_name?: unknown; course_label?: unknown; laps?: unknown }
    | undefined;
  const ctx = (metadata.atlas as { race_course_context?: unknown } | undefined)
    ?.race_course_context as { scrub_title?: unknown; scrub_label?: unknown } | undefined;

  const str = (v: unknown): string | null =>
    typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;

  const areaName = str(ctx?.scrub_title) ?? str(plan?.area_name);
  let courseLabel = str(ctx?.scrub_label);
  if (!courseLabel) {
    const base = str(plan?.course_label);
    const laps = typeof plan?.laps === 'number' && plan.laps > 0 ? plan.laps : null;
    courseLabel = base ? `${base}${laps ? ` · ${laps} laps` : ''}` : null;
  }
  if (!areaName && !courseLabel) return null;
  return { areaName, courseLabel };
}

function extractRacePlanCenter(
  metadata: Record<string, unknown> | null,
  areaCenters: RaceAreaCenter[],
): { lat: number; lng: number } | null {
  if (!metadata) return null;
  const plan = metadata.race_plan as
    | { center?: unknown; area_id?: unknown; area_name?: unknown }
    | undefined;
  const center = plan?.center as { lat?: unknown; lng?: unknown } | undefined;
  if (
    typeof center?.lat === 'number' &&
    Number.isFinite(center.lat) &&
    typeof center.lng === 'number' &&
    Number.isFinite(center.lng)
  ) {
    return { lat: center.lat, lng: center.lng };
  }
  const areaId = typeof plan?.area_id === 'string' ? plan.area_id : null;
  if (areaId) {
    const match = areaCenters.find((area) => area.id === areaId);
    if (match) return match.center;
  }
  const areaName = typeof plan?.area_name === 'string' ? normalizeAreaName(plan.area_name) : null;
  if (areaName) {
    const match = areaCenters.find((area) => normalizeAreaName(area.name) === areaName);
    if (match) return match.center;
  }
  return null;
}

export function useUserAtlasSteps({
  interestSlug,
  enabled = true,
  includeHistory = false,
}: UseUserAtlasStepsArgs) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  // NEXT lives in the current arc: old arcs can hold abandoned planned
  // steps with low sort_order that would otherwise steal the promotion.
  const { data: currentSeason } = useCurrentSeason();
  const currentArcId = currentSeason?.id ?? null;
  const currentArcStart = currentSeason?.start_date ? Date.parse(currentSeason.start_date) : NaN;
  const currentArcEnd = currentSeason?.end_date
    ? Date.parse(currentSeason.end_date) + 24 * 3600 * 1000
    : NaN;
  const inCurrentArc = useCallback(
    (
      metaSeasonId: string | null,
      seasonId: string | null,
      startsAt: string | null,
      createdAt: string,
    ): boolean => {
      if (!currentArcId) return false;
      if (metaSeasonId) return metaSeasonId === currentArcId;
      if (seasonId === currentArcId) return true;
      if (Number.isNaN(currentArcStart) || Number.isNaN(currentArcEnd)) return false;
      const t = Date.parse(startsAt ?? createdAt);
      return !Number.isNaN(t) && t >= currentArcStart && t < currentArcEnd;
    },
    [currentArcId, currentArcStart, currentArcEnd],
  );

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
        .select('id, title, category, is_race, status, starts_at, created_at, updated_at, sort_order, season_id, location_lat, location_lng, location_name, metadata')
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
  const { data: raceAreaCenters = [], isLoading: raceAreaCentersLoading } = useQuery({
    queryKey: ['user-atlas-race-area-centers'],
    enabled: enabled && !!interestSlug,
    staleTime: 60_000,
    queryFn: async (): Promise<RaceAreaCenter[]> => {
      const { data: rows, error } = await supabase
        .from('atlas_pois')
        .select('id, name, geometry, lat, lng')
        .eq('kind', 'racing_area')
        .eq('is_active', true);
      if (error) {
        console.warn('[atlas] race area center fetch error', error);
        return [];
      }
      return (rows ?? []).flatMap((row: any) => {
        const center =
          row.lat != null && row.lng != null
            ? { lat: Number(row.lat), lng: Number(row.lng) }
            : geometryCenter(row.geometry);
        if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) {
          return [];
        }
        return [
          {
            id: String(row.id),
            name: String(row.name ?? ''),
            center,
          },
        ];
      });
    },
  });

  // The single NEXT — first not-yet-done step in timeline display order
  // (sort_order asc, created_at asc), preferring the current arc so a
  // stale planned step in an old arc can't steal the badge. Computed over
  // ALL steps (not just near-now ones) so it always agrees with the
  // Practice timeline.
  const nextStepId = useMemo<string | null>(() => {
    const cands = data
      .filter((row) => !isDoneStatus(row.status))
      .map((row) => {
        const metadata = row.metadata as Record<string, unknown> | null;
        return {
          id: row.id as string,
          sort_order: (row as { sort_order?: number | null }).sort_order ?? 0,
          created_at: row.created_at as string,
          in_arc: inCurrentArc(
            typeof metadata?.season_id === 'string' ? (metadata.season_id as string) : null,
            (row as { season_id?: string | null }).season_id ?? null,
            row.starts_at,
            row.created_at,
          ),
        };
      });
    if (cands.length === 0) return null;
    const pool = cands.some((c) => c.in_arc) ? cands.filter((c) => c.in_arc) : cands;
    pool.sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    return pool[0].id;
  }, [data, inCurrentArc]);

  const steps = useMemo<UserAtlasStep[]>(() => {
    type Classified = UserAtlasStep & {
      raw_status: string;
      created_at: string;
      updated_at: string;
    };
    const classified: Classified[] = [];
    for (const row of data) {
      const metadata = row.metadata as Record<string, unknown> | null;
      const plan = (row.metadata as { plan?: { where_location?: unknown } } | null)?.plan;
      const whereLocation = plan?.where_location as
        | { lat?: unknown; lng?: unknown; name?: unknown }
        | undefined;
      const isRaceRow = (row as { is_race?: boolean | null }).is_race ?? false;
      const raceCenter = isRaceRow ? extractRacePlanCenter(metadata, raceAreaCenters) : null;
      const fallbackLat =
        typeof whereLocation?.lat === 'number' ? whereLocation.lat : null;
      const fallbackLng =
        typeof whereLocation?.lng === 'number' ? whereLocation.lng : null;
      // metadata.plan.where_location is the EDITABLE location (the Where
      // card writes it); location_lat/lng columns are a creation-time
      // snapshot that goes stale after a move. Metadata must win or moved
      // steps keep rendering at their old spot.
      const lat = raceCenter?.lat ?? fallbackLat ?? row.location_lat;
      const lng = raceCenter?.lng ?? fallbackLng ?? row.location_lng;
      if (lat == null || lng == null) continue;
      const raceContext = isRaceRow
        ? extractRaceContext(metadata)
        : null;
      let cls = classify({
        status: row.status,
        starts_at: row.starts_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
      // Arc scoping — the map's default working set is the CURRENT arc:
      // every located arc step shows regardless of classify's near-now
      // windows, and other-arc steps stay hidden until the History chip
      // opts them in. Skipped entirely while the season row is still
      // loading (arcKnown false) so the map doesn't blank out.
      const arcKnown = currentArcId != null;
      if (arcKnown) {
        const inArc = inCurrentArc(
          typeof metadata?.season_id === 'string' ? (metadata.season_id as string) : null,
          (row as { season_id?: string | null }).season_id ?? null,
          row.starts_at,
          row.created_at,
        );
        const fallbackCls = (): { status: UserStepStatus; at_iso: string } =>
          isDoneStatus(row.status)
            ? { status: 'done-old', at_iso: row.updated_at }
            : { status: 'planned-week', at_iso: row.starts_at ?? row.updated_at };
        if (inArc) {
          cls = cls ?? fallbackCls();
        } else if (row.id === nextStepId) {
          // NEXT backs the cockpit HUD — never hide it behind the arc gate.
          cls = cls ?? fallbackCls();
        } else if (!includeHistory) {
          continue;
        } else {
          cls = cls ?? fallbackCls();
        }
      }
      if (!cls) continue;
      classified.push({
        step_id: row.id,
        lat,
        lng,
        title: row.title,
        category: (row as { category?: string | null }).category ?? null,
        is_race: isRaceRow,
        raceContext,
        location_name:
          (raceCenter ? raceContext?.areaName : null) ??
          (typeof whereLocation?.name === 'string' ? whereLocation.name : null) ??
          row.location_name,
        status: cls.status,
        at_iso: cls.at_iso,
        starts_at: row.starts_at,
        day_badge:
          cls.status === 'planned-week' || cls.status === 'planned-next'
            ? dayBadge(cls.at_iso)
            : null,
        raw_status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    }
    // Mark the single NEXT pin (may be absent if it has no location).
    const nextIdx = nextStepId
      ? classified.findIndex((s) => s.step_id === nextStepId)
      : -1;
    if (nextIdx >= 0) {
      classified[nextIdx].status = 'planned-next';
    }
    // Promote the single most-recently-completed step to
    // `done-just-completed` — the step to the left of NOW.
    const justDoneIdx = classified
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => isDoneStatus(s.raw_status))
      .sort((a, b) => new Date(b.s.updated_at).getTime() - new Date(a.s.updated_at).getTime())[0]?.i;
    if (justDoneIdx != null) {
      classified[justDoneIdx].status = 'done-just-completed';
    }
    // Strip internal fields before returning.
    return classified.map(
      ({ raw_status: _r, created_at: _c, updated_at: _u, ...rest }) => rest,
    );
  }, [data, raceAreaCenters, nextStepId, currentArcId, inCurrentArc, includeHistory]);

  // Picker dataset — every active or recent-done step regardless of
  // whether it has a location yet. Active steps in timeline display
  // order (sort_order asc, created_at asc) so NEXT is the first row,
  // then recent-done by updated_at DESC.
  const pickerSteps = useMemo<ArchivePickerStep[]>(() => {
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
      sort_order: number;
      in_current_arc: boolean;
      season_id: string | null;
      meta_season_id: string | null;
      poi_id: string | null;
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
      const metadata = row.metadata as Record<string, unknown> | null;
      const plan = (row.metadata as { plan?: { where_location?: unknown } } | null)?.plan;
      const whereLocation = plan?.where_location as
        | { lat?: unknown; lng?: unknown; name?: unknown; poi_id?: unknown }
        | undefined;
      const isRaceRow = (row as { is_race?: boolean | null }).is_race ?? false;
      const raceCenter = isRaceRow ? extractRacePlanCenter(metadata, raceAreaCenters) : null;
      const fallbackLat =
        typeof whereLocation?.lat === 'number' ? whereLocation.lat : null;
      const fallbackLng =
        typeof whereLocation?.lng === 'number' ? whereLocation.lng : null;
      const lat = raceCenter?.lat ?? fallbackLat ?? row.location_lat;
      const lng = raceCenter?.lng ?? fallbackLng ?? row.location_lng;
      const placed = stepMap.get(row.id);
      rows.push({
        poi_id: typeof whereLocation?.poi_id === 'string' ? whereLocation.poi_id : null,
        step_id: row.id,
        title: row.title,
        // If this step also made it into the placed-steps array, the
        // status may have been promoted (planned-next/done-just-completed).
        status: row.id === nextStepId ? 'planned-next' : (placed?.status ?? cls.status),
        raw_status: row.status,
        lat,
        lng,
        location_name:
          (raceCenter ? placed?.raceContext?.areaName : null) ??
          (typeof whereLocation?.name === 'string' ? whereLocation.name : null) ??
          row.location_name,
        starts_at: row.starts_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        sort_order: (row as { sort_order?: number | null }).sort_order ?? 0,
        in_current_arc: inCurrentArc(
          typeof metadata?.season_id === 'string' ? (metadata.season_id as string) : null,
          (row as { season_id?: string | null }).season_id ?? null,
          row.starts_at,
          row.created_at,
        ),
        season_id: (row as { season_id?: string | null }).season_id ?? null,
        meta_season_id:
          typeof metadata?.season_id === 'string' ? (metadata.season_id as string) : null,
      });
    }
    // The picker strip (and its "N of M" pill) is the CURRENT-ARC working
    // set — with hundreds of lifetime steps the count is meaningless
    // otherwise. Near-now steps from other arcs drop to archiveSteps,
    // which the Saved sheet still surfaces bucketed by arc. NEXT is
    // exempt: when the current arc has no candidates it can live in an
    // old arc and must stay pageable.
    const arcScoped =
      currentArcId != null
        ? rows.filter((r) => r.in_current_arc || r.step_id === nextStepId)
        : rows;
    arcScoped.sort((a, b) => {
      const aDone = isDoneStatus(a.raw_status);
      const bDone = isDoneStatus(b.raw_status);
      if (aDone !== bDone) return aDone ? 1 : -1;
      if (!aDone) {
        // Current-arc steps lead the strip — NEXT is always the first card.
        if (a.in_current_arc !== b.in_current_arc) return a.in_current_arc ? -1 : 1;
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
    return arcScoped.map((r) => ({
      step_id: r.step_id,
      title: r.title,
      status: r.status,
      has_place: r.lat != null && r.lng != null,
      lat: r.lat,
      lng: r.lng,
      location_name: r.location_name,
      poi_id: r.poi_id,
      starts_at: r.starts_at,
      created_at: r.created_at,
      season_id: r.season_id,
      meta_season_id: r.meta_season_id,
      sort_order: r.sort_order,
    }));
  }, [data, raceAreaCenters, steps, inCurrentArc, nextStepId, currentArcId]);

  // Archive dataset — everything classify() rejected as not near-now.
  // The Saved sheet buckets these by arc; newest activity first.
  const archiveSteps = useMemo<ArchivePickerStep[]>(() => {
    const rows: ArchivePickerStep[] = [];
    for (const row of data) {
      const cls = classify({
        status: row.status,
        starts_at: row.starts_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
      const metadata = row.metadata as Record<string, unknown> | null;
      if (cls) {
        // Near-now rows live in pickerSteps ONLY when they're in the
        // current arc (or are NEXT) — the picker is arc-scoped. Other-arc
        // near-now rows fall through here so the Saved sheet keeps them.
        const inArc = inCurrentArc(
          typeof metadata?.season_id === 'string' ? (metadata.season_id as string) : null,
          (row as { season_id?: string | null }).season_id ?? null,
          row.starts_at,
          row.created_at,
        );
        if (currentArcId == null || inArc || row.id === nextStepId) continue;
      }
      const plan = (row.metadata as { plan?: { where_location?: unknown } } | null)?.plan;
      const whereLocation = plan?.where_location as
        | { lat?: unknown; lng?: unknown; name?: unknown; poi_id?: unknown }
        | undefined;
      const isRaceRow = (row as { is_race?: boolean | null }).is_race ?? false;
      const raceCenter = isRaceRow ? extractRacePlanCenter(metadata, raceAreaCenters) : null;
      const fallbackLat =
        typeof whereLocation?.lat === 'number' ? whereLocation.lat : null;
      const fallbackLng =
        typeof whereLocation?.lng === 'number' ? whereLocation.lng : null;
      const lat = raceCenter?.lat ?? fallbackLat ?? row.location_lat;
      const lng = raceCenter?.lng ?? fallbackLng ?? row.location_lng;
      const done = isDoneStatus(row.status);
      const metaSeasonId =
        typeof metadata?.season_id === 'string' ? (metadata.season_id as string) : null;
      rows.push({
        step_id: row.id,
        title: row.title,
        status: done ? 'done-old' : row.id === nextStepId ? 'planned-next' : 'planned-week',
        has_place: lat != null && lng != null,
        lat,
        lng,
        location_name:
          (raceCenter ? extractRaceContext(metadata)?.areaName : null) ??
          row.location_name ??
          (typeof whereLocation?.name === 'string' ? whereLocation.name : null),
        poi_id: typeof whereLocation?.poi_id === 'string' ? whereLocation.poi_id : null,
        starts_at: row.starts_at,
        created_at: row.created_at,
        season_id: (row as { season_id?: string | null }).season_id ?? null,
        meta_season_id: metaSeasonId,
        sort_order: (row as { sort_order?: number | null }).sort_order ?? 0,
      });
    }
    rows.sort((a, b) => {
      const at = new Date(a.starts_at ?? a.created_at).getTime();
      const bt = new Date(b.starts_at ?? b.created_at).getTime();
      return bt - at;
    });
    return rows;
  }, [data, raceAreaCenters, nextStepId, currentArcId, inCurrentArc]);

  return { steps, pickerSteps, archiveSteps, loading: isLoading || raceAreaCentersLoading };
}
