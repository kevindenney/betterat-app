/**
 * useNextRaceMarks — fetches the race_marks for the user's earliest
 * upcoming race_event tied to their next regatta.
 *
 * Chain:
 *   useAtlasNextEvent → event_kind='regatta', event_id=<regatta uuid>
 *   ↓ regatta_id
 *   race_events → earliest future row (or first row if none future)
 *   ↓ race_id
 *   race_marks  → ordered by sequence_order
 *
 * Renders on the Atlas F1 canvas at z11+ as numbered amber pins per
 * the design's pin grammar (kind: 'race-mark'). When no marks exist
 * the hook returns [], so the canvas stays clean rather than showing
 * a phantom "race here" cue.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import type { AtlasPinSpec } from '@/components/ios-register/atlas/AtlasMapLibreCanvas';

interface UseNextRaceMarksArgs {
  /** Regatta id from useAtlasNextEvent.event_id. */
  regattaId: string | null | undefined;
  /** Skip the query entirely. */
  enabled?: boolean;
}

export interface RaceMarkPin {
  id: string;
  lat: number;
  lng: number;
  label: string;
  sequence: number;
}

export function useNextRaceMarks({ regattaId, enabled = true }: UseNextRaceMarksArgs) {
  return useQuery({
    queryKey: ['next-race-marks', regattaId],
    enabled: enabled && Boolean(regattaId),
    staleTime: 60_000,
    queryFn: async (): Promise<AtlasPinSpec[]> => {
      if (!regattaId) return [];
      // Find the earliest upcoming race_event in this regatta; fall back
      // to the earliest row regardless of time if none are future-dated.
      const nowIso = new Date().toISOString();
      const { data: futureRace } = await supabase
        .from('race_events')
        .select('id, name, start_time')
        .eq('regatta_id', regattaId)
        .gte('start_time', nowIso)
        .order('start_time', { ascending: true })
        .limit(1)
        .maybeSingle();
      let raceId = futureRace?.id;
      let raceName = futureRace?.name ?? null;
      if (!raceId) {
        const { data: anyRace } = await supabase
          .from('race_events')
          .select('id, name')
          .eq('regatta_id', regattaId)
          .limit(1)
          .maybeSingle();
        raceId = anyRace?.id;
        raceName = anyRace?.name ?? raceName;
      }
      if (!raceId) return [];

      // Provenance — who set these marks. Prefer organizing_authority
      // (free-text, e.g. "RHKYC race committee"); fall back to the
      // regatta's club name when that's absent. Rendered as a "Set by
      // X · marks are read-only" line in the race-mark detail sheet so
      // the user can answer "who put this here, can I move it" without
      // a separate tap.
      const { data: regatta } = await supabase
        .from('regattas')
        .select('organizing_authority, club_id')
        .eq('id', regattaId)
        .maybeSingle();
      let organizer = regatta?.organizing_authority?.trim() || null;
      if (!organizer && regatta?.club_id) {
        const { data: club } = await supabase
          .from('clubs')
          .select('name')
          .eq('id', regatta.club_id)
          .maybeSingle();
        organizer = club?.name ?? null;
      }
      const provenance = organizer
        ? `Set by ${organizer} · marks are read-only`
        : 'Set by the race organizer · marks are read-only';

      const { data: marks, error } = await supabase
        .from('race_marks')
        .select('id, name, mark_type, latitude, longitude, sequence_order')
        .eq('race_id', raceId)
        .order('sequence_order', { ascending: true });
      if (error || !marks) return [];

      return marks
        .filter((m) => m.latitude != null && m.longitude != null)
        .map((m) => ({
          id: `race-mark:${m.id}`,
          lat: Number(m.latitude),
          lng: Number(m.longitude),
          kind: 'race-mark' as const,
          label: m.name || `#${m.sequence_order ?? '?'}`,
          // Subtitle reads as: "Windward · Mark 1 · Race 4". The race
          // name carries the "what race did the organizer set this for"
          // provenance — the regatta name lives in the sheet eyebrow
          // (handled by FrameF1 since it has the nextEvent context).
          subtitle: [
            m.mark_type ? String(m.mark_type) : null,
            m.sequence_order != null ? `Mark ${m.sequence_order}` : null,
            raceName,
          ]
            .filter(Boolean)
            .join(' · ') || undefined,
          provenance,
        }));
    },
  });
}
