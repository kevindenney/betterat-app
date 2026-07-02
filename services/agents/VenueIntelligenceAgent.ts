// @ts-nocheck

/**
 * Venue Intelligence Agent
 * Autonomous AI agent for venue detection, intelligence loading, and cultural adaptation
 * Core of BetterAt's "OnX Maps for Sailing" global intelligence system
 */

import { supabase } from '@/services/supabase';
import { RegionalIntelligenceService } from '@/services/venue/RegionalIntelligenceService';
import { venueIntelligenceService, type VenueInsights } from '@/services/VenueIntelligenceService';
import { z } from 'zod';
import { AgentTool, BaseAgentService } from './BaseAgentService';

export class VenueIntelligenceAgent extends BaseAgentService {
  private regionalIntelligenceService: RegionalIntelligenceService;

  constructor() {
    // Check if venue-intelligence skill should be used
    const useSkills = process.env.USE_CLAUDE_SKILLS === 'true';

    super({
      model: 'claude-3-5-haiku-20241022',
      maxTokens: 2048, // Optimized for cost
      temperature: 0.3, // Lower temperature for more consistent venue detection
      systemPrompt: useSkills
        ? `You are a venue intelligence specialist for BetterAt, a global sailing platform.
Your mission: Help sailors seamlessly switch between sailing venues worldwide.

You have access to the venue-intelligence skill which provides:
- 1000+ sailing venues with coordinates and details
- Regional weather API mapping (HKO, NOAA, Met Office, etc.)
- Cultural protocols and language information
- Tactical racing knowledge by venue type
- Logistical and safety information

Use the venue-intelligence skill to inform your recommendations.
Execute venue tools in optimal order. Prioritize sailor safety - ensure weather data is current and accurate.`
        : `You are a venue intelligence specialist for BetterAt, a global sailing platform.

Your mission: Help sailors seamlessly switch between sailing venues worldwide, loading the right intelligence, weather, and cultural context for each location.

When a sailor provides GPS coordinates or selects a venue:
1. Detect which sailing venue they're at (or confirm manual selection)
2. Load comprehensive regional intelligence (tactical knowledge, weather patterns, local customs)
3. Fetch weather from the appropriate regional provider (HKO for Hong Kong, NOAA for US, etc.)
4. Apply cultural settings (language, currency, protocols)
5. Cache essential data for offline racing
6. Update the app context to reflect the new venue

You have access to tools for each step. Execute them in the optimal order based on the situation.
If venue detection has low confidence, suggest alternatives to the user.
Always prioritize sailor safety - ensure weather data is current and accurate.`,
    });

    this.regionalIntelligenceService = new RegionalIntelligenceService();

    // Register custom tools
    this.registerTool(this.createDetectVenueTool());
    this.registerTool(this.createLoadIntelligenceTool());
    this.registerTool(this.createFetchWeatherTool());
    this.registerTool(this.createApplyCulturalSettingsTool());
    this.registerTool(this.createCacheOfflineDataTool());
  }

  /**
   * Tool: Detect venue from GPS coordinates
   */
  private createDetectVenueTool(): AgentTool {
    return {
      name: 'detect_venue_from_gps',
      description: `Detect which sailing venue the sailor is at based on GPS coordinates.
Use this when the sailor provides a location or when the app detects GPS coordinates.
Returns the matched venue with confidence score and alternative venues if confidence is low.
Only call this if you don't already have a confirmed venue ID.`,
      input_schema: z.object({
        latitude: z.number().describe('GPS latitude in decimal degrees'),
        longitude: z.number().describe('GPS longitude in decimal degrees'),
        // Accept string or number and coerce to number to avoid Zod invalid_type
        radiusKm: z.preprocess((v) => {
          if (typeof v === 'string') return parseFloat(v);
          return v;
        }, z.number().optional().default(50)).describe('Search radius in kilometers (default: 50)'),
      }),
      execute: async (input) => {

        try {
          // Query venues within radius using PostGIS; fallback to bounding box if RPC missing
          let { data: venues, error } = await supabase.rpc('venues_within_radius', {
            lat: input.latitude,
            lng: input.longitude,
            radius_km: input.radiusKm,
          });

          if (error && (error as any)?.code?.startsWith?.('PGRST2')) {
            const lat = input.latitude;
            const lng = input.longitude;
            const radiusKm = input.radiusKm ?? 50;
            const latDelta = radiusKm / 111;
            const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
            const fallback = await supabase.rpc('venues_within_bbox', {
              min_lon: lng - lngDelta,
              min_lat: lat - latDelta,
              max_lon: lng + lngDelta,
              max_lat: lat + latDelta,
            });
            venues = fallback.data as any[] | null;
            error = fallback.error as any;
          }

          if (error) throw error;

          if (!venues || venues.length === 0) {
            return {
              success: false,
              message: `No sailing venues found within ${input.radiusKm}km of coordinates ${input.latitude}, ${input.longitude}`,
              alternatives: [],
            };
          }

          // Calculate confidence based on distance
          const closest = venues[0];
          const distanceKm = closest.distance_km;

          // Confidence formula: 100% at 0km, 50% at 25km, 10% at 50km
          const confidence = Math.max(0.1, Math.min(1.0, 1 - (distanceKm / 50)));

          return {
            success: true,
            venueId: closest.id,
            venueName: closest.name,
            distance: distanceKm,
            confidence,
            coordinates: {
              lat: closest.coordinates.coordinates[1],
              lng: closest.coordinates.coordinates[0],
            },
            alternatives: venues.slice(1, 4).map((v: any) => ({
              venueId: v.id,
              name: v.name,
              distance: v.distance_km,
            })),
          };
        } catch (error: any) {

          return {
            success: false,
            error: `Failed to detect venue: ${error.message}`,
          };
        }
      },
    };
  }

  /**
   * Tool: Load regional intelligence for venue
   */
  private createLoadIntelligenceTool(): AgentTool {
    return {
      name: 'load_regional_intelligence',
      description: `Load comprehensive regional intelligence for a sailing venue.
This includes tactical knowledge, local weather patterns, cultural protocols, and logistical information.
Call this after you've confirmed the venue (either from detection or manual selection).
Returns complete intelligence data that informs all other tools.`,
      input_schema: z.object({
        venueId: z.string().describe('The unique ID of the sailing venue'),
      }),
      execute: async (input) => {

        try {
          // Get venue from database
          const { data: venue, error: venueError } = await supabase
            .from('sailing_venues')
            .select('*')
            .eq('id', input.venueId)
            .single();

          if (venueError) throw venueError;
          if (!venue) throw new Error(`Venue not found: ${input.venueId}`);

          // Load comprehensive intelligence via service
          const intelligence = await this.regionalIntelligenceService.loadVenueIntelligence(venue);

          // Return summary (full data is cached in service)
          return {
            success: true,
            venueId: venue.id,
            venueName: venue.name,
            region: venue.region,
            intelligenceLoaded: {
              weather: !!intelligence.weatherIntelligence,
              tactical: !!intelligence.tacticalIntelligence,
              cultural: !!intelligence.culturalIntelligence,
              logistical: !!intelligence.logisticalIntelligence,
            },
            summary: {
              primaryLanguage: intelligence.culturalIntelligence.briefing.languageInfo.primaryLanguage,
              currency: intelligence.culturalIntelligence.briefing.economicInfo.currency,
              weatherProvider: intelligence.weatherIntelligence.currentConditions ? 'active' : 'pending',
              tacticalInsights: intelligence.tacticalIntelligence.localTactics.length,
              culturalProtocols: intelligence.culturalIntelligence.protocolReminders.length,
            },
          };
        } catch (error: any) {

          return {
            success: false,
            error: `Failed to load intelligence: ${error.message}`,
          };
        }
      },
    };
  }

  /**
   * Tool: Fetch regional weather data
   */
  private createFetchWeatherTool(): AgentTool {
    return {
      name: 'fetch_regional_weather',
      description: `Fetch current weather conditions and forecast from the appropriate regional weather provider.
Uses Hong Kong Observatory (HKO) for Hong Kong, NOAA for US, etc.
Call this after loading venue intelligence to get the region information.
Critical for race safety and strategy planning.`,
      input_schema: z.object({
        venueId: z.string().describe('The venue ID'),
        coordinates: z.object({
          lat: z.number(),
          lng: z.number(),
        }).describe('Venue coordinates'),
        region: z.enum(['north-america', 'europe', 'asia-pacific', 'other']).describe('Geographic region'),
      }),
      execute: async (input) => {

        try {
          // Get weather intelligence from service
          const weatherIntelligence = await this.regionalIntelligenceService.getWeatherIntelligence(input.venueId);

          if (!weatherIntelligence) {
            throw new Error('Weather intelligence not loaded. Call load_regional_intelligence first.');
          }

          return {
            success: true,
            venueId: input.venueId,
            currentConditions: {
              windSpeed: weatherIntelligence.currentConditions.windSpeed,
              windDirection: weatherIntelligence.currentConditions.windDirection,
              temperature: weatherIntelligence.currentConditions.temperature,
              gusts: weatherIntelligence.currentConditions.gusts,
            },
            forecast: weatherIntelligence.forecast.slice(0, 24).map(f => ({
              time: f.time,
              windSpeed: f.windSpeed,
              windDirection: f.windDirection,
              racingConditions: f.racingConditions,
            })),
            localPatterns: weatherIntelligence.localPatterns.map(p => p.name),
            racingRecommendations: weatherIntelligence.racingRecommendations,
          };
        } catch (error: any) {

          return {
            success: false,
            error: `Failed to fetch weather: ${error.message}`,
          };
        }
      },
    };
  }

  /**
   * Tool: Apply cultural settings
   */
  private createApplyCulturalSettingsTool(): AgentTool {
    return {
      name: 'apply_cultural_settings',
      description: `Apply cultural settings to the app UI based on venue location.
Updates language, currency, terminology, and protocol reminders.
Call this after loading intelligence to adapt the app to the local context.
Makes BetterAt feel native to sailors everywhere.`,
      input_schema: z.object({
        venueId: z.string().describe('The venue ID'),
        language: z.string().describe('Primary language code (e.g., "en", "zh", "fr")'),
        currency: z.string().describe('Local currency code (e.g., "USD", "HKD", "EUR")'),
        protocolReminders: z.array(z.string()).describe('Important cultural protocols to display'),
      }),
      execute: async (input) => {

        try {
          // In a real implementation, this would update app state/context
          // For now, return confirmation
          return {
            success: true,
            applied: {
              language: input.language,
              currency: input.currency,
              protocolReminders: input.protocolReminders,
            },
            message: `App UI adapted for ${input.venueId}. Language: ${input.language}, Currency: ${input.currency}`,
          };
        } catch (error: any) {

          return {
            success: false,
            error: `Failed to apply cultural settings: ${error.message}`,
          };
        }
      },
    };
  }

  /**
   * Tool: Cache offline data
   */
  private createCacheOfflineDataTool(): AgentTool {
    return {
      name: 'cache_offline_data',
      description: `Cache essential venue data for offline use during racing.
Includes course marks, tide tables, safety information, and basic intelligence.
Call this as the final step after all intelligence is loaded.
Critical for sailors who lose connectivity on the water.`,
      input_schema: z.object({
        venueId: z.string().describe('The venue ID'),
        dataToCacheKeys: z.array(z.string()).describe('Keys of data to cache (e.g., "weather", "tactical", "cultural")'),
      }),
      execute: async (input) => {

        try {
          // In a real implementation, this would use AsyncStorage or similar
          // For now, return confirmation
          return {
            success: true,
            cached: {
              venueId: input.venueId,
              dataKeys: input.dataToCacheKeys,
              timestamp: new Date().toISOString(),
            },
            message: `Offline data cached for ${input.venueId}. Data will be available without internet.`,
          };
        } catch (error: any) {

          return {
            success: false,
            error: `Failed to cache offline data: ${error.message}`,
          };
        }
      },
    };
  }

  /**
   * High-level method: Switch venue by GPS
   */
  async switchVenueByGPS(coordinates: { latitude: number; longitude: number }) {
    return this.run({
      userMessage: `I'm at GPS coordinates ${coordinates.latitude}, ${coordinates.longitude}. Detect the venue and load all intelligence for racing here.`,
      context: coordinates,
      maxIterations: 8, // Allow up to 8 steps for full venue switch
    });
  }

  /**
   * High-level method: Switch venue by manual selection
   */
  async switchVenueBySelection(venueId: string) {
    return this.run({
      userMessage: `I've selected venue ${venueId}. Load all intelligence, weather, and cultural settings for this venue.`,
      context: { venueId },
      maxIterations: 6, // Fewer iterations since we already know the venue
    });
  }

  /**
   * High-level method: Refresh venue weather
   */
  async refreshVenueWeather(venueId: string) {
    return this.run({
      userMessage: `Refresh the weather forecast for venue ${venueId}. I need updated conditions for today's race.`,
      context: { venueId },
      maxIterations: 3, // Quick operation
    });
  }

  /**
   * Check if cached insights exist for a venue (for current user)
   */
  async getCachedInsights(venueId: string, userId: string): Promise<{
    insights: VenueInsights;
    generatedAt: string;
    expiresAt: string;
    tokensUsed: number;
    toolsUsed: string[];
  } | null> {
    try {
      const { data, error } = await supabase
        .from('venue_intelligence_cache')
        .select('*')
        .eq('venue_id', venueId)
        .eq('user_id', userId)
        .eq('agent_type', 'venue_intelligence')
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return null;

      return {
        insights: data.insights as VenueInsights,
        generatedAt: data.generated_at,
        expiresAt: data.expires_at,
        tokensUsed: data.tokens_used || 0,
        toolsUsed: data.tools_used || [],
      };
    } catch (error: any) {

      return null;
    }
  }

  /**
   * Cache venue insights for a user with performance tracking
   */
  async cacheInsights(
    venueId: string,
    userId: string,
    insights: VenueInsights,
    metadata: {
      tokensUsed?: number;
      toolsUsed?: string[];
      generationTimeMs?: number;
    } = {}
  ) {
    try {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

      await supabase.from('venue_intelligence_cache').upsert({
        venue_id: venueId,
        user_id: userId,
        agent_type: 'venue_intelligence',
        insights,
        expires_at: expiresAt,
        tokens_used: metadata.tokensUsed || null,
        tools_used: metadata.toolsUsed || null,
        generation_time_ms: metadata.generationTimeMs || null,
      });

    } catch (error: any) {

    }
  }

  /**
   * Invalidate cache for a venue (force refresh)
   */
  async invalidateCache(venueId: string, userId: string) {
    try {
      await supabase
        .from('venue_intelligence_cache')
        .delete()
        .eq('venue_id', venueId)
        .eq('user_id', userId)
        .eq('agent_type', 'venue_intelligence');

    } catch (error: any) {

    }
  }

  /**
   * High-level method: Analyze venue and provide AI insights
   * Returns safety recommendations, racing tips, cultural notes, practice areas
   * Checks cache first to avoid redundant AI calls
   */
  async analyzeVenue(venueId: string, userId?: string, forceRefresh: boolean = false) {
    try {
      // Check cache first (if userId provided and not forcing refresh)
      if (userId && !forceRefresh) {
        const cached = await this.getCachedInsights(venueId, userId);
        if (cached) {
          const ageHours = Math.floor(
            (Date.now() - new Date(cached.generatedAt).getTime()) / (1000 * 60 * 60)
          );
          return {
            success: true,
            insights: cached.insights,
            fromCache: true,
            cacheAge: `${ageHours}h ago`,
            tokensUsed: cached.tokensUsed,
            toolsUsed: cached.toolsUsed,
          };
        }
      }

      // Track performance for fresh generation
      const startTime = Date.now();

      // Load complete venue data
      const { data: venueBase, error: venueError } = await supabase
        .from('sailing_venues')
        .select(`
          *,
          venue_conditions(*),
          cultural_profiles(*),
          weather_sources(*)
        `)
        .eq('id', venueId)
        .single();

      if (venueError) throw venueError;
      if (!venueBase) throw new Error(`Venue not found: ${venueId}`);

      const { data: venueClubs, error: clubsError } = await supabase
        .from('yacht_clubs')
        .select('*')
        .eq('venue_id', venueId);
      if (clubsError) throw clubsError;

      const venue = {
        ...venueBase,
        yacht_clubs: venueClubs || [],
      };

      // Get regional intelligence
      const intelligence = await this.regionalIntelligenceService.loadVenueIntelligence(venue);

      // Build comprehensive context for AI analysis
      const venueContext = {
        venueName: venue.name,
        country: venue.country,
        region: venue.region,
        venueType: venue.venue_type,
        conditions: venue.venue_conditions?.[0] || {},
        cultural: venue.cultural_profiles?.[0] || {},
        weather: venue.weather_sources?.[0] || {},
        clubs: venue.yacht_clubs || [],
        intelligence: {
          tactical: intelligence.tacticalIntelligence,
          weather: intelligence.weatherIntelligence,
          cultural: intelligence.culturalIntelligence,
          logistical: intelligence.logisticalIntelligence,
        },
      };

      // Run AI analysis
      const result = await this.run({
        userMessage: `Analyze this sailing venue and provide comprehensive insights for a sailor preparing to race here.

Venue: ${venue.name}, ${venue.country}
Region: ${venue.region}
Type: ${venue.venue_type}

Based on the venue data provided in context, please provide:

1. **Safety Recommendations**: Key safety concerns, hazards, weather patterns to watch
2. **Racing Tips**: Tactical advice, local racing strategies, wind patterns
3. **Cultural Notes**: Important local customs, language tips, etiquette
4. **Practice Areas**: Recommended areas for practicing, getting familiar with conditions
5. **Optimal Conditions**: Best times to race, seasonal considerations

Structure your response as actionable recommendations for a sailor new to this venue.`,
        context: venueContext,
        maxIterations: 5,
      });

      if (!result.success) {
        throw new Error(result.error || 'AI analysis failed');
      }

      // Parse AI response into structured insights
      const insights: VenueInsights = {
        venueId,
        venueName: venue.name,
        analysis: String(result.result || ''),
        generatedAt: new Date().toISOString(),
        intelligence: venueContext.intelligence,
        recommendations: {
          safety: this.extractSection(String(result.result || ''), 'Safety'),
          racing: this.extractSection(String(result.result || ''), 'Racing'),
          cultural: this.extractSection(String(result.result || ''), 'Cultural'),
          practice: this.extractSection(String(result.result || ''), 'Practice'),
          timing: this.extractSection(String(result.result || ''), 'Optimal'),
        },
      };

      // Save insights to database
      const saveResult = await venueIntelligenceService.saveVenueInsights(insights);
      if (!saveResult.success) {

      } else {

      }

      // Cache insights for user (if userId provided)
      const generationTime = Date.now() - startTime;
      if (userId) {
        await this.cacheInsights(
          venueId,
          userId,
          insights,
          {
            tokensUsed: result.tokensUsed,
            toolsUsed: result.toolsUsed,
            generationTimeMs: generationTime,
          }
        );
      }

      return {
        success: true,
        insights,
        fromCache: false,
        generationTimeMs: generationTime,
        tokensUsed: result.tokensUsed,
        toolsUsed: result.toolsUsed,
      };
    } catch (error: any) {

      return {
        success: false,
        error: error.message || 'Failed to analyze venue',
      };
    }
  }

  /**
   * Helper: Extract a section from AI response
   */
  private extractSection(response: string, sectionKeyword: string): string {
    const lines = response.split('\n');
    const sectionLines: string[] = [];
    let inSection = false;

    for (const line of lines) {
      if (line.includes(sectionKeyword) && (line.includes('**') || line.includes('#'))) {
        inSection = true;
        continue;
      }

      if (inSection) {
        if (line.startsWith('**') || line.startsWith('#')) {
          // Hit next section
          break;
        }
        if (line.trim()) {
          sectionLines.push(line.trim());
        }
      }
    }

    return sectionLines.join('\n') || 'No specific recommendations available.';
  }
}

export default VenueIntelligenceAgent;
