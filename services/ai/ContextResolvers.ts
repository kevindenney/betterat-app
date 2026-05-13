import { SupabaseClient } from '@supabase/supabase-js';

export interface EventContext {
  clubId: string;
  event: any;
  club: any;
  previousDocuments: { document_type: string; draft_text: string; created_at: string }[];
}

export interface RaceContext {
  clubId: string;
  race: any;
  regatta?: any;
  weather?: {
    summary?: string;
    wind?: string;
  };
  preparation?: {
    rigNotes?: string;
    selectedRigPresetId?: string;
    acknowledgements?: {
      cleanRegatta: boolean;
      signOn: boolean;
      safetyBriefing: boolean;
    };
    raceBrief?: {
      id?: string;
      name?: string;
      series?: string;
      venue?: string;
      startTime?: string;
      warningSignal?: string;
      cleanRegatta?: boolean;
      countdown?: {
        days: number;
        hours: number;
        minutes: number;
      };
      weatherSummary?: string;
      tideSummary?: string;
      lastUpdated?: string;
    };
  };
}

export interface ClubSummary {
  clubId: string;
  name: string;
  timezone?: string | null;
  location?: string | null;
  brandVoice?: string | null;
}

export async function resolveEventContext(
  supabase: SupabaseClient,
  eventId: string
): Promise<EventContext> {
  const { data: event, error } = await supabase
    .from('club_events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle();

  if (error || !event) {
    throw new Error('Event not found');
  }

  const { data: club } = await supabase
    .from('club_profiles')
    .select('id, club_name, primary_timezone, location')
    .eq('id', event.club_id)
    .maybeSingle();

  const { data: previousDocuments } = await supabase
    .from('ai_generated_documents')
    .select('document_type, draft_text, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(5);

  return {
    clubId: event.club_id,
    event,
    club,
    previousDocuments: previousDocuments ?? [],
  };
}

export async function resolveRaceContext(
  supabase: SupabaseClient,
  raceId: string,
  sailorId?: string
): Promise<RaceContext> {
  const { data: race, error } = await supabase
    .from('club_races')
    .select('*')
    .eq('id', raceId)
    .maybeSingle();

  if (error || !race) {
    throw new Error('Race not found');
  }

  const { data: regatta } = await supabase
    .from('club_events')
    .select('id, title, start_date, end_date')
    .eq('id', race.event_id)
    .maybeSingle();

  // Fetch sailor race preparation if sailorId is provided
  let preparation = undefined;
  if (sailorId) {
    const { data: prep } = await supabase
      .from('sailor_race_preparation')
      .select('*')
      .eq('race_event_id', raceId)
      .eq('sailor_id', sailorId)
      .maybeSingle();

    if (prep) {
      preparation = {
        rigNotes: prep.rig_notes,
        selectedRigPresetId: prep.selected_rig_preset_id,
        acknowledgements: prep.regulatory_acknowledgements,
        raceBrief: prep.race_brief_data,
      };
    }
  }

  return {
    clubId: race.club_id,
    race,
    regatta,
    preparation,
  };
}

export async function resolveClubSummary(
  supabase: SupabaseClient,
  clubId: string
): Promise<ClubSummary> {
  const { data: club, error } = await supabase
    .from('club_profiles')
    .select('id, club_name, primary_timezone, location, brand_voice')
    .eq('id', clubId)
    .maybeSingle();

  if (error || !club) {
    throw new Error('Club not found');
  }

  return {
    clubId: club.id,
    name: club.club_name,
    timezone: club.primary_timezone,
    location: club.location,
    brandVoice: club.brand_voice,
  };
}

