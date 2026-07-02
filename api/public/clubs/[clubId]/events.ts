/**
 * Public Club Events API
 * Returns upcoming events for a club - NO AUTH REQUIRED
 * 
 * GET /api/public/clubs/[clubId]/events
 * 
 * Query params:
 *   - limit: Number of events to return (default: 10)
 *   - type: Filter by event type ('regatta' | 'race_series' | 'training' | 'social')
 *   - upcoming: If 'true', only show future events (default: true)
 */

import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface PublicClubEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_date: string;
  end_date: string | null;
  venue: string | null;
  registration_status: 'not_open' | 'open' | 'closed' | 'full';
  entry_fee: number | null;
  currency: string | null;
  entry_count: number;
  max_entries: number | null;
  classes: string[];
  public_link: string;
}

export interface PublicClubEventsResponse {
  club: {
    id: string;
    name: string;
    logo_url: string | null;
    website: string | null;
  };
  events: PublicClubEvent[];
  metadata: {
    total_count: number;
    has_more: boolean;
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers for public access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { clubId } = req.query;
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
  const eventType = req.query.type as string | undefined;
  const upcomingOnly = req.query.upcoming !== 'false';

  if (!clubId || typeof clubId !== 'string') {
    return res.status(400).json({ error: 'Missing clubId parameter' });
  }

  try {
    // Fetch club info
    const { data: club, error: clubError } = await supabase
      .from('clubs')
      .select('id, club_name, logo_url, website')
      .eq('id', clubId)
      .single();

    if (clubError || !club) {
      return res.status(404).json({ error: 'Club not found' });
    }

    // Fetch events - try club_events first, fall back to regattas
    let eventsQuery = supabase
      .from('club_events')
      .select(`
        id,
        title,
        description,
        event_type,
        start_date,
        end_date,
        location_name,
        registration_opens,
        registration_closes,
        registration_fee,
        currency,
        max_participants,
        boat_classes,
        status,
        visibility
      `)
      .eq('club_id', clubId)
      .eq('visibility', 'public')
      .order('start_date', { ascending: true })
      .limit(limit + 1);

    if (upcomingOnly) {
      eventsQuery = eventsQuery.gte('start_date', new Date().toISOString());
    }

    if (eventType) {
      eventsQuery = eventsQuery.eq('event_type', eventType);
    }

    const { data: events, error: eventsError } = await eventsQuery;

    // Also fetch regattas if they exist
    let regattasQuery = supabase
      .from('regattas')
      .select(`
        id,
        name,
        description,
        start_date,
        end_date,
        venue,
        registration_open,
        registration_close,
        entry_fee,
        currency,
        max_entries,
        boat_classes,
        status
      `)
      .eq('club_id', clubId)
      .order('start_date', { ascending: true })
      .limit(limit + 1);

    if (upcomingOnly) {
      regattasQuery = regattasQuery.gte('start_date', new Date().toISOString());
    }

    const { data: regattas } = await regattasQuery;

    // Build base URL
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.EXPO_PUBLIC_API_URL || 'https://better.at';

    const now = new Date();

    // Map club_events
    const clubEventsList: PublicClubEvent[] = (events || [])
      .filter((e: any) => e.visibility === 'public')
      .map((e: any) => {
        let regStatus: 'not_open' | 'open' | 'closed' | 'full' = 'not_open';
        if (e.registration_opens && e.registration_closes) {
          const openDate = new Date(e.registration_opens);
          const closeDate = new Date(e.registration_closes);
          if (now < openDate) regStatus = 'not_open';
          else if (now > closeDate) regStatus = 'closed';
          else regStatus = 'open';
        }
        
        return {
          id: e.id,
          title: e.title,
          description: e.description,
          event_type: e.event_type,
          start_date: e.start_date,
          end_date: e.end_date,
          venue: e.location_name,
          registration_status: regStatus,
          entry_fee: e.registration_fee,
          currency: e.currency,
          entry_count: 0,
          max_entries: e.max_participants,
          classes: e.boat_classes || [],
          public_link: `${baseUrl}/p/event/${e.id}`,
        };
      });

    // Map regattas  
    const regattaEventsList: PublicClubEvent[] = (regattas || []).map((r: any) => {
      let regStatus: 'not_open' | 'open' | 'closed' | 'full' = 'not_open';
      if (r.registration_open && r.registration_close) {
        const openDate = new Date(r.registration_open);
        const closeDate = new Date(r.registration_close);
        if (now < openDate) regStatus = 'not_open';
        else if (now > closeDate) regStatus = 'closed';
        else regStatus = 'open';
      }
      
      return {
        id: r.id,
        title: r.name,
        description: r.description,
        event_type: 'regatta',
        start_date: r.start_date,
        end_date: r.end_date,
        venue: r.venue,
        registration_status: regStatus,
        entry_fee: r.entry_fee,
        currency: r.currency,
        entry_count: 0,
        max_entries: r.max_entries,
        classes: r.boat_classes || [],
        public_link: `${baseUrl}/p/${r.id}`,
      };
    });

    // Combine and sort
    const allEvents = [...clubEventsList, ...regattaEventsList]
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
      .slice(0, limit + 1);

    const hasMore = allEvents.length > limit;
    const returnedEvents = allEvents.slice(0, limit);

    const response: PublicClubEventsResponse = {
      club: {
        id: club.id,
        name: club.club_name,
        logo_url: club.logo_url,
        website: club.website,
      },
      events: returnedEvents,
      metadata: {
        total_count: returnedEvents.length,
        has_more: hasMore,
      },
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Public club events API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
