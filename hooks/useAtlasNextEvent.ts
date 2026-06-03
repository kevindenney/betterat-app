/**
 * useAtlasNextEvent — read the signed-in user's next upcoming event for
 * the Atlas tab's amber next-event tag + pre-staged composition CTAs.
 *
 * v1 sourcing:
 *   • Sailing: pulls the soonest upcoming row from the `regattas` table
 *     where created_by = user.id, plus regattas the user is registered
 *     for via race_participants, plus race_events created by the user.
 *     Earliest future start across all three wins.
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
import { supabase } from '@/services/supabase';
import type { AtlasNextEvent } from '@/components/ios-register/atlas/AtlasScreen';
import {
  mapRaceEventToNextEvent,
  mapRegattaToNextEvent,
  pickEarliest,
  type RaceEventRow,
  type RegattaRow,
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

export function useAtlasNextEvent(interestSlugOverride?: string | null): AtlasNextEvent | null {
  const { user } = useAuth();
  const { currentInterest } = useInterest();

  const interestSlug = (interestSlugOverride ?? currentInterest?.slug ?? '').toLowerCase();
  const isSailing =
    interestSlug === 'sailing' ||
    interestSlug === 'sail-racing' ||
    interestSlug === 'sail';
  const isNursing = interestSlug === 'nursing';

  const query = useQuery({
    queryKey: [NEXT_EVENT_KEY, user?.id, interestSlug],
    enabled: Boolean(user?.id) && (isSailing || isNursing),
    queryFn: async (): Promise<AtlasNextEvent | null> => {
      const nowIso = new Date().toISOString();

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

  return query.data ?? null;
}
