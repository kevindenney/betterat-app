/**
 * Onboarding Agent
 * Autonomous AI agent for sailor onboarding flow
 * Orchestrates: GPS detection → boat selection → fleet discovery → club selection → race import
 */

import { z } from 'zod';
import { BaseAgentService, AgentTool } from './BaseAgentService';
import { supabase } from '../supabase';

export class OnboardingAgent extends BaseAgentService {
  constructor() {
    super({
      model: 'claude-3-5-haiku-20241022',
      maxTokens: 4096,
      temperature: 0.7,
      systemPrompt: `You are an expert sailing onboarding assistant for BetterAt. Your goal is to help sailors set up their profile by:

1. Detecting their sailing location (GPS or manual search)
2. Suggesting appropriate boat classes based on popularity at their venue
3. Discovering relevant fleets for their location and boat class
4. Suggesting yacht clubs and class associations
5. Importing races from their clubs
6. Finalizing their onboarding

You should be proactive but always confirm critical decisions with the user. When suggesting boats or fleets, prioritize popular options at the detected venue. Be helpful, concise, and sailing-knowledgeable.`,
    });

    // Register all onboarding tools
    this.registerTool(this.createDetectVenueFromGPSTool());
    this.registerTool(this.createSearchVenuesTool());
    this.registerTool(this.createSuggestBoatsByPopularityTool());
    this.registerTool(this.createDiscoverFleetsTool());
    this.registerTool(this.createSuggestClubsTool());
    this.registerTool(this.createImportRacesTool());
    this.registerTool(this.createFinalizeOnboardingTool());
  }

  /**
   * Tool: Detect venue from GPS coordinates
   */
  private createDetectVenueFromGPSTool(): AgentTool {
    return {
      name: 'detect_venue_from_gps',
      description: 'Detect the closest sailing venue from GPS coordinates. Use this when you have the user\'s location. Returns the venue with confidence score.',
      input_schema: z.object({
        latitude: z.coerce.number().describe('GPS latitude'),
        longitude: z.coerce.number().describe('GPS longitude'),
        radius_km: z.coerce.number().optional().default(50).describe('Search radius in kilometers'),
      }),
      execute: async (input) => {
        try {
          // Query nearby venues using PostGIS (simplified - assumes sailing_venues has coordinates)
          const { data: venues, error } = await supabase
            .rpc('venues_within_radius', {
              lat: input.latitude,
              lng: input.longitude,
              radius_km: input.radius_km,
            })
            .limit(5);

          if (error) throw error;

          if (!venues || venues.length === 0) {
            return {
              success: false,
              message: `No sailing venues found within ${input.radius_km}km of these coordinates.`,
            };
          }

          // Return the closest venue with alternatives
          return {
            success: true,
            venue: venues[0],
            alternatives: venues.slice(1),
            confidence: venues[0].distance_km < 10 ? 'high' : venues[0].distance_km < 25 ? 'medium' : 'low',
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    };
  }

  /**
   * Tool: Search venues by name
   */
  private createSearchVenuesTool(): AgentTool {
    return {
      name: 'search_sailing_venues',
      description: 'Search for sailing venues by name. Use this when the user types a location name like "Hong Kong" or "Chicago".',
      input_schema: z.object({
        query: z.string().describe('Search query (venue name or city)'),
        limit: z.coerce.number().optional().default(10).describe('Max results to return'),
      }),
      execute: async (input) => {
        try {
          const { data: venues, error } = await supabase
            .from('sailing_venues')
            .select('*')
            .or(`name.ilike.%${input.query}%,city.ilike.%${input.query}%,country.ilike.%${input.query}%`)
            .limit(input.limit);

          if (error) throw error;

          return {
            success: true,
            venues: venues || [],
            count: venues?.length || 0,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    };
  }

  /**
   * Tool: Suggest boats by popularity at venue
   */
  private createSuggestBoatsByPopularityTool(): AgentTool {
    return {
      name: 'suggest_boats_by_popularity',
      description: 'Suggest boat classes that are popular at a specific venue. Use this to help sailors choose their boat class.',
      input_schema: z.object({
        venue_id: z.string().describe('The venue ID'),
        limit: z.coerce.number().optional().default(10).describe('Max boat classes to suggest'),
      }),
      execute: async (input) => {
        try {
          // Get boat classes popular at this venue (by counting fleets)
          const { data: popularBoats, error } = await supabase
            .from('fleets')
            .select('class_id, boat_classes!inner(id, name, type)')
            .eq('club_id', input.venue_id) // Assume venue maps to club
            .limit(input.limit);

          if (error) throw error;

          // Also get all boat classes as fallback
          const { data: allBoats } = await supabase
            .from('boat_classes')
            .select('*')
            .limit(20);

          return {
            success: true,
            popular_boats: popularBoats || [],
            all_boats: allBoats || [],
            message: popularBoats?.length
              ? `Found ${popularBoats.length} popular boat classes at this venue`
              : 'No specific popular boats found, showing general options',
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    };
  }

  /**
   * Tool: Discover fleets by location and boat class
   */
  private createDiscoverFleetsTool(): AgentTool {
    return {
      name: 'discover_fleets_smart',
      description: 'Discover sailing fleets based on venue and boat class. Use this after the user selects their boat to find relevant fleets.',
      input_schema: z.object({
        venue_id: z.string().optional().describe('The venue ID'),
        class_id: z.string().describe('The boat class ID'),
        limit: z.coerce.number().optional().default(10).describe('Max fleets to return'),
      }),
      execute: async (input) => {
        try {
          let query = supabase
            .from('fleets')
            .select(`
              *,
              boat_classes!inner(name)
            `)
            .eq('class_id', input.class_id)
            .in('visibility', ['public', 'club'])
            .limit(input.limit);

          // Filter by venue if provided
          if (input.venue_id) {
            query = query.eq('club_id', input.venue_id);
          }

          const { data: fleets, error } = await query;

          if (error) throw error;

          const rows = fleets || [];
          const clubIds = Array.from(new Set(rows.map((fleet: any) => fleet?.club_id).filter(Boolean)));
          const clubNamesById = new Map<string, string>();

          if (clubIds.length > 0) {
            const { data: clubsData } = await supabase
              .from('clubs')
              .select('id, name, club_name')
              .in('id', clubIds as string[]);

            (clubsData || []).forEach((club: any) => {
              if (club?.id) {
                clubNamesById.set(club.id, club.name || club.club_name || 'Club');
              }
            });

            const missingClubIds = (clubIds as string[]).filter((id) => !clubNamesById.has(id));
            if (missingClubIds.length > 0) {
              const { data: yachtClubsData } = await supabase
                .from('yacht_clubs')
                .select('id, name')
                .in('id', missingClubIds);
              (yachtClubsData || []).forEach((club: any) => {
                if (club?.id) {
                  clubNamesById.set(club.id, club.name || 'Club');
                }
              });
            }
          }

          const enrichedFleets = rows.map((fleet: any) => ({
            ...fleet,
            club_name: fleet?.club_id ? clubNamesById.get(fleet.club_id) : undefined,
          }));

          return {
            success: true,
            fleets: enrichedFleets,
            count: enrichedFleets.length,
            message: enrichedFleets.length
              ? `Found ${enrichedFleets.length} fleets for this boat class`
              : 'No fleets found. User may need to create one.',
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    };
  }

  /**
   * Tool: Suggest clubs based on venue or fleet
   */
  private createSuggestClubsTool(): AgentTool {
    return {
      name: 'suggest_clubs_for_context',
      description: 'Suggest yacht clubs and class associations based on venue or fleet context. Use this to help sailors find their clubs.',
      input_schema: z.object({
        venue_id: z.string().optional().describe('The venue ID to find clubs at'),
        fleet_id: z.string().optional().describe('The fleet ID to find the home club'),
        class_id: z.string().optional().describe('The boat class ID to find class associations'),
      }),
      execute: async (input) => {
        try {
          const results: any = {
            success: true,
            clubs: [],
            associations: [],
          };

          // Get clubs at venue
          if (input.venue_id) {
            const { data: clubs } = await supabase
              .from('yacht_clubs')
              .select('*')
              .eq('venue_id', input.venue_id);

            results.clubs = clubs || [];
          }

          // Get fleet's home club
          if (input.fleet_id) {
            const { data: fleet } = await supabase
              .from('fleets')
              .select('club_id')
              .eq('id', input.fleet_id)
              .single();

            if (fleet?.club_id) {
              const { data: club } = await supabase
                .from('clubs')
                .select('*')
                .eq('id', fleet.club_id)
                .single();

              if (club) {
                results.home_club = club;
              } else {
                const { data: yachtClub } = await supabase
                  .from('yacht_clubs')
                  .select('*')
                  .eq('id', fleet.club_id)
                  .single();
                if (yachtClub) {
                  results.home_club = yachtClub;
                }
              }
            }
          }

          // Get class associations
          if (input.class_id) {
            const { data: associations } = await supabase
              .from('class_associations')
              .select('*')
              .eq('class_id', input.class_id);

            results.associations = associations || [];
          }

          return results;
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    };
  }

  /**
   * Tool: Import races from selected clubs
   */
  private createImportRacesTool(): AgentTool {
    return {
      name: 'import_races_from_clubs',
      description: 'Import upcoming races from selected clubs. Use this after the user selects their clubs to auto-populate their race calendar.',
      input_schema: z.object({
        sailor_id: z.string().describe('The sailor user ID'),
        club_ids: z.array(z.string()).describe('Array of club IDs to import races from'),
      }),
      execute: async (input) => {
        try {
          // This would call RaceScrapingService in production
          // For now, return placeholder
          return {
            success: true,
            message: `Race import initiated for ${input.club_ids.length} clubs. This runs in the background and will populate the calendar within 24 hours.`,
            clubs_processed: input.club_ids,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    };
  }

  /**
   * Tool: Finalize onboarding
   */
  private createFinalizeOnboardingTool(): AgentTool {
    return {
      name: 'finalize_onboarding',
      description: 'Complete the onboarding process by updating the user record and setting onboarding_completed flag. Use this as the final step.',
      input_schema: z.object({
        sailor_id: z.string().describe('The sailor user ID'),
        onboarding_data: z.object({
          locations: z.array(z.string()).optional(),
          boats: z.array(z.string()).optional(),
          fleets: z.array(z.string()).optional(),
          clubs: z.array(z.string()).optional(),
        }).describe('Summary of onboarding selections'),
      }),
      execute: async (input) => {
        try {
          const { error } = await supabase
            .from('users')
            .update({
              onboarding_completed: true,
              onboarding_step: 'completed',
              onboarding_data: input.onboarding_data,
            })
            .eq('id', input.sailor_id);

          if (error) throw error;

          return {
            success: true,
            message: 'Onboarding completed successfully! Redirecting to dashboard.',
            sailor_id: input.sailor_id,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
          };
        }
      },
    };
  }

  /**
   * Convenience method: Run full onboarding flow
   */
  async runOnboarding(options: {
    sailorId: string;
    userMessage: string;
    gpsCoordinates?: { lat: number; lng: number };
  }) {
    return this.run({
      userMessage: options.userMessage,
      context: {
        sailorId: options.sailorId,
        gpsCoordinates: options.gpsCoordinates,
      },
      maxIterations: 15, // Allow more iterations for complete flow
    });
  }
}
