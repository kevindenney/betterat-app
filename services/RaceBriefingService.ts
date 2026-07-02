/**
 * RaceBriefingService
 * AI-powered service to generate comprehensive pre-race briefing documents
 * Works for both fleet racing and distance racing with type-specific content
 */

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import { RaceWeatherService } from './RaceWeatherService';

const logger = createLogger('RaceBriefingService');

export interface RaceBriefing {
  id: string;
  raceId: string;
  raceName: string;
  raceType: 'fleet' | 'distance';
  generatedAt: string;
  
  // Header info
  venue: string;
  date: string;
  startTime: string;
  
  // Conditions summary
  conditions: {
    wind: {
      direction: string;
      speedMin: number;
      speedMax: number;
      summary: string;
    };
    tide: {
      state: string;
      height?: number;
      direction?: string;
      summary: string;
    };
    seaState?: string;
    visibility?: string;
  };
  
  // Strategic recommendations (AI-generated)
  strategy: {
    keyPoints: {
      title: string;
      content: string;
      priority: 'critical' | 'important' | 'consider';
    }[];
    decisionPoints: {
      question: string;
      options: string[];
    }[];
    warnings: string[];
  };
  
  // Fleet racing specific
  fleetRacing?: {
    startStrategy: string;
    firstBeat: string;
    downwind: string;
    markRoundings: string;
    classInfo: {
      myClass: string;
      classBefore?: string;
      myFlag?: string;
      warningTime?: string;
      startTime?: string;
    };
  };
  
  // Distance racing specific
  distanceRacing?: {
    routeOverview: string;
    legBreakdown: {
      from: string;
      to: string;
      distance?: number;
      estimatedTime?: string;
      weatherAtLeg?: string;
      tactics?: string;
    }[];
    tideGates: {
      location: string;
      optimalTime: string;
      notes: string;
    }[];
    keyDecisions: {
      location: string;
      decision: string;
      options: string[];
    }[];
  };
  
  // Important times
  importantTimes: {
    label: string;
    time: string;
  }[];
  
  // Communications
  communications: {
    vhfChannel?: string;
    backupChannel?: string;
    safetyChannel?: string;
  };
}

export interface GenerateBriefingOptions {
  includeWeather?: boolean;
  includeStrategy?: boolean;
  userBoatClass?: string;
  useAI?: boolean;
}

class RaceBriefingServiceClass {
  /**
   * Generate a pre-race briefing for a given race
   */
  async generateBriefing(
    raceId: string,
    options: GenerateBriefingOptions = {}
  ): Promise<RaceBriefing | null> {
    const {
      includeWeather = true,
      includeStrategy = true,
      userBoatClass,
      useAI = true,
    } = options;

    try {
      logger.debug('[generateBriefing] Fetching race data for:', raceId);
      
      // Fetch race data
      const { data: race, error } = await supabase
        .from('regattas')
        .select('*')
        .eq('id', raceId)
        .single();

      if (error || !race) {
        logger.error('[generateBriefing] Failed to fetch race:', error);
        return null;
      }

      const raceType = race.race_type || 'fleet';
      const metadata = race.metadata || {};
      
      // Fetch weather if needed
      let weatherData = null;
      if (includeWeather && metadata.racing_area_coordinates) {
        try {
          weatherData = await RaceWeatherService.fetchWeatherByCoordinates(
            metadata.racing_area_coordinates.lat,
            metadata.racing_area_coordinates.lng,
            race.start_date,
            metadata.venue_name || 'Race Venue'
          );
        } catch (weatherError) {
          logger.warn('[generateBriefing] Weather fetch failed:', weatherError);
        }
      }

      // Build base briefing
      const briefing: RaceBriefing = {
        id: `briefing-${raceId}-${Date.now()}`,
        raceId,
        raceName: race.name,
        raceType,
        generatedAt: new Date().toISOString(),
        venue: metadata.venue_name || 'Unknown Venue',
        date: race.start_date,
        startTime: race.warning_signal_time || '10:00',
        
        conditions: {
          wind: weatherData?.wind || metadata.wind || {
            direction: 'Variable',
            speedMin: 8,
            speedMax: 15,
            summary: 'Check latest forecast before race',
          },
          tide: {
            state: weatherData?.tide?.state || metadata.tide?.state || 'unknown',
            height: weatherData?.tide?.height || metadata.tide?.height,
            direction: weatherData?.tide?.direction || metadata.tide?.direction,
            summary: this.generateTideSummary(weatherData?.tide || metadata.tide),
          },
        },
        
        strategy: {
          keyPoints: [],
          decisionPoints: [],
          warnings: [],
        },
        
        importantTimes: this.buildImportantTimes(race, userBoatClass),
        
        communications: {
          vhfChannel: race.vhf_channel || metadata.vhf_channels?.[0]?.channel,
          backupChannel: race.vhf_backup_channel,
          safetyChannel: race.safety_channel || 'VHF 16',
        },
      };

      // Add type-specific content
      if (raceType === 'distance') {
        briefing.distanceRacing = this.buildDistanceRacingContent(race);
      } else {
        briefing.fleetRacing = this.buildFleetRacingContent(race, userBoatClass);
      }

      // Generate AI strategy if enabled
      if (includeStrategy && useAI) {
        const aiStrategy = await this.generateAIStrategy(race, weatherData, raceType);
        if (aiStrategy && aiStrategy.keyPoints && aiStrategy.keyPoints.length > 0) {
          briefing.strategy = aiStrategy;
        } else {
          // AI failed or returned empty - fall back to basic strategy
          logger.warn('[generateBriefing] AI strategy failed or empty, using basic strategy');
          briefing.strategy = this.buildBasicStrategy(race, raceType);
        }
      } else {
        // Basic strategy without AI
        briefing.strategy = this.buildBasicStrategy(race, raceType);
      }

      return briefing;
    } catch (error) {
      logger.error('[generateBriefing] Error:', error);
      return null;
    }
  }

  /**
   * Generate tide summary text
   */
  private generateTideSummary(tide?: { state?: string; height?: number; direction?: string }): string {
    if (!tide?.state) return 'Check local tide tables';
    
    const state = tide.state;
    const height = tide.height ? `${tide.height.toFixed(1)}m` : '';
    const direction = tide.direction ? ` (${tide.direction})` : '';
    
    return `${state.charAt(0).toUpperCase() + state.slice(1)} ${height}${direction}`.trim();
  }

  /**
   * Build important times list from race data
   */
  private buildImportantTimes(race: any, userBoatClass?: string): { label: string; time: string }[] {
    const times: { label: string; time: string }[] = [];
    
    if (race.skipper_briefing_time) {
      times.push({ label: 'Skipper Briefing', time: race.skipper_briefing_time });
    }
    if (race.check_in_time) {
      times.push({ label: 'Check-In', time: race.check_in_time });
    }
    if (race.warning_signal_time) {
      times.push({ label: 'First Warning', time: race.warning_signal_time });
    }
    
    // Find user's class start time
    if (userBoatClass && race.start_sequence_details) {
      const classStart = race.start_sequence_details.find(
        (s: any) => s.class?.toLowerCase() === userBoatClass.toLowerCase()
      );
      if (classStart) {
        times.push({ label: `Your Start (${userBoatClass})`, time: classStart.start });
      }
    }
    
    if (race.time_limit_hours) {
      times.push({ label: 'Time Limit', time: `${race.time_limit_hours} hours` });
    }
    
    return times;
  }

  /**
   * Build fleet racing specific content
   */
  private buildFleetRacingContent(race: any, userBoatClass?: string): RaceBriefing['fleetRacing'] {
    const startSequence = race.start_sequence_details || [];
    const userClassInfo = userBoatClass
      ? startSequence.find((s: any) => s.class?.toLowerCase() === userBoatClass.toLowerCase())
      : startSequence[0];
    
    // Find class before user's class
    const classIndex = startSequence.findIndex(
      (s: any) => s.class?.toLowerCase() === userBoatClass?.toLowerCase()
    );
    const classBefore = classIndex > 0 ? startSequence[classIndex - 1] : null;

    return {
      startStrategy: race.start_strategy || 'Assess line bias and position for clean air',
      firstBeat: race.favored_side 
        ? `Favored side: ${race.favored_side}` 
        : 'Assess shifts and current influence',
      downwind: race.layline_strategy || 'Sail the angles, stay in pressure',
      markRoundings: 'Plan approach early, maintain clear air',
      classInfo: {
        myClass: userBoatClass || userClassInfo?.class || 'Unknown',
        classBefore: classBefore?.class,
        myFlag: userClassInfo?.flag,
        warningTime: userClassInfo?.warning,
        startTime: userClassInfo?.start,
      },
    };
  }

  /**
   * Build distance racing specific content
   */
  private buildDistanceRacingContent(race: any): RaceBriefing['distanceRacing'] {
    const waypoints = race.route_waypoints || [];
    
    // Build leg breakdown from waypoints
    const legBreakdown: RaceBriefing['distanceRacing']['legBreakdown'] = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
      legBreakdown.push({
        from: waypoints[i].name,
        to: waypoints[i + 1].name,
        tactics: waypoints[i].notes,
      });
    }

    return {
      routeOverview: race.racing_area_description || 
        `${race.total_distance_nm || 'Unknown'} nm ${race.start_finish_same_location ? 'circumnavigation' : 'point-to-point'}`,
      legBreakdown,
      tideGates: race.metadata?.tideGates || [],
      keyDecisions: [],
    };
  }

  /**
   * Build basic strategy without AI
   */
  private buildBasicStrategy(race: any, raceType: 'fleet' | 'distance'): RaceBriefing['strategy'] {
    const keyPoints: RaceBriefing['strategy']['keyPoints'] = [];
    const decisionPoints: RaceBriefing['strategy']['decisionPoints'] = [];
    const warnings: string[] = [];

    if (raceType === 'fleet') {
      keyPoints.push({
        title: 'Start',
        content: race.start_strategy || 'Assess line bias before the start sequence',
        priority: 'critical',
      });
      keyPoints.push({
        title: 'First Beat',
        content: race.favored_side 
          ? `Consider ${race.favored_side} side based on venue characteristics`
          : 'Stay in phase with wind shifts',
        priority: 'important',
      });
      
      decisionPoints.push({
        question: 'Which end of the line?',
        options: ['Pin (port bias)', 'Boat (starboard bias)', 'Middle (best clear air)'],
      });
    } else {
      // Distance Racing Strategy
      const waypoints = race.route_waypoints || [];
      const totalDistance = race.total_distance_nm || 0;
      
      keyPoints.push({
        title: 'Route Planning',
        content: totalDistance > 0 
          ? `Optimize ${totalDistance}nm course for VMG. ${waypoints.length > 2 ? `Key waypoints: ${waypoints.slice(1, -1).map((w: any) => w.name).join(', ')}` : 'Plan each leg carefully.'}`
          : 'Optimize for VMG and favorable current',
        priority: 'critical',
      });
      
      keyPoints.push({
        title: 'Tide & Current Strategy',
        content: 'Time waypoint passages for favorable current. Check tide tables for each leg.',
        priority: 'critical',
      });
      
      keyPoints.push({
        title: 'Weather Monitoring',
        content: 'Track wind shifts throughout the race. Be prepared to adjust sail trim for changing conditions.',
        priority: 'important',
      });
      
      if (totalDistance > 15) {
        keyPoints.push({
          title: 'Pacing & Energy',
          content: 'This is a longer race - pace yourself and maintain focus for the duration.',
          priority: 'important',
        });
      }
      
      decisionPoints.push({
        question: 'Start strategy?',
        options: ['Push hard early for position', 'Conservative start, pace for distance', 'Tactical start based on fleet positions'],
      });
      
      decisionPoints.push({
        question: 'Route choice at key waypoints?',
        options: ['Inside/coastal (shorter but potentially lighter wind)', 'Outside/offshore (more wind but longer)', 'Sail the rhumb line'],
      });
      
      if (race.time_limit_hours) {
        warnings.push(`Time limit: ${race.time_limit_hours} hours. Plan your pace accordingly.`);
      }
    }

    // Add any venue-specific warnings
    if (race.venue_specific_notes) {
      warnings.push(race.venue_specific_notes);
    }
    if (race.prohibited_areas && race.prohibited_areas.length > 0) {
      warnings.push(`Prohibited areas: ${race.prohibited_areas.map((a: any) => a.name).join(', ')}`);
    }

    return { keyPoints, decisionPoints, warnings };
  }

  /**
   * Generate AI-powered strategy recommendations
   */
  private async generateAIStrategy(
    race: any,
    weatherData: any,
    raceType: 'fleet' | 'distance'
  ): Promise<RaceBriefing['strategy'] | null> {
    try {
      // Call the generate-race-briefing edge function
      const { data, error } = await supabase.functions.invoke('generate-race-briefing', {
        body: {
          race,
          weather: weatherData,
          raceType,
        },
      });

      if (error) {
        logger.warn('[generateAIStrategy] Edge function error:', error);
        return null;
      }

      return data?.strategy || null;
    } catch (error) {
      logger.warn('[generateAIStrategy] Failed to generate AI strategy:', error);
      return null;
    }
  }

  /**
   * Format briefing as shareable text
   */
  formatAsText(briefing: RaceBriefing): string {
    const lines: string[] = [];
    
    lines.push('═'.repeat(50));
    lines.push(`📋 PRE-RACE BRIEFING`);
    lines.push(`${briefing.raceName} - ${new Date(briefing.date).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })}`);
    lines.push('═'.repeat(50));
    
    lines.push('');
    lines.push('RACE OVERVIEW');
    lines.push(`• Type: ${briefing.raceType === 'fleet' ? 'Fleet Race' : 'Distance Race'}`);
    lines.push(`• Venue: ${briefing.venue}`);
    lines.push(`• First Warning: ${briefing.startTime}`);
    
    lines.push('');
    lines.push('CONDITIONS');
    lines.push(`• Wind: ${briefing.conditions.wind.direction} ${briefing.conditions.wind.speedMin}-${briefing.conditions.wind.speedMax} kts`);
    lines.push(`• Tide: ${briefing.conditions.tide.summary}`);
    
    lines.push('');
    lines.push('🎯 KEY STRATEGIC POINTS');
    briefing.strategy.keyPoints.forEach((point, i) => {
      const priority = point.priority === 'critical' ? '❗' : point.priority === 'important' ? '▸' : '○';
      lines.push(`${i + 1}. ${priority} ${point.title}: ${point.content}`);
    });
    
    if (briefing.strategy.warnings.length > 0) {
      lines.push('');
      lines.push('⚠️ WARNINGS');
      briefing.strategy.warnings.forEach(warning => {
        lines.push(`• ${warning}`);
      });
    }
    
    lines.push('');
    lines.push('IMPORTANT TIMES');
    briefing.importantTimes.forEach(time => {
      lines.push(`• ${time.label}: ${time.time}`);
    });
    
    if (briefing.communications.vhfChannel) {
      lines.push('');
      lines.push('COMMUNICATIONS');
      lines.push(`• VHF: Channel ${briefing.communications.vhfChannel}`);
      if (briefing.communications.safetyChannel) {
        lines.push(`• Safety: ${briefing.communications.safetyChannel}`);
      }
    }
    
    lines.push('');
    lines.push('─'.repeat(50));
    lines.push(`Generated by BetterAt • ${new Date(briefing.generatedAt).toLocaleString()}`);
    
    return lines.join('\n');
  }
}

export const RaceBriefingService = new RaceBriefingServiceClass();
export default RaceBriefingService;
