/**
 * useAtlasNextEvent — read the signed-in user's next upcoming event for
 * the Atlas tab's amber next-event tag + pre-staged composition CTAs.
 *
 * v1 sourcing:
 *   • Sailing: pulls the soonest upcoming row from the `regattas` table
 *     where created_by = user.id. Maps name / start_date / venue /
 *     metadata.{wind,tide} into an AtlasNextEvent payload.
 *   • Other interests: returns null. The brief's universal empty-state
 *     formula puts next_event_resolver behind per-interest registries
 *     — until those land, only sailing has a curated resolver.
 *
 * Returns null when the user has no upcoming event or the interest does
 * not have a resolver yet; the Atlas surface treats null as cold-start
 * and renders honest fallback copy (see (tabs)/atlas.tsx).
 */

import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { supabase } from '@/services/supabase';
import type { AtlasNextEvent } from '@/components/ios-register/atlas/AtlasScreen';

const NEXT_EVENT_KEY = 'atlas-next-event';

interface RegattaRow {
  id: string;
  name?: string | null;
  start_date?: string | null;
  venue?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface RaceEventRow {
  id: string;
  name?: string | null;
  start_time?: string | null;
  venue?: string | null;
  metadata?: Record<string, unknown> | null;
}

export function useAtlasNextEvent(): AtlasNextEvent | null {
  const { user } = useAuth();
  const { currentInterest } = useInterest();

  const interestSlug = (currentInterest?.slug ?? '').toLowerCase();
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
          .select('id, name, start_date, venue, metadata')
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
          .from('race_events')
          .select('id, name, start_time, venue, metadata')
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
          .select('id, name, start_date, venue, metadata')
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

      if (candidates.length === 0) return null;
      candidates.sort((a, b) => a.ts.localeCompare(b.ts));
      return candidates[0].event;
    },
    // Refetch when the tab comes back into focus — the next event can
    // change as the user adds races elsewhere in the app.
    refetchOnMount: 'always',
    staleTime: 60_000,
  });

  return query.data ?? null;
}

function mapRegattaToNextEvent(row: RegattaRow): AtlasNextEvent | null {
  const label = row.name?.trim() || 'Next race';
  const when = formatWhen(row.start_date);
  const where = readVenue(row.venue) || readMetadataString(row.metadata, 'venue_name') || undefined;
  const conditions = buildConditions(row.metadata);

  return { label, when, where, conditions };
}

function mapRaceEventToNextEvent(row: RaceEventRow): AtlasNextEvent | null {
  const label = row.name?.trim() || 'Next race';
  const when = formatWhen(row.start_time);
  const where = readVenue(row.venue) || readMetadataString(row.metadata, 'venue_name') || undefined;
  const conditions = buildConditions(row.metadata);

  return { label, when, where, conditions };
}

/**
 * `regattas.venue` is jsonb; `race_events.venue` is usually a string.
 * Handle both shapes — accept either a plain string or an object with a
 * `name` field.
 */
function readVenue(venue: unknown): string | undefined {
  if (!venue) return undefined;
  if (typeof venue === 'string') {
    const trimmed = venue.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof venue === 'object' && venue !== null) {
    const name = (venue as Record<string, unknown>).name;
    if (typeof name === 'string' && name.trim().length > 0) return name.trim();
  }
  return undefined;
}

/**
 * Compact "when" formatter — within 6 days use weekday + 12h time, else
 * use "Mon DD". Matches the canonical mockup's "Sat 10am" pattern.
 */
function formatWhen(iso?: string | null): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;

  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysOut = Math.floor((date.getTime() - now.getTime()) / msPerDay);

  const hour12 = ((date.getHours() + 11) % 12) + 1;
  const minute = date.getMinutes();
  const ampm = date.getHours() >= 12 ? 'pm' : 'am';
  const timePart = minute === 0 ? `${hour12}${ampm}` : `${hour12}:${String(minute).padStart(2, '0')}${ampm}`;

  if (daysOut <= 0) return `Today ${timePart}`;
  if (daysOut === 1) return `Tomorrow ${timePart}`;
  if (daysOut < 7) {
    const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
    return `${weekday} ${timePart}`;
  }
  const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${monthDay} ${timePart}`;
}

/**
 * Wind/tide overlay text. The canonical tag fits ~20 chars on its
 * second line; if metadata is missing or absent we return undefined so
 * the tag renders as a single line.
 */
function buildConditions(metadata: Record<string, unknown> | null | undefined): string | undefined {
  const wind = readMetadataString(metadata, 'wind') ?? readMetadataString(metadata, 'wind_summary');
  const tide = readMetadataString(metadata, 'tide') ?? readMetadataString(metadata, 'tide_summary');
  const parts = [wind, tide].filter((p): p is string => Boolean(p && p.length <= 24));
  if (parts.length === 0) return undefined;
  return parts.join(' · ');
}

function readMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): string | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}
