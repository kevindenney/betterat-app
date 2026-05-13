/**
 * Public Strategy API
 * Returns race strategy data for public viewing - NO AUTH REQUIRED
 * 
 * GET /api/public/strategies/[token]
 */

import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Public strategy response interface
 */
export interface PublicStrategyInfo {
  id: string;
  share_token: string;
  shared_at: string | null;
  
  // Race event info
  race: {
    id: string;
    name: string;
    event_date: string | null;
    venue: string | null;
    boat_class: string | null;
    race_type: 'fleet' | 'distance' | null;
    total_distance_nm: number | null;
    waypoints: { name: string; latitude: number; longitude: number }[] | null;
  } | null;
  
  // Regatta info (if part of a regatta)
  regatta: {
    id: string;
    name: string;
    venue: string | null;
    start_date: string | null;
  } | null;
  
  // Sailor info (anonymized - just display name or initials)
  sailor: {
    display_name: string;
    boat_class: string | null;
  } | null;
  
  // Weather/conditions at time of strategy creation
  weather: {
    wind_speed: number | null;
    wind_speed_max: number | null;
    wind_direction: string | null;
    temperature: number | null;
    wave_height: number | null;
    tide_state: string | null;
    tide_height: number | null;
    current_speed: number | null;
    current_direction: string | null;
  } | null;
  
  // Rig tuning settings
  rig_tuning: {
    preset: string | null;
    wind_range: string | null;
    notes: string | null;
    settings: Record<string, string> | null;
  } | null;
  
  // Strategy sections
  strategy: {
    rig_tuning: string | null;
    prestart: string | null;
    start: string | null;
    upwind: string | null;
    windward_mark: string | null;
    downwind: string | null;
    leeward_mark: string | null;
    finish: string | null;
  };
  
  // AI-generated insights
  ai_insights: {
    wind_strategy: string | null;
    tide_strategy: string | null;
    current_strategy: string | null;
    start_line_bias: string | null;
    favored_end: string | null;
    upwind_tactics: string | null;
    downwind_tactics: string | null;
    contextual_insights: string[] | null;
  } | null;
  
  // User notes
  user_notes: string | null;
  
  // Metadata
  created_at: string;
  updated_at: string;
}

/**
 * Detect race type based on name patterns, explicit type, or distance
 */
function detectRaceType(
  raceName: string | undefined,
  explicitType: 'fleet' | 'distance' | undefined,
  totalDistanceNm: number | undefined
): 'fleet' | 'distance' {
  // 1. Explicit type takes priority
  if (explicitType) {
    return explicitType;
  }

  // 2. Check distance threshold
  if (totalDistanceNm && totalDistanceNm > 10) {
    return 'distance';
  }

  // 3. Smart name detection for distance races
  if (raceName) {
    const lowerName = raceName.toLowerCase();
    const distanceKeywords = [
      'around',
      'island race',
      'offshore',
      'ocean race',
      'ocean racing',
      'coastal',
      'passage',
      'distance race',
      'long distance',
      'overnight',
      'multi-day',
      'transat',
      'transpac',
      'fastnet',
      'rolex',
      'sydney hobart',
      'bermuda',
      'nm race',
      'mile race',
    ];

    for (const keyword of distanceKeywords) {
      if (lowerName.includes(keyword)) {
        return 'distance';
      }
    }

    // Check for distance patterns like "25nm", "50 mile"
    if (/\d+\s*(nm|nautical|mile)/i.test(raceName)) {
      return 'distance';
    }
  }

  return 'fleet';
}

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

  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing share token' });
  }

  try {
    // Fetch strategy by share token (only if sharing is enabled)
    const { data: preparation, error: prepError } = await supabase
      .from('sailor_race_preparation')
      .select(`
        id,
        share_token,
        share_enabled,
        public_shared_at,
        regatta_id,
        sailor_id,
        rig_notes,
        selected_rig_preset_id,
        race_brief_data,
        rig_tuning_strategy,
        prestart_strategy,
        start_strategy,
        upwind_strategy,
        windward_mark_strategy,
        downwind_strategy,
        leeward_mark_strategy,
        finish_strategy,
        ai_strategy_suggestions,
        created_at,
        updated_at
      `)
      .eq('share_token', token)
      .eq('share_enabled', true)
      .single();

    if (prepError || !preparation) {
      return res.status(404).json({ error: 'Strategy not found or sharing is disabled' });
    }

    // Fetch race event info
    let raceInfo = null;
    let regattaInfo = null;
    
    if (preparation.regatta_id) {
      // Query regattas table directly (sailor_race_preparation now references regattas)
      const { data: regatta } = await supabase
        .from('regattas')
        .select(`
          id,
          name,
          venue,
          start_date,
          end_date,
          boat_class,
          race_type,
          total_distance_nm,
          waypoints
        `)
        .eq('id', preparation.regatta_id)
        .single();

      if (regatta) {
        // Populate both raceInfo and regattaInfo from the same regatta record
        raceInfo = {
          id: regatta.id,
          name: regatta.name,
          event_date: regatta.start_date,
          venue: regatta.venue,
          boat_class: regatta.boat_class,
          race_type: detectRaceType(regatta.name, regatta.race_type, regatta.total_distance_nm),
          total_distance_nm: regatta.total_distance_nm || null,
          waypoints: regatta.waypoints || null,
        };

        regattaInfo = {
          id: regatta.id,
          name: regatta.name,
          venue: regatta.venue,
          start_date: regatta.start_date,
        };
      }
    }

    // Fetch sailor profile info (limited/anonymized)
    let sailorInfo = null;
    if (preparation.sailor_id) {
      const { data: sailorProfile } = await supabase
        .from('sailor_profiles')
        .select('user_id, boat_class')
        .eq('user_id', preparation.sailor_id)
        .single();

      if (sailorProfile) {
        // Get user's display name from auth.users or profiles
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('full_name, display_name')
          .eq('id', preparation.sailor_id)
          .single();

        const displayName = userProfile?.display_name || 
                           userProfile?.full_name || 
                           'Anonymous Sailor';

        sailorInfo = {
          display_name: displayName,
          boat_class: sailorProfile.boat_class,
        };
      }
    }

    // Extract weather info from race_brief_data if available
    let weatherInfo = null;
    const briefData = preparation.race_brief_data;
    if (briefData && typeof briefData === 'object') {
      const weather = (briefData as any).weather || (briefData as any).forecast;
      if (weather) {
        weatherInfo = {
          wind_speed: weather.windSpeed ?? weather.wind_speed ?? null,
          wind_speed_max: weather.windSpeedMax ?? weather.wind_speed_max ?? null,
          wind_direction: weather.windDirection ?? weather.wind_direction ?? null,
          temperature: weather.temperature ?? null,
          wave_height: weather.waveHeight ?? weather.wave_height ?? null,
          tide_state: weather.tideState ?? weather.tide_state ?? null,
          tide_height: weather.tideHeight ?? weather.tide_height ?? null,
          current_speed: weather.currentSpeed ?? weather.current_speed ?? null,
          current_direction: weather.currentDirection ?? weather.current_direction ?? null,
        };
      }
    }

    // Extract rig tuning info
    let rigTuningInfo = null;
    const rigData = (briefData as any)?.rigTuning || (briefData as any)?.rig_tuning;
    if (rigData) {
      rigTuningInfo = {
        preset: rigData.preset ?? null,
        wind_range: rigData.windRange ?? rigData.wind_range ?? null,
        notes: rigData.notes ?? preparation.rig_notes ?? null,
        settings: rigData.settings ?? null,
      };
    } else if (preparation.rig_notes) {
      rigTuningInfo = {
        preset: null,
        wind_range: null,
        notes: preparation.rig_notes,
        settings: null,
      };
    }

    // Extract AI insights
    let aiInsights = null;
    const aiSuggestions = preparation.ai_strategy_suggestions;
    if (aiSuggestions && typeof aiSuggestions === 'object') {
      aiInsights = {
        wind_strategy: (aiSuggestions as any).windStrategy ?? null,
        tide_strategy: (aiSuggestions as any).tideStrategy ?? null,
        current_strategy: (aiSuggestions as any).currentStrategy ?? null,
        start_line_bias: (aiSuggestions as any).startLineBias ?? null,
        favored_end: (aiSuggestions as any).favoredEnd ?? null,
        upwind_tactics: (aiSuggestions as any).upwindTactics ?? null,
        downwind_tactics: (aiSuggestions as any).downwindTactics ?? null,
        contextual_insights: (aiSuggestions as any).contextualInsights ?? null,
      };
    }

    // Fetch user notes from race_strategies table
    let userNotes: string | null = null;
    if (preparation.sailor_id && preparation.regatta_id) {
      const { data: raceStrat } = await supabase
        .from('race_strategies')
        .select('notes, strategy_content')
        .eq('regatta_id', preparation.regatta_id)
        .eq('user_id', preparation.sailor_id)
        .maybeSingle();

      userNotes = raceStrat?.notes || (raceStrat?.strategy_content as any)?.userNotes || null;
    }

    // Build public response
    const response: PublicStrategyInfo = {
      id: preparation.id,
      share_token: preparation.share_token,
      shared_at: preparation.public_shared_at,
      race: raceInfo,
      regatta: regattaInfo,
      sailor: sailorInfo,
      weather: weatherInfo,
      rig_tuning: rigTuningInfo,
      strategy: {
        rig_tuning: preparation.rig_tuning_strategy,
        prestart: preparation.prestart_strategy,
        start: preparation.start_strategy,
        upwind: preparation.upwind_strategy,
        windward_mark: preparation.windward_mark_strategy,
        downwind: preparation.downwind_strategy,
        leeward_mark: preparation.leeward_mark_strategy,
        finish: preparation.finish_strategy,
      },
      ai_insights: aiInsights,
      user_notes: userNotes,
      created_at: preparation.created_at,
      updated_at: preparation.updated_at,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Public strategy API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
