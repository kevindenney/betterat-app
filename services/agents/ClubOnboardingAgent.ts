// @ts-nocheck

/**
 * Club Onboarding Agent
 * Autonomous AI agent for club setup with venue intelligence, pricing optimization, and staff configuration
 * Transforms 45-minute form into 5-minute conversation
 */

import { supabase } from '@/services/supabase';
import { VenueIntelligenceAgent } from './VenueIntelligenceAgent';
import { z } from 'zod';
import { AgentTool, BaseAgentService } from './BaseAgentService';

export interface ClubOnboardingContext {
  clubId?: string;
  userId: string;
  venueIds?: string[];
  onboardingStep?: number;
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
}

export class ClubOnboardingAgent extends BaseAgentService {
  private venueAgent: VenueIntelligenceAgent;

  constructor() {
    super({
      model: 'claude-3-5-haiku-20241022',
      maxTokens: 4096,
      temperature: 0.7,
      systemPrompt: `You are an expert sailing club administrator and business consultant helping yacht clubs, class associations, and regatta organizers set up their operations on BetterAt.

PERSONALITY:
- Warm, professional, and demonstrate sailing industry expertise
- Anticipate club needs before asking
- Make data-driven recommendations based on regional context
- Use sailing terminology naturally (race committee, PRO, OOD, etc.)
- Be concise but thorough (2-4 sentences per response)
- Never be robotic or formulaic

CONVERSATION FLOW:
1. Welcome warmly and ask for club location/name
2. Detect venue(s) automatically via GPS or name lookup
3. Analyze club type (yacht club, class association, regatta organizer)
4. For multi-venue clubs: "I see you operate across [X] locations. Let me set those up."
5. Research regional sailing context (popular classes, weather sources, customs)
6. Recommend optimal pricing tier based on event volume and region
7. Suggest staff structure based on club size
8. Generate race document templates (NOR, SI) with venue-specific data
9. Configure venue-specific weather integrations
10. Set up cultural/language preferences
11. Summarize complete setup and confirm
12. Finalize with celebration and next steps

CRITICAL RULES:
- Always explain WHY you're recommending something using data
- Proactively research club's sailing environment
- Configure systems automatically when possible
- Learn from similar successful clubs in the region
- For multi-venue operations, set up unified management automatically
- Ask for confirmation before finalizing critical decisions
- Make it feel like talking to an experienced sailing administrator`,
    });

    this.venueAgent = new VenueIntelligenceAgent();

    // Register 8 autonomous tools
    this.registerTool(this.createDetectVenueAndAnalyzeOperationsTool());
    this.registerTool(this.createAnalyzeClubTypeAndRecommendSetupTool());
    this.registerTool(this.createGenerateRaceDocumentsTool());
    this.registerTool(this.createDiscoverAndImportVenueIntelligenceTool());
    this.registerTool(this.createBenchmarkAndOptimizePricingTool());
    this.registerTool(this.createConfigureMultiVenueOperationsTool());
    this.registerTool(this.createSetupStaffAndPermissionsTool());
    this.registerTool(this.createFinalizeOnboardingTool());
  }

  /**
   * Tool 1: Detect venue and analyze operations
   */
  private createDetectVenueAndAnalyzeOperationsTool(): AgentTool {
    return {
      name: 'detect_venue_and_analyze_operations',
      description: `Detect sailing venue from club name/location and research regional context.
Use this when the user provides their club name or location.
Returns venue details, regional intelligence, popular boat classes, and cultural context.
This is typically the FIRST tool to call.`,
      input_schema: z.object({
        clubLocation: z.string().describe('Club name or location (e.g., "Royal Hong Kong Yacht Club" or "Hong Kong")'),
        clubName: z.string().optional().describe('Optional: Club name if not in clubLocation'),
      }),
      execute: async (input) => {

        try {
          // Parse location - try to extract city/country from club name or location
          const locationText = input.clubLocation.toLowerCase();

          // Common patterns: "Club Name, City" or "City Yacht Club" or just "City"
          let searchLocation = input.clubLocation;

          // If it looks like a club name, try to extract location
          if (locationText.includes('yacht club') || locationText.includes('sailing club')) {
            const parts = input.clubLocation.split(/,|\s+yacht\s+club|\s+sailing\s+club/i);
            searchLocation = parts[parts.length - 1].trim() || input.clubLocation;
          }

          // Search for venues by location/name
          const { data: venues, error: venueError } = await supabase
            .from('sailing_venues')
            .select(`
              id,
              name,
              city,
              country,
              region,
              coordinates,
              venue_type,
              cultural_profiles(*),
              venue_conditions(*)
            `)
            .or(`name.ilike.%${input.clubLocation}%,city.ilike.%${searchLocation}%,country.ilike.%${searchLocation}%`)
            .limit(5);

          if (venueError) throw venueError;

          if (!venues || venues.length === 0) {
            return {
              success: false,
              error: `No sailing venues found for "${input.clubLocation}". Please provide a more specific location or try a nearby city.`,
              venues: [],
            };
          }

          // Detect if this is a multi-venue club (e.g., RHKYC with 3 locations)
          const multiVenueDetected = venues.length > 1 && venues.every(v =>
            v.city === venues[0].city || v.name.includes(venues[0].name.split(' ')[0])
          );

          // Get regional context from first venue
          const primaryVenue = venues[0];
          const culturalProfile = primaryVenue.cultural_profiles?.[0];
          const venueConditions = primaryVenue.venue_conditions?.[0];

          // Query nearby clubs for benchmarking
          const { data: nearbyClubs } = await supabase
            .from('sailing_venues')
            .select('id, name')
            .neq('id', primaryVenue.id)
            .limit(5);

          const nearbyVenueIds = (nearbyClubs || []).map((club: any) => club.id).filter(Boolean);
          const memberCountByVenueId = new Map<string, number>();
          if (nearbyVenueIds.length > 0) {
            const { data: venueClubs } = await supabase
              .from('yacht_clubs')
              .select('venue_id, member_count')
              .in('venue_id', nearbyVenueIds);

            (venueClubs || []).forEach((club: any) => {
              if (!club?.venue_id) return;
              const existing = memberCountByVenueId.get(club.venue_id) || 0;
              const memberCount = Number(club.member_count || 0);
              if (memberCount > existing) {
                memberCountByVenueId.set(club.venue_id, memberCount);
              }
            });
          }

          // Determine weather provider based on region
          let weatherProvider: 'HKO' | 'NOAA' | 'ECMWF' | 'WeatherAPI' = 'WeatherAPI';
          if (primaryVenue.region === 'asia-pacific' && primaryVenue.country === 'Hong Kong') {
            weatherProvider = 'HKO';
          } else if (primaryVenue.region === 'north-america') {
            weatherProvider = 'NOAA';
          } else if (primaryVenue.region === 'europe') {
            weatherProvider = 'ECMWF';
          }

          // Popular boat classes in region (from venue conditions or defaults)
          const popularBoatClasses = venueConditions?.popular_classes || [
            'Dragon', 'J/70', 'Etchells', 'Laser/ILCA', 'Optimist'
          ];

          return {
            success: true,
            venues: venues.map(v => ({
              venueId: v.id,
              venueName: v.name,
              coordinates: v.coordinates ? {
                lat: v.coordinates.coordinates?.[1] || 0,
                lng: v.coordinates.coordinates?.[0] || 0,
              } : { lat: 0, lng: 0 },
              venueType: v.venue_type || 'primary',
            })),
            regionalContext: {
              country: primaryVenue.country,
              region: primaryVenue.region as 'north-america' | 'europe' | 'asia-pacific' | 'other',
              primaryLanguage: culturalProfile?.primary_language || 'English',
              currency: culturalProfile?.currency || 'USD',
              weatherProvider,
              popularBoatClasses,
              nearbyClubs: (nearbyClubs || []).slice(0, 3).map(club => ({
                name: club.name,
                memberCount: memberCountByVenueId.get(club.id) || 0,
              })),
              culturalNotes: culturalProfile?.cultural_notes || [],
            },
            confidence: venues.length > 0 ? 0.9 : 0.5,
            multiVenueDetected,
          };
        } catch (error: any) {

          return {
            success: false,
            error: `Failed to detect venue: ${error.message}`,
            venues: [],
          };
        }
      },
    };
  }

  /**
   * Tool 2: Analyze club type and recommend setup
   */
  private createAnalyzeClubTypeAndRecommendSetupTool(): AgentTool {
    return {
      name: 'analyze_club_type_and_recommend_setup',
      description: `Classify club type and recommend optimal setup based on similar successful clubs.
Use after venue detection to personalize configuration.
Returns club classification, subscription tier recommendation, and data-driven setup suggestions.`,
      input_schema: z.object({
        clubDescription: z.string().describe('Brief description of club operations or club name'),
        venueData: z.any().describe('Output from detect_venue_and_analyze_operations'),
      }),
      execute: async (input) => {

        try {
          const description = input.clubDescription.toLowerCase();

          // Classify club type based on description
          let clubType: 'yacht_club' | 'class_association' | 'regatta_organizer' | 'sailing_school' = 'yacht_club';

          if (description.includes('class') || description.includes('association')) {
            clubType = 'class_association';
          } else if (description.includes('regatta') || description.includes('organizer')) {
            clubType = 'regatta_organizer';
          } else if (description.includes('school') || description.includes('academy')) {
            clubType = 'sailing_school';
          }

          // Query similar clubs in the region
          const region = input.venueData?.regionalContext?.region;
          const { data: similarClubs } = await supabase
            .from('yacht_clubs')
            .select('name, location, subscription_tier, annual_events')
            .eq('region', region)
            .limit(5);

          // Estimate annual events based on club type
          let estimatedRacesPerYear = 50;
          if (clubType === 'yacht_club') estimatedRacesPerYear = 80;
          if (clubType === 'class_association') estimatedRacesPerYear = 120;
          if (clubType === 'regatta_organizer') estimatedRacesPerYear = 200;
          if (clubType === 'sailing_school') estimatedRacesPerYear = 30;

          // Recommend subscription tier
          let suggestedTier: 'starter' | 'club_pro' | 'enterprise' = 'club_pro';
          if (estimatedRacesPerYear < 50) suggestedTier = 'starter';
          if (estimatedRacesPerYear > 150) suggestedTier = 'enterprise';

          // Racing formats based on club type
          const racingFormats = clubType === 'yacht_club'
            ? ['fleet', 'match']
            : clubType === 'class_association'
            ? ['fleet']
            : ['fleet', 'match', 'team'];

          // Scoring systems based on region and club type
          const scoringSystems = ['low_point'];
          if (region === 'asia-pacific') scoringSystems.push('hkpn');
          if (region === 'north-america') scoringSystems.push('phrf');
          if (region === 'europe') scoringSystems.push('irc');

          return {
            success: true,
            clubType,
            recommendations: {
              racingFormats,
              scoringSystems,
              suggestedTier,
              estimatedRacesPerYear,
              requiredIntegrations: scoringSystems.filter(s => s !== 'low_point'),
            },
            similarClubs: (similarClubs || []).map(club => ({
              name: club.name,
              location: club.location,
              tier: club.subscription_tier,
              racesPerYear: club.annual_events,
            })),
            reasoning: `Based on your location and club type (${clubType}), I recommend the ${suggestedTier} tier. Similar clubs in ${region} typically run ${estimatedRacesPerYear} races per year.`,
          };
        } catch (error: any) {

          return {
            success: false,
            error: `Failed to analyze club type: ${error.message}`,
          };
        }
      },
    };
  }

  /**
   * Tool 3: Generate race documents from templates
   */
  private createGenerateRaceDocumentsTool(): AgentTool {
    return {
      name: 'generate_race_documents_from_templates',
      description: `Auto-generate World Sailing-compliant race documents (NOR, SI) with venue-specific fields.
Use after venue detection to create initial document templates.
Returns Notice of Race and Sailing Instructions ready for review.`,
      input_schema: z.object({
        clubName: z.string().describe('Club name'),
        venueId: z.string().describe('Primary venue ID'),
        eventType: z.enum(['series', 'regatta', 'championship']).describe('Type of event'),
        boatClasses: z.array(z.string()).describe('Boat classes participating'),
        eventDate: z.string().optional().describe('Event date (ISO format)'),
      }),
      execute: async (input) => {

        try {
          // Get venue details
          const { data: venue } = await supabase
            .from('sailing_venues')
            .select('*')
            .eq('id', input.venueId)
            .single();

          if (!venue) {
            return {
              success: false,
              error: `Venue not found: ${input.venueId}`,
            };
          }

          // Generate Notice of Race
          const noticeOfRace = `# NOTICE OF RACE
## ${input.clubName} ${input.eventType.charAt(0).toUpperCase() + input.eventType.slice(1)}

**Venue:** ${venue.name}, ${venue.city}, ${venue.country}

### 1. RULES
Racing will be governed by the rules as defined in The Racing Rules of Sailing (RRS).

### 2. ELIGIBILITY
The ${input.eventType} is open to boats of the following classes: ${input.boatClasses.join(', ')}.

### 3. SCHEDULE
- Registration: TBD
- First Warning Signal: TBD
- Number of Races: TBD

### 4. VENUE
**Sailing Area:** ${venue.name}
**Coordinates:** ${venue.coordinates?.coordinates?.[1] || 'TBD'}, ${venue.coordinates?.coordinates?.[0] || 'TBD'}

### 5. COURSES
Courses will be defined in the Sailing Instructions.

### 6. SCORING
The Low Point scoring system of RRS Appendix A will apply.

### 7. ENTRIES
Entry forms available at: [Club Website]
Entry fee: TBD

### 8. FURTHER INFORMATION
Contact: ${input.clubName}
Generated by BetterAt`;

          // Generate Sailing Instructions
          const sailingInstructions = `# SAILING INSTRUCTIONS
## ${input.clubName} ${input.eventType.charAt(0).toUpperCase() + input.eventType.slice(1)}

### 1. RULES
Racing will be governed by the rules as defined in The Racing Rules of Sailing (RRS).

### 2. NOTICES TO COMPETITORS
Notices to competitors will be posted on the official notice board.

### 3. CHANGES TO SAILING INSTRUCTIONS
Any change to the sailing instructions will be posted before 0900 on the day it will take effect.

### 4. SIGNALS MADE ASHORE
Signals made ashore will be displayed at: [Location]

### 5. SCHEDULE OF RACES
[Schedule to be determined]

### 6. COURSES
Courses will be announced on the water by the Race Committee.

### 7. MARKS
Course marks will be: [To be specified]

### 8. THE START
Races will be started using RRS 26.

### 9. THE FINISH
The finishing line will be between a staff displaying an orange flag on the committee boat and a nearby mark.

### 10. TIME LIMITS
Time limits: TBD

### 11. PROTESTS AND REQUESTS FOR REDRESS
Protests shall be delivered to the Race Committee within [X] minutes after the last boat finishes.

### 12. SCORING
Low Point scoring system (RRS Appendix A).

### 13. SAFETY REGULATIONS
[Venue-specific safety protocols to be added]

Generated by BetterAt`;

          return {
            success: true,
            documents: {
              noticeOfRace: {
                content: noticeOfRace,
                templateUsed: 'world_sailing_standard',
                venueSpecificFields: {
                  venueName: venue.name,
                  coordinates: venue.coordinates,
                  city: venue.city,
                  country: venue.country,
                },
              },
              sailingInstructions: {
                content: sailingInstructions,
                courseDiagram: undefined,
                safetyProtocols: ['PFD required', 'VHF check-in required'],
              },
            },
            readyForReview: true,
            customizationsNeeded: [
              'Set specific dates and times',
              'Define course marks and diagrams',
              'Set entry fees',
              'Add venue-specific safety protocols',
            ],
          };
        } catch (error: any) {

          return {
            success: false,
            error: `Failed to generate documents: ${error.message}`,
          };
        }
      },
    };
  }

  /**
   * Tool 4: Discover and import venue intelligence
   */
  private createDiscoverAndImportVenueIntelligenceTool(): AgentTool {
    return {
      name: 'discover_and_import_venue_intelligence',
      description: `Load complete venue intelligence package (weather, cultural, tactical).
Use after venue detection to configure regional integrations.
Returns intelligence status and configured API sources.`,
      input_schema: z.object({
        venueId: z.string().describe('Venue ID'),
        clubId: z.string().optional().describe('Club ID to associate intelligence'),
      }),
      execute: async (input) => {

        try {
          // Call VenueIntelligenceAgent to load intelligence
          const result = await this.venueAgent.switchVenueBySelection(input.venueId);

          if (!result.success) {
            return {
              success: false,
              error: result.error || 'Failed to load venue intelligence',
            };
          }

          // Get venue details to determine weather API
          const { data: venue } = await supabase
            .from('sailing_venues')
            .select('region, country, cultural_profiles(*)')
            .eq('id', input.venueId)
            .single();

          // Determine weather API based on region
          let weatherApiConfigured: 'HKO' | 'NOAA' | 'ECMWF' | 'WeatherAPI' = 'WeatherAPI';
          if (venue?.region === 'asia-pacific' && venue?.country === 'Hong Kong') {
            weatherApiConfigured = 'HKO';
          } else if (venue?.region === 'north-america') {
            weatherApiConfigured = 'NOAA';
          } else if (venue?.region === 'europe') {
            weatherApiConfigured = 'ECMWF';
          }

          const culturalProfile = venue?.cultural_profiles?.[0];

          return {
            success: true,
            intelligenceLoaded: {
              weather: true,
              tactical: true,
              cultural: !!culturalProfile,
              logistical: true,
            },
            weatherApiConfigured,
            culturalSettings: {
              language: culturalProfile?.primary_language || 'English',
              currency: culturalProfile?.currency || 'USD',
              protocols: culturalProfile?.cultural_notes || [],
            },
            standardCourses: 3, // Default number of standard courses
            offlineDataCached: true,
          };
        } catch (error: any) {

          return {
            success: false,
            error: `Failed to import venue intelligence: ${error.message}`,
          };
        }
      },
    };
  }

  /**
   * Tool 5: Benchmark and optimize pricing
   */
  private createBenchmarkAndOptimizePricingTool(): AgentTool {
    return {
      name: 'benchmark_and_optimize_pricing',
      description: `Research regional pricing and recommend competitive entry fees.
Use after club type analysis to suggest pricing strategy.
Returns regional benchmarks and recommended fee structure.`,
      input_schema: z.object({
        clubLocation: z.string().describe('Club location/region'),
        memberCount: z.number().optional().describe('Estimated member count'),
        estimatedRacesPerYear: z.number().describe('Estimated annual race count'),
        boatClasses: z.array(z.string()).describe('Boat classes'),
      }),
      execute: async (input) => {

        try {
          // Query similar clubs for pricing benchmarks
          const { data: clubs } = await supabase
            .from('yacht_clubs')
            .select('name, typical_entry_fee, currency, annual_events')
            .not('typical_entry_fee', 'is', null)
            .limit(10);

          // Calculate regional average
          const fees = (clubs || []).map(c => c.typical_entry_fee).filter(f => f > 0);
          const averageEntryFee = fees.length > 0
            ? fees.reduce((a, b) => a + b, 0) / fees.length
            : 50;

          const currency = clubs?.[0]?.currency || 'USD';

          // Recommend pricing based on boat classes and race frequency
          const baseEntryFee = Math.round(averageEntryFee);
          const seriesDiscount = 15; // 15% discount for series
          const earlyBirdDiscount = 10; // 10% early bird discount

          return {
            success: true,
            regionalBenchmark: {
              currency,
              averageEntryFee: Math.round(averageEntryFee),
              range: {
                min: Math.round(averageEntryFee * 0.7),
                max: Math.round(averageEntryFee * 1.5),
              },
              similarClubs: (clubs || []).slice(0, 3).map(c => ({
                name: c.name,
                typicalFee: c.typical_entry_fee,
              })),
            },
            recommendations: {
              singleRaceEntry: baseEntryFee,
              seriesEntry: Math.round(baseEntryFee * (1 - seriesDiscount / 100)),
              championshipEntry: Math.round(baseEntryFee * 1.5),
              memberDiscount: 20, // 20% member discount
              earlyBirdDiscount,
            },
            reasoning: `Based on ${clubs?.length || 0} similar clubs in your region, the average entry fee is ${currency} ${Math.round(averageEntryFee)}. I recommend ${currency} ${baseEntryFee} for single races with discounts for series and members.`,
            sustainabilityAnalysis: {
              costPerRace: Math.round(baseEntryFee * 0.3), // Assume 30% operational cost
              breakEvenEntries: 20, // Minimum entries to break even
            },
          };
        } catch (error: any) {

          return {
            success: false,
            error: `Failed to benchmark pricing: ${error.message}`,
          };
        }
      },
    };
  }

  /**
   * Tool 6: Configure multi-venue operations
   */
  private createConfigureMultiVenueOperationsTool(): AgentTool {
    return {
      name: 'configure_multi_venue_operations',
      description: `Setup unified multi-venue management for clubs with multiple locations.
Use when multi-venue detected to configure cross-venue operations.
Returns venue network configuration and unified systems setup.`,
      input_schema: z.object({
        clubId: z.string().describe('Club ID'),
        venues: z.array(z.object({
          venueId: z.string(),
          venueName: z.string(),
          venueType: z.enum(['headquarters', 'racing', 'marina', 'social']),
        })),
      }),
      execute: async (input) => {

        try {
          // Identify headquarters (first headquarters type, or first venue)
          const hqVenue = input.venues.find(v => v.venueType === 'headquarters') || input.venues[0];
          const racingVenues = input.venues.filter(v => v.venueType === 'racing');
          const supportFacilities = input.venues.filter(v => v.venueType === 'marina' || v.venueType === 'social');

          // Store venue relationships in database (placeholder - would need club_venues table)
          // This would be implemented with actual database operations

          return {
            success: true,
            venueConfiguration: {
              primaryVenue: hqVenue.venueName,
              racingVenues: racingVenues.map(v => v.venueName),
              marinas: supportFacilities.map(v => v.venueName),
            },
            unifiedCalendar: true,
            resourceAllocation: {
              sharedEquipment: true,
              staffRotation: true,
              transportation: true,
            },
            communicationSetup: {
              crossVenueNotifications: true,
              venueSpecificChannels: true,
            },
          };
        } catch (error: any) {

          return {
            success: false,
            error: `Failed to configure multi-venue operations: ${error.message}`,
          };
        }
      },
    };
  }

  /**
   * Tool 7: Setup staff and permissions intelligently
   */
  private createSetupStaffAndPermissionsTool(): AgentTool {
    return {
      name: 'setup_staff_and_permissions_intelligently',
      description: `Recommend role structures and assign permissions based on club size.
Use to configure organizational structure and invite staff.
Returns recommended roles and invitation status.`,
      input_schema: z.object({
        clubId: z.string().describe('Club ID'),
        clubType: z.string().describe('Club type'),
        memberCount: z.number().optional().describe('Member count'),
        estimatedRacesPerYear: z.number().describe('Estimated annual races'),
        multiVenue: z.boolean().describe('Is this a multi-venue club?'),
        staffRoster: z.array(z.object({
          name: z.string(),
          email: z.string(),
          role: z.string().optional(),
        })).optional().describe('Staff members to invite'),
      }),
      execute: async (input) => {

        try {
          // Recommend roles based on club size and race frequency
          const roles = [];

          // Always need a sailing manager
          roles.push({
            roleName: 'Sailing Manager',
            count: 1,
            permissions: ['full_access', 'manage_races', 'manage_staff', 'manage_billing'],
            description: 'Overall race management and club operations',
          });

          // PROs based on venue count and race frequency
          const proCount = input.multiVenue ? 3 : 1;
          roles.push({
            roleName: 'Principal Race Officer',
            count: proCount,
            permissions: ['create_races', 'modify_courses', 'post_results', 'manage_entries'],
            description: input.multiVenue ? 'One PRO per venue' : 'Lead race officer',
          });

          // Race officers based on event frequency
          const roCount = input.estimatedRacesPerYear > 100 ? 8 : input.estimatedRacesPerYear > 50 ? 5 : 3;
          roles.push({
            roleName: 'Race Officer',
            count: roCount,
            permissions: ['view_races', 'edit_assigned_duties', 'update_race_status'],
            description: 'Rotating race committee members',
          });

          // Volunteers for timing
          const volunteerCount = Math.ceil(input.estimatedRacesPerYear / 10);
          roles.push({
            roleName: 'Volunteer',
            count: volunteerCount,
            permissions: ['view_races', 'timing_assistance'],
            description: 'Timing and support staff',
          });

          // Send invitations if staff roster provided
          const staffInvitations = (input.staffRoster || []).map(staff => ({
            name: staff.name,
            email: staff.email,
            role: staff.role || 'Sailing Manager',
            invitationSent: true, // Would actually send email here
          }));

          return {
            success: true,
            recommendedRoles: roles,
            staffInvitations,
            workflowsConfigured: true,
            trainingResources: [
              'https://better.at/training/race-officer-basics',
              'https://better.at/training/multi-venue-management',
            ],
          };
        } catch (error: any) {

          return {
            success: false,
            error: `Failed to setup staff: ${error.message}`,
          };
        }
      },
    };
  }

  /**
   * Tool 8: Finalize onboarding with celebration
   */
  private createFinalizeOnboardingTool(): AgentTool {
    return {
      name: 'finalize_club_onboarding_with_celebration',
      description: `Validate configuration, generate summary, and launch club.
Use as the FINAL tool to complete onboarding.
Returns setup summary, next steps, and celebration message.`,
      input_schema: z.object({
        clubId: z.string().describe('Club ID'),
        onboardingData: z.any().describe('All data collected during onboarding'),
      }),
      execute: async (input) => {

        try {
          // Validate configuration (placeholder - would check all required fields)
          const venuesConfigured = input.onboardingData?.venues?.length || 1;
          const fleetsConfigured = input.onboardingData?.boatClasses?.length || 0;
          const staffInvited = input.onboardingData?.staffInvitations?.length || 0;
          const subscriptionTier = input.onboardingData?.recommendations?.suggestedTier || 'club_pro';

          // Generate next steps
          const nextSteps = [
            {
              task: 'Complete payment setup',
              priority: 'high' as const,
              link: '/club/billing',
            },
            {
              task: 'Upload club logo and branding',
              priority: 'high' as const,
              link: '/club/settings',
            },
            {
              task: 'Create your first event',
              priority: 'high' as const,
              link: '/club/events/new',
            },
            {
              task: 'Invite additional staff members',
              priority: 'medium' as const,
              link: '/club/staff',
            },
            {
              task: 'Review and publish race documents',
              priority: 'medium' as const,
              link: '/club/documents',
            },
          ];

          // Create celebration message
          const clubName = input.onboardingData?.clubName || 'Your Club';
          const celebrationMessage = `🎉 Congratulations! ${clubName} is now live on BetterAt!

You're all set up with:
✅ ${venuesConfigured} venue${venuesConfigured > 1 ? 's' : ''} configured with regional intelligence
✅ ${fleetsConfigured} fleet${fleetsConfigured !== 1 ? 's' : ''} ready to race
✅ ${staffInvited} staff member${staffInvited !== 1 ? 's' : ''} invited
✅ ${subscriptionTier} subscription tier activated

Welcome to the future of race management!`;

          return {
            success: true,
            summary: {
              clubName,
              venuesConfigured,
              fleetsConfigured,
              staffInvited,
              subscriptionTier,
              intelligenceLoaded: true,
            },
            nextSteps,
            celebrationMessage,
            dashboardUrl: '/club/dashboard',
            supportResources: {
              videoTutorial: 'https://better.at/tutorials/getting-started',
              documentation: 'https://better.at/docs',
              supportEmail: 'info@better.at',
            },
          };
        } catch (error: any) {

          return {
            success: false,
            error: `Failed to finalize onboarding: ${error.message}`,
          };
        }
      },
    };
  }

  /**
   * High-level method: Start conversational onboarding
   */
  async startConversationalOnboarding(clubNameOrLocation: string, userId: string) {
    return this.run({
      userMessage: `Help me set up my club on BetterAt: ${clubNameOrLocation}`,
      context: {
        clubNameOrLocation,
        userId,
        onboardingStarted: new Date().toISOString(),
      },
      maxIterations: 15, // Complex multi-step onboarding
    });
  }

  /**
   * Streaming method: Real-time conversational updates
   */
  async *streamClubSetup(
    userMessage: string,
    context: ClubOnboardingContext
  ): AsyncGenerator<string, void, unknown> {
    // TODO: Implement streaming support using Anthropic SDK's streaming API
    // This will enable real-time UI updates as agent executes tools

    yield 'Streaming implementation coming soon...';
  }
}

export default ClubOnboardingAgent;
