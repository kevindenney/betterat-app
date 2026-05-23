/**
 * useUserUpcomingEvents — returns Events the user could plausibly link a
 * Step to ("in service of which event?"). Polymorphic by design: today
 * only sailing's regattas are queried; future verticals add their own
 * source paths and the consumer renders a unified picker.
 *
 * Per the Step→Event model: Step is the universal atomic unit, an Event
 * is the optional shared/scheduled thing the Step is in service of.
 * See migration timeline_steps_target_event.
 *
 * Sourcing for sailing v1:
 *   • regattas.created_by = user.id (events the user owns)
 *   • race_participants → regattas (events the user is registered for)
 * Earliest future start within 12 months wins; past events excluded.
 *
 * Non-sailing interests return [] until their resolver lands.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { supabase } from '@/services/supabase';

export type StepTargetEventKind =
  | 'regatta'
  | 'race_event'
  | 'tournament'
  | 'competition'
  | 'market_day'
  | 'pitch';

export interface UpcomingEventOption {
  kind: StepTargetEventKind;
  id: string;
  label: string;
  /** ISO datetime when the event starts. */
  starts_at: string | null;
  /** Short subtitle, e.g. venue + role line. */
  subtitle?: string;
  /** Anchor coords for the Atlas amber tag, when known. */
  lat?: number;
  lng?: number;
}

export function useUserUpcomingEvents() {
  const { user } = useAuth();
  const { currentInterest } = useInterest();
  const slug = (currentInterest?.slug ?? '').toLowerCase();
  const isSailing =
    slug === 'sailing' || slug === 'sail-racing' || slug === 'sail';

  return useQuery({
    queryKey: ['user-upcoming-events', user?.id, slug],
    enabled: Boolean(user?.id) && isSailing,
    staleTime: 60_000,
    queryFn: async (): Promise<UpcomingEventOption[]> => {
      if (!user?.id) return [];
      const nowIso = new Date().toISOString();
      // Pull both owner-created and participant-registered regattas in
      // parallel. Merge + dedupe by id; sort by starts_at ascending.
      const [ownedRes, participantRes] = await Promise.all([
        supabase
          .from('regattas')
          .select('id, name, start_date, venue, latitude, longitude')
          .eq('created_by', user.id)
          .gte('start_date', nowIso)
          .order('start_date', { ascending: true })
          .limit(20),
        supabase
          .from('race_participants')
          .select('regattas:regatta_id(id, name, start_date, venue, latitude, longitude)')
          .eq('user_id', user.id),
      ]);

      const byId = new Map<string, UpcomingEventOption>();
      type Row = {
        id: string;
        name: string;
        start_date: string | null;
        venue: string | null;
        latitude: number | null;
        longitude: number | null;
      };
      const pushRow = (r: Row | null) => {
        if (!r || !r.id) return;
        if (r.start_date && r.start_date < nowIso) return;
        byId.set(r.id, {
          kind: 'regatta',
          id: r.id,
          label: r.name || 'Untitled regatta',
          starts_at: r.start_date,
          subtitle: r.venue ?? undefined,
          lat: r.latitude ?? undefined,
          lng: r.longitude ?? undefined,
        });
      };
      (ownedRes.data ?? []).forEach((row) => pushRow(row as Row));
      (participantRes.data ?? []).forEach((row) => {
        // supabase-js types the FK-embedded relation as an array; in
        // practice it's a single object since regatta_id is a singular FK.
        const r = (row as unknown as { regattas: Row | Row[] | null }).regattas;
        if (Array.isArray(r)) {
          r.forEach((item) => pushRow(item));
        } else {
          pushRow(r);
        }
      });

      return Array.from(byId.values()).sort((a, b) => {
        const aT = a.starts_at ?? '9999';
        const bT = b.starts_at ?? '9999';
        return aT.localeCompare(bT);
      });
    },
  });
}
