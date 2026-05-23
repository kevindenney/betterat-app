/**
 * useTargetEvent — fetches the Event a Step is linked to (Step.target_event_kind
 * + Step.target_event_id). Polymorphic dispatch by kind.
 *
 * Used by the PlanInServiceOfCard to render the linked-event chip and by
 * Atlas to anchor the amber NEXT tag on the event's venue coords.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import type { StepTargetEventKind, UpcomingEventOption } from './useUserUpcomingEvents';

interface UseTargetEventArgs {
  kind: StepTargetEventKind | null | undefined;
  id: string | null | undefined;
}

type SitePoi = { name: string; lat: number; lng: number } | null;
const readPoi = (raw: unknown): SitePoi => {
  if (!raw) return null;
  if (Array.isArray(raw)) return (raw[0] as SitePoi) ?? null;
  return raw as SitePoi;
};

export function useTargetEvent({ kind, id }: UseTargetEventArgs) {
  return useQuery({
    queryKey: ['target-event', kind, id],
    enabled: Boolean(kind && id),
    staleTime: 60_000,
    queryFn: async (): Promise<UpcomingEventOption | null> => {
      if (!kind || !id) return null;

      if (kind === 'regatta') {
        const { data, error } = await supabase
          .from('regattas')
          .select('id, name, start_date, location, latitude, longitude')
          .eq('id', id)
          .maybeSingle();
        if (error || !data) return null;
        return {
          kind: 'regatta',
          id: data.id,
          label: data.name || 'Untitled regatta',
          starts_at: data.start_date,
          subtitle: data.location ?? undefined,
          lat: data.latitude ?? undefined,
          lng: data.longitude ?? undefined,
        };
      }

      if (kind === 'clinical_shift') {
        const { data, error } = await supabase
          .from('clinical_shifts')
          .select('id, shift_label, shift_start, unit, specialty, atlas_pois:site_poi_id(name, lat, lng)')
          .eq('id', id)
          .maybeSingle();
        if (error || !data) return null;
        const site = readPoi((data as { atlas_pois?: unknown }).atlas_pois);
        return {
          kind: 'clinical_shift',
          id: data.id,
          label: data.shift_label,
          starts_at: data.shift_start,
          subtitle: [site?.name, data.unit, data.specialty].filter(Boolean).join(' · ') || undefined,
          lat: site?.lat,
          lng: site?.lng,
        };
      }

      if (kind === 'sim_session') {
        const { data, error } = await supabase
          .from('sim_sessions')
          .select('id, scenario_label, session_start, atlas_pois:site_poi_id(name, lat, lng)')
          .eq('id', id)
          .maybeSingle();
        if (error || !data) return null;
        const site = readPoi((data as { atlas_pois?: unknown }).atlas_pois);
        return {
          kind: 'sim_session',
          id: data.id,
          label: data.scenario_label,
          starts_at: data.session_start,
          subtitle: site?.name,
          lat: site?.lat,
          lng: site?.lng,
        };
      }

      if (kind === 'assessment') {
        const { data, error } = await supabase
          .from('assessments')
          .select('id, title, scheduled_at, assessment_kind, atlas_pois:venue_poi_id(name, lat, lng)')
          .eq('id', id)
          .maybeSingle();
        if (error || !data) return null;
        const site = readPoi((data as { atlas_pois?: unknown }).atlas_pois);
        const kindLabel = data.assessment_kind?.replace(/_/g, ' ');
        return {
          kind: 'assessment',
          id: data.id,
          label: data.title,
          starts_at: data.scheduled_at,
          subtitle: [kindLabel, site?.name].filter(Boolean).join(' · ') || undefined,
          lat: site?.lat,
          lng: site?.lng,
        };
      }

      if (kind === 'market_day') {
        const { data, error } = await supabase
          .from('market_days')
          .select('id, label, label_local, starts_at, atlas_pois:venue_poi_id(name, lat, lng)')
          .eq('id', id)
          .maybeSingle();
        if (error || !data) return null;
        const site = readPoi((data as { atlas_pois?: unknown }).atlas_pois);
        return {
          kind: 'market_day',
          id: data.id,
          label: data.label_local ? `${data.label} · ${data.label_local}` : data.label,
          starts_at: data.starts_at,
          subtitle: site?.name,
          lat: site?.lat,
          lng: site?.lng,
        };
      }

      if (kind === 'pitch') {
        const { data, error } = await supabase
          .from('pitches')
          .select('id, label, label_local, counterparty, scheduled_at, atlas_pois:venue_poi_id(name, lat, lng)')
          .eq('id', id)
          .maybeSingle();
        if (error || !data) return null;
        const site = readPoi((data as { atlas_pois?: unknown }).atlas_pois);
        return {
          kind: 'pitch',
          id: data.id,
          label: data.label_local ? `${data.label} · ${data.label_local}` : data.label,
          starts_at: data.scheduled_at,
          subtitle: [data.counterparty, site?.name].filter(Boolean).join(' · ') || undefined,
          lat: site?.lat,
          lng: site?.lng,
        };
      }

      if (kind === 'mentor_visit') {
        const { data, error } = await supabase
          .from('mentor_visits')
          .select('id, label, label_local, mentor_name, scheduled_at, atlas_pois:venue_poi_id(name, lat, lng)')
          .eq('id', id)
          .maybeSingle();
        if (error || !data) return null;
        const site = readPoi((data as { atlas_pois?: unknown }).atlas_pois);
        return {
          kind: 'mentor_visit',
          id: data.id,
          label: data.label_local ? `${data.label} · ${data.label_local}` : data.label,
          starts_at: data.scheduled_at,
          subtitle: [data.mentor_name, site?.name].filter(Boolean).join(' · ') || undefined,
          lat: site?.lat,
          lng: site?.lng,
        };
      }

      if (kind === 'delivery_run') {
        const { data, error } = await supabase
          .from('delivery_runs')
          .select('id, label, label_local, scheduled_at, atlas_pois:venue_poi_id(name, lat, lng)')
          .eq('id', id)
          .maybeSingle();
        if (error || !data) return null;
        const site = readPoi((data as { atlas_pois?: unknown }).atlas_pois);
        return {
          kind: 'delivery_run',
          id: data.id,
          label: data.label_local ? `${data.label} · ${data.label_local}` : data.label,
          starts_at: data.scheduled_at,
          subtitle: site?.name,
          lat: site?.lat,
          lng: site?.lng,
        };
      }

      // race_event / tournament / competition — not yet wired. Picker
      // won't surface them so steps shouldn't have them linked in v1.
      return null;
    },
  });
}
