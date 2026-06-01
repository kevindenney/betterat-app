/**
 * useAtlasNextEvent — read the signed-in user's next upcoming event for
 * the Atlas tab's amber next-event tag + pre-staged composition CTAs.
 *
 * v1 sourcing:
 *   • Sailing: pulls the soonest upcoming row from the `regattas` table
 *     where created_by = user.id, plus regattas the user is registered
 *     for via race_participants, plus race_events created by the user.
 *     Earliest future start across all three wins.
 *   • Other interests: returns null. The brief's universal empty-state
 *     formula puts next_event_resolver behind per-interest registries
 *     — until those land, only sailing has a curated resolver.
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

export function useAtlasNextEvent(interestSlugOverride?: string | null): AtlasNextEvent | null {
  const { user } = useAuth();
  const { currentInterest } = useInterest();

  const interestSlug = (interestSlugOverride ?? currentInterest?.slug ?? '').toLowerCase();
  const isSailing =
    interestSlug === 'sailing' ||
    interestSlug === 'sail-racing' ||
    interestSlug === 'sail';

  const query = useQuery({
    queryKey: [NEXT_EVENT_KEY, user?.id, interestSlug],
    enabled: Boolean(user?.id) && isSailing,
    queryFn: async (): Promise<AtlasNextEvent | null> => {
      const nowIso = new Date().toISOString();

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
