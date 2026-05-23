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
  | 'clinical_shift'
  | 'sim_session'
  | 'assessment'
  | 'market_day'
  | 'mentor_visit'
  | 'delivery_run'
  | 'pitch'
  | 'tournament'
  | 'competition';

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
  const isNursing =
    slug === 'nursing' || slug === 'msn' || slug === 'msn-nursing';
  const isEntrepreneur =
    slug === 'entrepreneur' ||
    slug === 'micro-entrepreneur' ||
    slug === 'home-entrepreneur' ||
    slug === 'small-business';

  return useQuery({
    queryKey: ['user-upcoming-events', user?.id, slug],
    enabled: Boolean(user?.id) && (isSailing || isNursing || isEntrepreneur),
    staleTime: 60_000,
    queryFn: async (): Promise<UpcomingEventOption[]> => {
      if (!user?.id) return [];
      const nowIso = new Date().toISOString();
      if (isSailing) return fetchSailingEvents(user.id, nowIso);
      if (isNursing) return fetchNursingEvents(user.id, nowIso);
      if (isEntrepreneur) return fetchEntrepreneurEvents(user.id, nowIso);
      return [];
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Per-vertical event resolvers
// ─────────────────────────────────────────────────────────────────────────

async function fetchSailingEvents(
  userId: string,
  nowIso: string,
): Promise<UpcomingEventOption[]> {
  // Pull owner-created + participant-registered regattas in parallel.
  // Merge + dedupe by id; sort by starts_at ascending.
  const [ownedRes, participantRes] = await Promise.all([
    supabase
      .from('regattas')
      .select('id, name, start_date, venue, latitude, longitude')
      .eq('created_by', userId)
      .gte('start_date', nowIso)
      .order('start_date', { ascending: true })
      .limit(20),
    supabase
      .from('race_participants')
      .select('regattas:regatta_id(id, name, start_date, venue, latitude, longitude)')
      .eq('user_id', userId),
  ]);

  type Row = {
    id: string;
    name: string;
    start_date: string | null;
    venue: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  const byId = new Map<string, UpcomingEventOption>();
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
    const r = (row as unknown as { regattas: Row | Row[] | null }).regattas;
    if (Array.isArray(r)) {
      r.forEach((item) => pushRow(item));
    } else {
      pushRow(r);
    }
  });
  return sortByStartsAt(Array.from(byId.values()));
}

async function fetchNursingEvents(
  userId: string,
  nowIso: string,
): Promise<UpcomingEventOption[]> {
  // Nursing has three event tables — clinical_shifts (next dated clinical
  // day at a partner hospital), sim_sessions (cohort sim lab bookings),
  // assessments (OSCE / capstone / competency check). All three filter
  // by student_id = current user and future timestamps. Pulled in
  // parallel + merged; the picker shows them in one ascending list.
  const [shiftsRes, simsRes, assessmentsRes] = await Promise.all([
    supabase
      .from('clinical_shifts')
      .select('id, shift_label, shift_start, unit, specialty, atlas_pois:site_poi_id(name, lat, lng)')
      .eq('student_id', userId)
      .gte('shift_start', nowIso)
      .order('shift_start', { ascending: true })
      .limit(10),
    supabase
      .from('sim_sessions')
      .select('id, scenario_label, session_start, atlas_pois:site_poi_id(name, lat, lng)')
      .eq('student_id', userId)
      .gte('session_start', nowIso)
      .order('session_start', { ascending: true })
      .limit(10),
    supabase
      .from('assessments')
      .select('id, title, scheduled_at, assessment_kind, atlas_pois:venue_poi_id(name, lat, lng)')
      .eq('student_id', userId)
      .gte('scheduled_at', nowIso)
      .order('scheduled_at', { ascending: true })
      .limit(10),
  ]);

  type SitePoi = { name: string; lat: number; lng: number } | null;
  const readPoi = (raw: unknown): SitePoi => {
    if (!raw) return null;
    if (Array.isArray(raw)) return (raw[0] as SitePoi) ?? null;
    return raw as SitePoi;
  };

  const out: UpcomingEventOption[] = [];

  for (const row of shiftsRes.data ?? []) {
    const r = row as {
      id: string;
      shift_label: string;
      shift_start: string;
      unit?: string | null;
      specialty?: string | null;
      atlas_pois?: unknown;
    };
    const site = readPoi(r.atlas_pois);
    const subtitleParts = [site?.name, r.unit, r.specialty].filter(Boolean);
    out.push({
      kind: 'clinical_shift',
      id: r.id,
      label: r.shift_label,
      starts_at: r.shift_start,
      subtitle: subtitleParts.length > 0 ? subtitleParts.join(' · ') : undefined,
      lat: site?.lat,
      lng: site?.lng,
    });
  }
  for (const row of simsRes.data ?? []) {
    const r = row as {
      id: string;
      scenario_label: string;
      session_start: string;
      atlas_pois?: unknown;
    };
    const site = readPoi(r.atlas_pois);
    out.push({
      kind: 'sim_session',
      id: r.id,
      label: r.scenario_label,
      starts_at: r.session_start,
      subtitle: site?.name,
      lat: site?.lat,
      lng: site?.lng,
    });
  }
  for (const row of assessmentsRes.data ?? []) {
    const r = row as {
      id: string;
      title: string;
      scheduled_at: string;
      assessment_kind?: string | null;
      atlas_pois?: unknown;
    };
    const site = readPoi(r.atlas_pois);
    const kindLabel = r.assessment_kind?.replace(/_/g, ' ');
    out.push({
      kind: 'assessment',
      id: r.id,
      label: r.title,
      starts_at: r.scheduled_at,
      subtitle: [kindLabel, site?.name].filter(Boolean).join(' · ') || undefined,
      lat: site?.lat,
      lng: site?.lng,
    });
  }

  return sortByStartsAt(out);
}

async function fetchEntrepreneurEvents(
  userId: string,
  nowIso: string,
): Promise<UpcomingEventOption[]> {
  // Entrepreneur has four event tables, all owner-keyed on user_id:
  // market_days (recurring market), pitches (microfinance / sales /
  // investor), mentor_visits (NGO/SHG touchpoints), delivery_runs
  // (customer cluster trips). Same parallel-merge pattern as nursing.
  // label_local (Devanagari etc.) is appended when present so the
  // picker reads bilingually without extra UI.
  const [marketsRes, pitchesRes, mentorsRes, deliveriesRes] = await Promise.all([
    supabase
      .from('market_days')
      .select('id, label, label_local, starts_at, atlas_pois:venue_poi_id(name, lat, lng)')
      .eq('user_id', userId)
      .gte('starts_at', nowIso)
      .order('starts_at', { ascending: true })
      .limit(10),
    supabase
      .from('pitches')
      .select('id, label, label_local, counterparty, pitch_kind, scheduled_at, atlas_pois:venue_poi_id(name, lat, lng)')
      .eq('user_id', userId)
      .gte('scheduled_at', nowIso)
      .order('scheduled_at', { ascending: true })
      .limit(10),
    supabase
      .from('mentor_visits')
      .select('id, label, label_local, mentor_name, scheduled_at, modality, atlas_pois:venue_poi_id(name, lat, lng)')
      .eq('user_id', userId)
      .gte('scheduled_at', nowIso)
      .order('scheduled_at', { ascending: true })
      .limit(10),
    supabase
      .from('delivery_runs')
      .select('id, label, label_local, scheduled_at, atlas_pois:venue_poi_id(name, lat, lng)')
      .eq('user_id', userId)
      .gte('scheduled_at', nowIso)
      .order('scheduled_at', { ascending: true })
      .limit(10),
  ]);

  type SitePoi = { name: string; lat: number; lng: number } | null;
  const readPoi = (raw: unknown): SitePoi => {
    if (!raw) return null;
    if (Array.isArray(raw)) return (raw[0] as SitePoi) ?? null;
    return raw as SitePoi;
  };
  const bilingualLabel = (label: string, label_local?: string | null) =>
    label_local && label_local.trim().length > 0 ? `${label} · ${label_local}` : label;

  const out: UpcomingEventOption[] = [];

  for (const row of marketsRes.data ?? []) {
    const r = row as {
      id: string;
      label: string;
      label_local: string | null;
      starts_at: string;
      atlas_pois?: unknown;
    };
    const site = readPoi(r.atlas_pois);
    out.push({
      kind: 'market_day',
      id: r.id,
      label: bilingualLabel(r.label, r.label_local),
      starts_at: r.starts_at,
      subtitle: site?.name,
      lat: site?.lat,
      lng: site?.lng,
    });
  }
  for (const row of pitchesRes.data ?? []) {
    const r = row as {
      id: string;
      label: string;
      label_local: string | null;
      counterparty: string;
      pitch_kind: string;
      scheduled_at: string;
      atlas_pois?: unknown;
    };
    const site = readPoi(r.atlas_pois);
    out.push({
      kind: 'pitch',
      id: r.id,
      label: bilingualLabel(r.label, r.label_local),
      starts_at: r.scheduled_at,
      subtitle: [r.counterparty, site?.name].filter(Boolean).join(' · ') || undefined,
      lat: site?.lat,
      lng: site?.lng,
    });
  }
  for (const row of mentorsRes.data ?? []) {
    const r = row as {
      id: string;
      label: string;
      label_local: string | null;
      mentor_name: string;
      modality: string | null;
      scheduled_at: string;
      atlas_pois?: unknown;
    };
    const site = readPoi(r.atlas_pois);
    out.push({
      kind: 'mentor_visit',
      id: r.id,
      label: bilingualLabel(r.label, r.label_local),
      starts_at: r.scheduled_at,
      subtitle: [r.mentor_name, r.modality, site?.name].filter(Boolean).join(' · ') || undefined,
      lat: site?.lat,
      lng: site?.lng,
    });
  }
  for (const row of deliveriesRes.data ?? []) {
    const r = row as {
      id: string;
      label: string;
      label_local: string | null;
      scheduled_at: string;
      atlas_pois?: unknown;
    };
    const site = readPoi(r.atlas_pois);
    out.push({
      kind: 'delivery_run',
      id: r.id,
      label: bilingualLabel(r.label, r.label_local),
      starts_at: r.scheduled_at,
      subtitle: site?.name,
      lat: site?.lat,
      lng: site?.lng,
    });
  }

  return sortByStartsAt(out);
}

function sortByStartsAt(events: UpcomingEventOption[]): UpcomingEventOption[] {
  return [...events].sort((a, b) => {
    const aT = a.starts_at ?? '9999';
    const bT = b.starts_at ?? '9999';
    return aT.localeCompare(bT);
  });
}
