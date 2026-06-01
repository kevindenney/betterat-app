/**
 * Consolidated Public Regatta API
 * Returns regatta info with optional includes - NO AUTH REQUIRED
 *
 * GET /api/public/regattas/[regattaId]
 *
 * Query params:
 *   - include: Comma-separated list of 'results', 'schedule', 'notices'
 *   - division: Filter results by division
 *   - race: Filter results by specific race number
 *   - date: Filter schedule by specific date (YYYY-MM-DD)
 *   - priority: Filter notices by priority ('urgent' | 'important' | 'normal')
 *   - format: 'json' (default) | 'csv' (only for results)
 */

import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============ TYPE DEFINITIONS ============

export interface PublicRegattaInfo {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  venue: string | null;
  venue_coordinates: { lat: number; lng: number } | null;
  club: {
    id: string;
    name: string;
    logo_url: string | null;
    website: string | null;
  } | null;
  classes: string[];
  entry_fee: number | null;
  currency: string | null;
  registration_status: 'not_open' | 'open' | 'closed' | 'full';
  registration_deadline: string | null;
  entry_count: number;
  max_entries: number | null;
  status: string;
  contact_email: string | null;
  documents: {
    id: string;
    title: string;
    type: 'nor' | 'si' | 'amendment' | 'other';
    url: string;
    published_at: string;
  }[];
  links: {
    results: string;
    schedule: string;
    notices: string;
    entries: string;
  };
}

export interface PublicRaceResult {
  race_number: number;
  race_date: string | null;
  division: string | null;
  results: {
    position: number;
    sail_number: string;
    boat_name: string | null;
    skipper_name: string | null;
    elapsed_time: string | null;
    corrected_time: string | null;
    points: number;
    status: string;
  }[];
}

export interface PublicStanding {
  position: number;
  sail_number: string;
  boat_name: string | null;
  skipper_name: string | null;
  division: string | null;
  total_points: number;
  net_points: number;
  races_sailed: number;
  discards: number[];
  race_results: { race: number; points: number; discarded: boolean }[];
}

export interface ScheduledRace {
  id: string;
  race_number: number;
  division: string | null;
  scheduled_start: string;
  warning_signal: string | null;
  course_type: string | null;
  course_description: string | null;
  status: 'scheduled' | 'postponed' | 'abandoned' | 'completed' | 'in_progress';
  postponement_reason: string | null;
  new_start_time: string | null;
}

export interface ScheduleDay {
  date: string;
  day_name: string;
  races: ScheduledRace[];
  weather_forecast: {
    wind_speed: number | null;
    wind_direction: string | null;
    conditions: string | null;
  } | null;
  special_notices: string[];
}

export interface PublicNotice {
  id: string;
  title: string;
  content: string;
  priority: 'urgent' | 'important' | 'normal';
  published_at: string;
  expires_at: string | null;
  attachments: {
    name: string;
    url: string;
    type: string;
  }[];
  author: string | null;
}

export interface PublicRegattaResponse {
  regatta: PublicRegattaInfo;
  results?: {
    races: PublicRaceResult[];
    standings: PublicStanding[];
    metadata: {
      total_entries: number;
      races_completed: number;
      results_published: boolean;
      last_updated: string;
    };
  };
  schedule?: {
    days: ScheduleDay[];
    metadata: {
      total_races: number;
      races_completed: number;
      last_updated: string;
    };
  };
  notices?: {
    items: PublicNotice[];
    metadata: {
      total_count: number;
      has_more: boolean;
    };
  };
}

// ============ HANDLER ============

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers for public access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { regattaId } = req.query;
  const includeParam = (req.query.include as string) || '';
  const includes = includeParam.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

  // Filters
  const division = req.query.division as string | undefined;
  const raceNumber = req.query.race ? parseInt(req.query.race as string) : undefined;
  const dateFilter = req.query.date as string | undefined;
  const priority = req.query.priority as string | undefined;
  const format = (req.query.format as string) || 'json';

  if (!regattaId || typeof regattaId !== 'string') {
    return res.status(400).json({ error: 'Missing regattaId parameter' });
  }

  try {
    // Fetch base regatta info
    const regattaInfo = await fetchRegattaInfo(regattaId);
    if (!regattaInfo) {
      return res.status(404).json({ error: 'Regatta not found' });
    }

    const response: PublicRegattaResponse = { regatta: regattaInfo };

    // Fetch optional includes in parallel
    const fetchPromises: Promise<void>[] = [];

    if (includes.includes('results')) {
      fetchPromises.push(
        fetchResults(regattaId, division, raceNumber).then(data => {
          if (data) response.results = data;
        })
      );
    }

    if (includes.includes('schedule')) {
      fetchPromises.push(
        fetchSchedule(regattaId, dateFilter).then(data => {
          if (data) response.schedule = data;
        })
      );
    }

    if (includes.includes('notices')) {
      fetchPromises.push(
        fetchNotices(regattaId, priority).then(data => {
          if (data) response.notices = data;
        })
      );
    }

    await Promise.all(fetchPromises);

    // Return CSV format if requested (only for results)
    if (format === 'csv' && response.results) {
      const csv = generateCSV(regattaInfo, response.results);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${regattaInfo.name.replace(/[^a-z0-9]/gi, '_')}_results.csv"`);
      return res.status(200).send(csv);
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error('Public regatta API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ============ DATA FETCHERS ============

async function fetchRegattaInfo(regattaId: string): Promise<PublicRegattaInfo | null> {
  const { data: regatta, error } = await supabase
    .from('regattas')
    .select(`
      id, name, description, start_date, end_date, venue,
      venue_latitude, venue_longitude, boat_classes, entry_fee,
      currency, registration_open, registration_close, max_entries,
      status, contact_email,
      clubs (id, club_name, logo_url, website)
    `)
    .eq('id', regattaId)
    .single();

  if (error || !regatta) return null;

  // Count entries
  const { count: entryCount } = await supabase
    .from('race_entries')
    .select('*', { count: 'exact', head: true })
    .eq('regatta_id', regattaId)
    .in('status', ['confirmed', 'pending']);

  // Fetch public documents
  const { data: documents } = await supabase
    .from('regatta_documents')
    .select('id, title, document_type, url, published_at')
    .eq('regatta_id', regattaId)
    .eq('visibility', 'public')
    .order('published_at', { ascending: false });

  // Determine registration status
  const now = new Date();
  let registrationStatus: 'not_open' | 'open' | 'closed' | 'full' = 'not_open';

  if (regatta.registration_open && regatta.registration_close) {
    const openDate = new Date(regatta.registration_open);
    const closeDate = new Date(regatta.registration_close);

    if (now < openDate) {
      registrationStatus = 'not_open';
    } else if (now > closeDate) {
      registrationStatus = 'closed';
    } else if (regatta.max_entries && (entryCount || 0) >= regatta.max_entries) {
      registrationStatus = 'full';
    } else {
      registrationStatus = 'open';
    }
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.EXPO_PUBLIC_API_URL || 'https://regattaflow.com';

  return {
    id: regatta.id,
    name: regatta.name,
    description: regatta.description,
    start_date: regatta.start_date,
    end_date: regatta.end_date,
    venue: regatta.venue,
    venue_coordinates: regatta.venue_latitude && regatta.venue_longitude
      ? { lat: regatta.venue_latitude, lng: regatta.venue_longitude }
      : null,
    club: regatta.clubs ? {
      id: (regatta.clubs as any).id,
      name: (regatta.clubs as any).club_name,
      logo_url: (regatta.clubs as any).logo_url,
      website: (regatta.clubs as any).website,
    } : null,
    classes: regatta.boat_classes || [],
    entry_fee: regatta.entry_fee,
    currency: regatta.currency,
    registration_status: registrationStatus,
    registration_deadline: regatta.registration_close,
    entry_count: entryCount || 0,
    max_entries: regatta.max_entries,
    status: regatta.status,
    contact_email: regatta.contact_email,
    documents: (documents || []).map((d: any) => ({
      id: d.id,
      title: d.title,
      type: d.document_type || 'other',
      url: d.url,
      published_at: d.published_at,
    })),
    links: {
      results: `${baseUrl}/p/results/${regattaId}`,
      schedule: `${baseUrl}/p/schedule/${regattaId}`,
      notices: `${baseUrl}/p/notices/${regattaId}`,
      entries: `${baseUrl}/p/entries/${regattaId}`,
    },
  };
}

async function fetchResults(regattaId: string, division?: string, raceNumber?: number) {
  // Check if results are published
  const { data: regatta } = await supabase
    .from('regattas')
    .select('results_published, results_published_at, status')
    .eq('id', regattaId)
    .single();

  if (!regatta?.results_published && regatta?.status !== 'completed') {
    return null;
  }

  // Fetch race results
  let resultsQuery = supabase
    .from('race_results')
    .select(`
      id, race_number, position, sail_number, elapsed_time,
      corrected_time, points, status, division,
      race_entries (boat_name, skipper_name)
    `)
    .eq('regatta_id', regattaId)
    .order('race_number', { ascending: true })
    .order('position', { ascending: true });

  if (division) resultsQuery = resultsQuery.eq('division', division);
  if (raceNumber) resultsQuery = resultsQuery.eq('race_number', raceNumber);

  const { data: results } = await resultsQuery;

  // Fetch standings
  const { data: standings } = await supabase
    .from('series_standings')
    .select(`
      position, sail_number, boat_name, skipper_name, division,
      total_points, net_points, races_sailed, discards, race_points
    `)
    .eq('regatta_id', regattaId)
    .order('position', { ascending: true });

  // Group results by race
  const raceMap = new Map<number, PublicRaceResult>();
  (results || []).forEach((result: any) => {
    if (!raceMap.has(result.race_number)) {
      raceMap.set(result.race_number, {
        race_number: result.race_number,
        race_date: null,
        division: result.division,
        results: [],
      });
    }
    raceMap.get(result.race_number)!.results.push({
      position: result.position,
      sail_number: result.sail_number,
      boat_name: result.race_entries?.boat_name || null,
      skipper_name: result.race_entries?.skipper_name || null,
      elapsed_time: result.elapsed_time,
      corrected_time: result.corrected_time,
      points: result.points,
      status: result.status,
    });
  });

  const formattedStandings: PublicStanding[] = (standings || []).map((s: any) => ({
    position: s.position,
    sail_number: s.sail_number,
    boat_name: s.boat_name,
    skipper_name: s.skipper_name,
    division: s.division,
    total_points: s.total_points,
    net_points: s.net_points,
    races_sailed: s.races_sailed,
    discards: s.discards || [],
    race_results: (s.race_points || []).map((points: number, idx: number) => ({
      race: idx + 1,
      points,
      discarded: (s.discards || []).includes(idx + 1),
    })),
  }));

  return {
    races: Array.from(raceMap.values()),
    standings: formattedStandings,
    metadata: {
      total_entries: formattedStandings.length,
      races_completed: raceMap.size,
      results_published: regatta?.results_published || false,
      last_updated: regatta?.results_published_at || new Date().toISOString(),
    },
  };
}

async function fetchSchedule(regattaId: string, dateFilter?: string) {
  // race_events does not model per-race scheduling fields (race_number,
  // division, warning_signal, postponement_reason, new_start_time); selecting
  // them 42703s and empties the whole schedule. Pull only real columns and
  // fill the typed-but-unmodeled fields below.
  let racesQuery = supabase
    .from('race_events')
    .select(`
      id, event_date, start_time,
      course_type, course_description, status
    `)
    .eq('regatta_id', regattaId)
    .order('event_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (dateFilter) racesQuery = racesQuery.eq('event_date', dateFilter);

  const { data: races } = await racesQuery;

  const { data: regatta } = await supabase
    .from('regattas')
    .select('start_date, updated_at')
    .eq('id', regattaId)
    .single();

  // Group races by date
  const dateMap = new Map<string, ScheduleDay>();
  (races || []).forEach((race: any) => {
    const dateKey = race.event_date || regatta?.start_date || '';
    if (!dateMap.has(dateKey)) {
      const date = new Date(dateKey);
      dateMap.set(dateKey, {
        date: dateKey,
        day_name: date.toLocaleDateString('en-US', { weekday: 'long' }),
        races: [],
        weather_forecast: null,
        special_notices: [],
      });
    }
    const day = dateMap.get(dateKey)!;
    day.races.push({
      id: race.id,
      race_number: day.races.length + 1,
      division: null,
      scheduled_start: race.start_time || race.event_date || '',
      warning_signal: null,
      course_type: race.course_type ?? null,
      course_description: race.course_description ?? null,
      status: race.status || 'scheduled',
      postponement_reason: null,
      new_start_time: null,
    });
  });

  const completedCount = (races || []).filter((r: any) => r.status === 'completed').length;

  return {
    days: Array.from(dateMap.values()),
    metadata: {
      total_races: (races || []).length,
      races_completed: completedCount,
      last_updated: regatta?.updated_at || new Date().toISOString(),
    },
  };
}

async function fetchNotices(regattaId: string, priority?: string, limit = 20) {
  let noticesQuery = supabase
    .from('race_notices')
    .select(`
      id, title, content, priority, published_at, expires_at,
      attachments, visibility, users (full_name)
    `)
    .eq('regatta_id', regattaId)
    .eq('visibility', 'public')
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .limit(limit + 1);

  if (priority) noticesQuery = noticesQuery.eq('priority', priority);

  const { data: notices } = await noticesQuery;

  const now = new Date();
  const validNotices = (notices || []).filter((n: any) => {
    if (!n.expires_at) return true;
    return new Date(n.expires_at) > now;
  });

  const hasMore = validNotices.length > limit;
  const returnedNotices = validNotices.slice(0, limit);

  return {
    items: returnedNotices.map((n: any) => ({
      id: n.id,
      title: n.title,
      content: n.content,
      priority: n.priority || 'normal',
      published_at: n.published_at,
      expires_at: n.expires_at,
      attachments: n.attachments || [],
      author: n.users?.full_name || null,
    })),
    metadata: {
      total_count: returnedNotices.length,
      has_more: hasMore,
    },
  };
}

// ============ CSV GENERATION ============

function generateCSV(regatta: PublicRegattaInfo, results: NonNullable<PublicRegattaResponse['results']>): string {
  const lines: string[] = [];

  lines.push(`"${regatta.name} - Results"`);
  lines.push(`"Venue: ${regatta.venue || 'N/A'}"`);
  lines.push(`"Date: ${regatta.start_date}"`);
  lines.push('');

  lines.push('"Series Standings"');
  lines.push('"Pos","Sail #","Boat","Skipper","Net Points","Total Points","Races"');

  results.standings.forEach(s => {
    lines.push(`${s.position},"${s.sail_number}","${s.boat_name || ''}","${s.skipper_name || ''}",${s.net_points},${s.total_points},${s.races_sailed}`);
  });

  lines.push('');

  results.races.forEach(race => {
    lines.push(`"Race ${race.race_number}"`);
    lines.push('"Pos","Sail #","Boat","Status","Points"');
    race.results.forEach(r => {
      lines.push(`${r.position},"${r.sail_number}","${r.boat_name || ''}","${r.status}",${r.points}`);
    });
    lines.push('');
  });

  return lines.join('\n');
}
