/**
 * useAtlasNextEvent — read the signed-in user's next upcoming event for
 * the Atlas tab's amber next-event tag + pre-staged composition CTAs.
 *
 * v1 sourcing:
 *   • Sailing (EXPO_PUBLIC_FF_ATLAS_NEXT_FROM_STEPS on): the soonest upcoming
 *     `timeline_steps` row with is_race=true — the canonical race-step spine.
 *     It carries race_plan.course_id, so the NEXT marker locks to the exact
 *     course. Falls through to the legacy path below when the flag is off or
 *     the user has no upcoming race step.
 *   • Sailing (legacy / fallback): pulls the soonest upcoming row from the
 *     `regattas` table where created_by = user.id, plus regattas the user is
 *     registered for via race_participants, plus race_events created by the
 *     user. Earliest future start across all three wins.
 *   • Nursing: reads the student's soonest upcoming clinical rotation from
 *     the purpose-built `nursing_affiliation_assignments → _rotations →
 *     nursing_affiliations` schema (mirrors the sailing path). Returns null
 *     when the student has no future assignment — which is the case in the
 *     demo today (assignments unseeded), so the nursing frame keeps its
 *     labeled fixture until real dated+located rotation data lands (N4).
 *   • Other interests: returns null. The brief's universal empty-state
 *     formula puts next_event_resolver behind per-interest registries
 *     — until those land, only sailing + nursing have a curated resolver.
 *
 * Returns null when the user has no upcoming event or the interest does
 * not have a resolver yet; the Atlas surface treats null as cold-start
 * and renders honest fallback copy (see (tabs)/atlas.tsx).
 *
 * Pure mapping/formatting helpers extracted to ./useAtlasNextEvent.utils
 * for testability.
 */

import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { useVocabulary } from '@/hooks/useVocabulary';
import { getAtlasNextEventLabel } from '@/lib/vocabulary';
import { supabase } from '@/services/supabase';
import type { AtlasNextEvent } from '@/components/ios-register/atlas/AtlasScreen';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import {
  mapRaceEventToNextEvent,
  mapRaceStepToNextEvent,
  mapRegattaToNextEvent,
  pickEarliest,
  type RaceEventRow,
  type RegattaRow,
  type TimelineRaceStepRow,
} from '@/hooks/useAtlasNextEvent.utils';

const NEXT_EVENT_KEY = 'atlas-next-event';

type NursingAffiliationRow = {
  name: string | null;
  location: string | null;
  focus: string | null;
  metadata: { lat?: number; lng?: number } | null;
};

type NursingRotationRow = {
  title: string | null;
  cohort: string | null;
  start_date: string | null;
  // supabase-js returns an embedded to-one as either an object or a 1-element
  // array depending on the relationship cardinality it infers.
  nursing_affiliations: NursingAffiliationRow | NursingAffiliationRow[] | null;
};

// Short "Mon Jun 9" style date for the amber NEXT tag. Rotation dates are
// plain DATE strings (YYYY-MM-DD); parse as local noon to dodge TZ rollover.
function formatRotationWhen(dateStr: string | null): string | undefined {
  if (!dateStr) return undefined;
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function mapNursingRotationToNextEvent(row: NursingRotationRow): AtlasNextEvent | null {
  const aff = Array.isArray(row.nursing_affiliations)
    ? row.nursing_affiliations[0] ?? null
    : row.nursing_affiliations;
  const site = aff?.name ?? null;
  const label = row.title?.trim() || 'Clinical';
  const when = formatRotationWhen(row.start_date);
  // Coords only when the affiliation actually carries them. The nursing frame
  // ignores a coordinate-less NEXT (can't place the map pin) and keeps its
  // fixture, so we never half-position the amber tag.
  const lat = typeof aff?.metadata?.lat === 'number' ? aff.metadata.lat : undefined;
  const lng = typeof aff?.metadata?.lng === 'number' ? aff.metadata.lng : undefined;
  return {
    label,
    when,
    where: site ?? undefined,
    conditions: [site, aff?.focus].filter(Boolean).join(' · ') || undefined,
    lat,
    lng,
    source_label: row.cohort ? `From: ${row.cohort} rotation schedule` : 'From: rotation schedule',
  };
}

/**
 * Series-on-map (Commit 3): count the race steps that share this race's
 * (course_id, season_id) and stamp series_count/series_label on the event so
 * the Atlas NEXT chip can render "N races · {Season}". Mutates the event in
 * place; only sets the fields when the series has more than one race (a lone
 * race isn't a series, so the badge stays hidden). Counting whole-season
 * (no starts_at filter) so the badge reflects the full series, not just the
 * remaining races. Best-effort — a failed count/label fetch leaves the event
 * unbadged rather than erroring the whole resolver.
 */
async function attachSeriesInfo(
  event: AtlasNextEvent,
  userId: string,
  periodLabel: string,
): Promise<void> {
  if (!event.course_id || !event.season_id) return;
  try {
    // Fetch the season's race steps and match course_id client-side. A
    // PostgREST nested-jsonb filter (metadata->race_plan->>course_id) is
    // brittle, so we scope by season (cheap — a season holds a handful of
    // races) and count the course matches in JS.
    const [{ data: siblings }, { data: season }] = await Promise.all([
      supabase
        .from('timeline_steps')
        .select('metadata')
        .eq('user_id', userId)
        .eq('is_race', true)
        .eq('season_id', event.season_id),
      supabase
        .from('seasons')
        .select('name, short_name')
        .eq('id', event.season_id)
        .maybeSingle(),
    ]);
    const count = (siblings ?? []).filter((row) => {
      const meta = (row as { metadata?: Record<string, unknown> | null }).metadata;
      const plan = meta && typeof meta === 'object' ? (meta as { race_plan?: { course_id?: unknown } }).race_plan : null;
      return plan?.course_id === event.course_id;
    }).length;
    if (count > 1) {
      event.series_count = count;
      const s = season as { name?: string | null; short_name?: string | null } | null;
      event.series_label = s?.short_name?.trim() || s?.name?.trim() || periodLabel;
    }
  } catch {
    // Leave the event unbadged — the series line is additive, not load-bearing.
  }
}

export function useAtlasNextEvent(interestSlugOverride?: string | null): AtlasNextEvent | null {
  const { user } = useAuth();
  const { currentInterest } = useInterest();
  const { vocab } = useVocabulary();
  // Generic series noun for this interest ("Series" for sailing, "Season"
  // elsewhere) — the fallback when a season row has no name. Captured here
  // (vocab is a hook) and threaded into the query so it can be used inside
  // the async queryFn.
  const periodLabel = vocab('Period');

  const interestSlug = (interestSlugOverride ?? currentInterest?.slug ?? '').toLowerCase();
  const isSailing =
    interestSlug === 'sailing' ||
    interestSlug === 'sail-racing' ||
    interestSlug === 'sail';
  const isNursing = interestSlug === 'nursing';

  const fromSteps = FEATURE_FLAGS.ATLAS_NEXT_FROM_STEPS;

  const query = useQuery({
    queryKey: [NEXT_EVENT_KEY, user?.id, interestSlug, fromSteps, periodLabel],
    enabled: Boolean(user?.id) && (isSailing || isNursing),
    queryFn: async (): Promise<AtlasNextEvent | null> => {
      const nowIso = new Date().toISOString();

      // Canonical race-step spine (EXPO_PUBLIC_FF_ATLAS_NEXT_FROM_STEPS). For
      // sailing, the soonest upcoming `timeline_steps` row with is_race=true
      // wins — it carries race_plan.course_id, so the NEXT marker can lock to
      // the exact course. Falls through to the legacy regatta/race_event path
      // when the flag is off or the user has no upcoming race step.
      if (isSailing && fromSteps) {
        const { data: raceStep, error: raceStepErr } = await supabase
          .from('timeline_steps')
          .select('id, title, starts_at, season_id, location_lat, location_lng, location_name, metadata')
          .eq('user_id', user!.id)
          .eq('is_race', true)
          .gte('starts_at', nowIso)
          .order('starts_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (!raceStepErr && raceStep) {
          const event = mapRaceStepToNextEvent(raceStep as TimelineRaceStepRow);
          if (event) {
            await attachSeriesInfo(event, user!.id, periodLabel);
            return event;
          }
        }
      }

      // Nursing: the student's soonest upcoming clinical rotation. A rotation
      // lives on `nursing_affiliation_rotations` (dated, cohort-level); the
      // student is tied to a site via `nursing_affiliation_assignments`. Take
      // the soonest future rotation among the sites the student is assigned to.
      // Returns null when nothing is assigned/upcoming — the nursing frame
      // then keeps its labeled demo fixture (assignments are unseeded today).
      if (isNursing) {
        const today = nowIso.slice(0, 10); // rotation dates are DATE, not timestamptz
        const { data: assignments, error: assignErr } = await supabase
          .from('nursing_affiliation_assignments')
          .select('affiliation_id')
          .eq('user_id', user!.id)
          .eq('status', 'active')
          .not('affiliation_id', 'is', null);
        if (assignErr) return null;
        const affiliationIds = (assignments ?? [])
          .map((a) => (a as { affiliation_id?: string }).affiliation_id)
          .filter((id): id is string => Boolean(id));
        if (affiliationIds.length === 0) return null;

        const { data: rotation, error: rotErr } = await supabase
          .from('nursing_affiliation_rotations')
          .select('title, cohort, start_date, nursing_affiliations(name, location, focus, metadata)')
          .in('affiliation_id', affiliationIds)
          .gte('start_date', today)
          .order('start_date', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (rotErr || !rotation) return null;
        return mapNursingRotationToNextEvent(rotation as NursingRotationRow);
      }


      // Three source paths:
      //   • regattas.created_by = user.id (owner)
      //   • race_participants → regattas (the user is crewed/registered)
      //   • race_events.user_id = user.id (user-created via add-race flow)
      // Take the earliest future timestamp across all three.
      const [regattaOwnedRes, participantRes, raceEventRes] = await Promise.all([
        supabase
          .from('regattas')
          .select('id, name, start_date, location, metadata, latitude, longitude')
          .eq('created_by', user!.id)
          .gte('start_date', nowIso)
          .order('start_date', { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('race_participants')
          .select('regatta_id')
          .eq('user_id', user!.id)
          .not('regatta_id', 'is', null)
          .neq('status', 'withdrawn')
          .limit(50),
        supabase
          // race_events has no `metadata` column (unlike regattas); selecting
          // it 42703s → PostgREST 400. Conditions/venue-from-metadata only
          // ever applied to regattas anyway.
          .from('race_events')
          .select('id, name, start_time, location, latitude, longitude')
          .eq('user_id', user!.id)
          .gte('start_time', nowIso)
          .order('start_time', { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);

      // Second hop: fetch the soonest future regatta from the participant
      // ID list, if any. Skip when the user isn't registered anywhere.
      let regattaParticipantRow: RegattaRow | null = null;
      const participantIds = (participantRes.data ?? [])
        .map((p) => (p as { regatta_id?: string }).regatta_id)
        .filter((id): id is string => Boolean(id));
      if (participantIds.length > 0 && !participantRes.error) {
        const { data, error } = await supabase
          .from('regattas')
          .select('id, name, start_date, location, metadata, latitude, longitude')
          .in('id', participantIds)
          .gte('start_date', nowIso)
          .order('start_date', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (!error && data) regattaParticipantRow = data as RegattaRow;
      }

      const candidates: { ts: string; event: AtlasNextEvent }[] = [];

      if (!regattaOwnedRes.error && regattaOwnedRes.data) {
        const event = mapRegattaToNextEvent(regattaOwnedRes.data as RegattaRow);
        if (event) candidates.push({ ts: regattaOwnedRes.data.start_date ?? '', event });
      }
      if (regattaParticipantRow) {
        const event = mapRegattaToNextEvent(regattaParticipantRow);
        if (event) candidates.push({ ts: regattaParticipantRow.start_date ?? '', event });
      }
      if (!raceEventRes.error && raceEventRes.data) {
        const event = mapRaceEventToNextEvent(raceEventRes.data as RaceEventRow);
        if (event) candidates.push({ ts: raceEventRes.data.start_time ?? '', event });
      }

      return pickEarliest(candidates);
    },
    // Refetch when the tab comes back into focus — the next event can
    // change as the user adds races elsewhere in the app.
    refetchOnMount: 'always',
    staleTime: 60_000,
  });

  // Stamp the persona-native eyebrow ("NEXT RACE" / "NEXT MARKET" / "NEXT
  // SHIFT" / "NEXT UP") so every consumer — the MapLibre amber tag and the
  // SVG fallback alike — names the event in the user's own vocabulary rather
  // than the sailing-default "NEXT RACE".
  const event = query.data ?? null;
  if (!event) return null;
  return { ...event, eyebrow: event.eyebrow ?? getAtlasNextEventLabel(interestSlug) };
}
