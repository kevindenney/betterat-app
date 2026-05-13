/**
 * Handicap Calculator Service
 * PHRF, IRC, ORC, and custom rating systems for corrected time scoring
 */

import { supabase } from './supabase';
import { isMissingIdColumn } from '@/lib/utils/supabaseSchemaFallback';
import { createLogger } from '@/lib/utils/logger';
import { withSupabaseError } from '@/lib/utils/withErrorHandling';

const logger = createLogger('HandicapService');

// ============================================================================
// TYPES
// ============================================================================

export type CalculationType = 'time_on_time' | 'time_on_distance' | 'custom';

export interface HandicapSystem {
  id: string;
  code: string;
  name: string;
  description?: string;
  calculation_type: CalculationType;
  rating_unit: string;
  lower_is_faster: boolean;
  base_rating?: number;
  tcf_formula?: string;
  tod_formula?: string;
  custom_formula?: string;
  min_rating?: number;
  max_rating?: number;
  rating_precision: number;
  time_precision: number;
  is_active: boolean;
  is_builtin: boolean;
}

export interface BoatRating {
  id: string;
  boat_id?: string;
  sail_number: string;
  boat_name?: string;
  boat_class?: string;
  club_id?: string;
  system_id: string;
  rating: number;
  certificate_number?: string;
  certificate_expiry?: string;
  issuing_authority?: string;
  tcf?: number;
  previous_rating?: number;
  rating_changed_at?: string;
  rating_notes?: string;
  is_active: boolean;
  verified: boolean;
  verified_by?: string;
  verified_at?: string;
}

export interface HandicapResult {
  id: string;
  regatta_id: string;
  race_number: number;
  entry_id: string;
  system_id: string;
  rating_id?: string;
  rating_value: number;
  tcf_value?: number;
  elapsed_seconds: number;
  corrected_seconds: number;
  course_distance_nm?: number;
  scratch_position?: number;
  corrected_position?: number;
  time_behind_seconds?: number;
  status: string;
  calculated_at: string;
}

export interface RaceResultWithHandicap {
  result_id: string;
  regatta_id: string;
  race_number: number;
  entry_id: string;
  sail_number: string;
  boat_name?: string;
  skipper_name?: string;
  finish_time?: string;
  elapsed_time?: string;
  elapsed_seconds: number;
  scratch_position?: number;
  status: string;
  system_id?: string;
  system_code?: string;
  system_name?: string;
  rating_value?: number;
  tcf_value?: number;
  corrected_seconds?: number;
  corrected_position?: number;
  time_behind_seconds?: number;
  corrected_time?: string;
}

export interface HandicapStanding {
  regatta_id: string;
  system_id: string;
  system_code: string;
  system_name: string;
  entry_id: string;
  sail_number: string;
  boat_name?: string;
  skipper_name?: string;
  current_rating?: number;
  current_tcf?: number;
  races_sailed: number;
  total_points?: number;
  avg_position?: number;
  wins: number;
  podiums: number;
}

export interface CalculateCorrectedInput {
  elapsed_seconds: number;
  system_code: string;
  rating: number;
  distance_nm?: number;
}

// ============================================================================
// HANDICAP SERVICE CLASS
// ============================================================================

class HandicapService {
  private raceResultsIdColumn: 'regatta_id' | 'race_id' = 'regatta_id';

  private async withRaceResultsIdFallback<T>(
    operation: (column: 'regatta_id' | 'race_id') => Promise<{ data: T | null; error: any }>
  ): Promise<{ data: T | null; error: any }> {
    const current = this.raceResultsIdColumn;
    let result = await operation(current);
    if (result.error && current === 'regatta_id' && isMissingIdColumn(result.error, 'race_results', current)) {
      result = await operation('race_id');
      if (!result.error) {
        this.raceResultsIdColumn = 'race_id';
      }
    }

    return result;
  }

  // -------------------------------------------------------------------------
  // HANDICAP SYSTEMS
  // -------------------------------------------------------------------------

  /**
   * Get all active handicap systems
   */
  async getSystems(): Promise<HandicapSystem[]> {
    const { data, error } = await supabase
      .from('handicap_systems')
      .select('*')
      .eq('is_active', true)
      .order('code');

    if (error) throw error;
    return data || [];
  }

  /**
   * Get a specific system by code
   */
  async getSystemByCode(code: string): Promise<HandicapSystem | null> {
    return withSupabaseError(
      supabase.from('handicap_systems').select('*').eq('code', code).single(),
      { service: 'HandicapService', method: 'getSystemByCode', fallback: null, level: 'warn', context: { code } }
    );
  }

  /**
   * Get a specific system by ID
   */
  async getSystem(id: string): Promise<HandicapSystem | null> {
    return withSupabaseError(
      supabase.from('handicap_systems').select('*').eq('id', id).single(),
      { service: 'HandicapService', method: 'getSystem', fallback: null, level: 'warn', context: { id } }
    );
  }

  /**
   * Create a custom handicap system
   */
  async createSystem(system: Partial<HandicapSystem>): Promise<HandicapSystem> {
    const { data, error } = await supabase
      .from('handicap_systems')
      .insert({
        ...system,
        is_builtin: false,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // -------------------------------------------------------------------------
  // BOAT RATINGS
  // -------------------------------------------------------------------------

  /**
   * Get all ratings for a club
   */
  async getClubRatings(clubId: string): Promise<BoatRating[]> {
    const { data, error } = await supabase
      .from('boat_ratings')
      .select('*')
      .eq('club_id', clubId)
      .eq('is_active', true)
      .order('sail_number');

    if (error) throw error;
    return data || [];
  }

  /**
   * Get ratings for a specific system
   */
  async getRatingsBySystem(systemId: string, clubId?: string): Promise<BoatRating[]> {
    let query = supabase
      .from('boat_ratings')
      .select('*')
      .eq('system_id', systemId)
      .eq('is_active', true)
      .order('sail_number');

    if (clubId) {
      query = query.eq('club_id', clubId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Get rating for a specific boat in a system
   */
  async getBoatRating(
    sailNumber: string,
    systemId: string
  ): Promise<BoatRating | null> {
    return withSupabaseError(
      supabase.from('boat_ratings').select('*').eq('sail_number', sailNumber).eq('system_id', systemId).eq('is_active', true).single(),
      { service: 'HandicapService', method: 'getBoatRating', fallback: null, level: 'warn', context: { sailNumber, systemId } }
    );
  }

  /**
   * Create or update a boat rating
   */
  async upsertRating(rating: Partial<BoatRating> & {
    sail_number: string;
    system_id: string;
    rating: number;
  }): Promise<BoatRating> {
    const { data, error } = await supabase
      .from('boat_ratings')
      .upsert({
        ...rating,
        is_active: true,
      }, {
        onConflict: 'sail_number,system_id',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update a rating
   */
  async updateRating(
    ratingId: string,
    updates: Partial<BoatRating>
  ): Promise<BoatRating> {
    const { data, error } = await supabase
      .from('boat_ratings')
      .update(updates)
      .eq('id', ratingId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Deactivate a rating
   */
  async deactivateRating(ratingId: string): Promise<void> {
    const { error } = await supabase
      .from('boat_ratings')
      .update({ is_active: false })
      .eq('id', ratingId);

    if (error) throw error;
  }

  /**
   * Verify a rating
   */
  async verifyRating(ratingId: string): Promise<void> {
    const { data: user } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('boat_ratings')
      .update({
        verified: true,
        verified_by: user.user?.id,
        verified_at: new Date().toISOString(),
      })
      .eq('id', ratingId);

    if (error) throw error;
  }

  /**
   * Import ratings from CSV data
   */
  async importRatings(
    systemId: string,
    clubId: string,
    ratings: {
      sail_number: string;
      boat_name?: string;
      boat_class?: string;
      rating: number;
    }[]
  ): Promise<{ imported: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;

    for (const rating of ratings) {
      try {
        await this.upsertRating({
          system_id: systemId,
          club_id: clubId,
          sail_number: rating.sail_number,
          boat_name: rating.boat_name,
          boat_class: rating.boat_class,
          rating: rating.rating,
        });
        imported++;
      } catch (error: any) {
        errors.push(`${rating.sail_number}: ${error.message}`);
      }
    }

    return { imported, errors };
  }

  // -------------------------------------------------------------------------
  // CORRECTED TIME CALCULATIONS
  // -------------------------------------------------------------------------

  /**
   * Calculate PHRF TCF from rating
   */
  calculatePhrfTcf(rating: number, baseRating: number = 550): number {
    return 650 / (baseRating + rating);
  }

  /**
   * Calculate corrected time
   */
  calculateCorrectedTime(input: CalculateCorrectedInput): number {
    const { elapsed_seconds, system_code, rating, distance_nm } = input;

    switch (system_code) {
      case 'PHRF':
        // Time-on-Time: Corrected = Elapsed × TCF
        const phrfTcf = this.calculatePhrfTcf(rating);
        return elapsed_seconds * phrfTcf;

      case 'PHRF_TOD':
        // Time-on-Distance: Corrected = Elapsed - (Distance × Rating)
        if (!distance_nm) {
          throw new Error('Distance required for PHRF Time-on-Distance');
        }
        return elapsed_seconds - (distance_nm * rating);

      case 'IRC':
        // IRC: Rating IS the TCF
        return elapsed_seconds * rating;

      case 'ORC':
      case 'ORR':
        // Similar to PHRF but with different base
        const orcTcf = 650 / (600 + rating);
        return elapsed_seconds * orcTcf;

      case 'HANDICAP':
        // Simple club handicap
        const clubTcf = 100 / (100 + rating);
        return elapsed_seconds * clubTcf;

      default:
        throw new Error(`Unknown handicap system: ${system_code}`);
    }
  }

  /**
   * Calculate corrected times for all boats in a race
   */
  async calculateRaceResults(
    regattaId: string,
    raceNumber: number,
    systemCode: string,
    courseDistanceNm?: number
  ): Promise<HandicapResult[]> {
    // Get the system
    const system = await this.getSystemByCode(systemCode);
    if (!system) throw new Error(`Unknown system: ${systemCode}`);

    // Get race results with elapsed times
    const { data: raceResults, error: resultsError } = await this.withRaceResultsIdFallback((column) =>
      supabase
        .from('race_results')
        .select(`
          *,
          race_entries!inner(
            sail_number,
            boat_name,
            skipper_name
          )
        `)
        .eq(column, regattaId)
        .eq('race_number', raceNumber)
        .not('elapsed_time', 'is', null)
    );

    if (resultsError) throw resultsError;
    if (!raceResults || raceResults.length === 0) {
      return [];
    }

    // Calculate corrected times
    const handicapResults: HandicapResult[] = [];

    for (const result of raceResults) {
      const sailNumber = result.race_entries.sail_number;

      // Get rating for this boat
      const rating = await this.getBoatRating(sailNumber, system.id);
      if (!rating) {
        logger.warn(`No rating found for ${sailNumber} in ${systemCode}`);
        continue;
      }

      // Parse elapsed time to seconds
      const elapsedSeconds = this.parseIntervalToSeconds(result.elapsed_time);
      if (elapsedSeconds === null) continue;

      // Calculate corrected time
      const correctedSeconds = this.calculateCorrectedTime({
        elapsed_seconds: elapsedSeconds,
        system_code: systemCode,
        rating: rating.rating,
        distance_nm: courseDistanceNm,
      });

      handicapResults.push({
        id: '', // Will be assigned on insert
        regatta_id: regattaId,
        race_number: raceNumber,
        entry_id: result.entry_id,
        system_id: system.id,
        rating_id: rating.id,
        rating_value: rating.rating,
        tcf_value: rating.tcf,
        elapsed_seconds: elapsedSeconds,
        corrected_seconds: correctedSeconds,
        course_distance_nm: courseDistanceNm,
        scratch_position: result.finish_position,
        status: result.status || 'finished',
        calculated_at: new Date().toISOString(),
      });
    }

    // Sort by corrected time and assign positions
    handicapResults.sort((a, b) => a.corrected_seconds - b.corrected_seconds);
    handicapResults.forEach((result, index) => {
      result.corrected_position = index + 1;
      if (index > 0) {
        result.time_behind_seconds = result.corrected_seconds - handicapResults[0].corrected_seconds;
      } else {
        result.time_behind_seconds = 0;
      }
    });

    // Save results
    const { data: savedResults, error: saveError } = await supabase
      .from('race_handicap_results')
      .upsert(
        handicapResults.map(r => ({
          regatta_id: r.regatta_id,
          race_number: r.race_number,
          entry_id: r.entry_id,
          system_id: r.system_id,
          rating_id: r.rating_id,
          rating_value: r.rating_value,
          tcf_value: r.tcf_value,
          elapsed_seconds: r.elapsed_seconds,
          corrected_seconds: r.corrected_seconds,
          course_distance_nm: r.course_distance_nm,
          scratch_position: r.scratch_position,
          corrected_position: r.corrected_position,
          time_behind_seconds: r.time_behind_seconds,
          status: r.status,
          calculated_at: r.calculated_at,
        })),
        { onConflict: 'regatta_id,race_number,entry_id,system_id' }
      )
      .select();

    if (saveError) throw saveError;
    return savedResults || [];
  }

  /**
   * Calculate all races in a regatta
   */
  async calculateRegattaResults(
    regattaId: string,
    systemCode: string,
    courseDistanceNm?: number
  ): Promise<{ races: number; results: number }> {
    // Get all race numbers
    const { data: races, error } = await this.withRaceResultsIdFallback((column) =>
      supabase
        .from('race_results')
        .select('race_number')
        .eq(column, regattaId)
        .not('elapsed_time', 'is', null)
    );

    if (error) throw error;

    const uniqueRaces = [...new Set(races?.map(r => r.race_number) || [])];
    let totalResults = 0;

    for (const raceNumber of uniqueRaces) {
      const results = await this.calculateRaceResults(
        regattaId,
        raceNumber,
        systemCode,
        courseDistanceNm
      );
      totalResults += results.length;
    }

    return { races: uniqueRaces.length, results: totalResults };
  }

  // -------------------------------------------------------------------------
  // RESULTS & STANDINGS
  // -------------------------------------------------------------------------

  /**
   * Get race results with handicap data
   */
  async getRaceResultsWithHandicap(
    regattaId: string,
    raceNumber: number,
    systemCode?: string
  ): Promise<RaceResultWithHandicap[]> {
    let query = supabase
      .from('race_results_with_handicap')
      .select('*')
      .eq('regatta_id', regattaId)
      .eq('race_number', raceNumber);

    if (systemCode) {
      query = query.eq('system_code', systemCode);
    }

    const { data, error } = await query.order('corrected_position', { nullsFirst: false });
    if (error) throw error;
    return data || [];
  }

  /**
   * Get handicap standings for a regatta
   */
  async getStandings(
    regattaId: string,
    systemCode: string
  ): Promise<HandicapStanding[]> {
    const { data, error } = await supabase
      .from('handicap_standings')
      .select('*')
      .eq('regatta_id', regattaId)
      .eq('system_code', systemCode)
      .order('total_points', { nullsFirst: false });

    if (error) throw error;
    return data || [];
  }

  // -------------------------------------------------------------------------
  // WHAT-IF ANALYSIS
  // -------------------------------------------------------------------------

  /**
   * Calculate what-if scenario with different rating
   */
  whatIfRating(
    elapsedSeconds: number,
    currentRating: number,
    newRating: number,
    systemCode: string,
    distanceNm?: number
  ): {
    currentCorrected: number;
    newCorrected: number;
    difference: number;
    faster: boolean;
  } {
    const currentCorrected = this.calculateCorrectedTime({
      elapsed_seconds: elapsedSeconds,
      system_code: systemCode,
      rating: currentRating,
      distance_nm: distanceNm,
    });

    const newCorrected = this.calculateCorrectedTime({
      elapsed_seconds: elapsedSeconds,
      system_code: systemCode,
      rating: newRating,
      distance_nm: distanceNm,
    });

    return {
      currentCorrected,
      newCorrected,
      difference: newCorrected - currentCorrected,
      faster: newCorrected < currentCorrected,
    };
  }

  /**
   * Calculate rating needed to beat target time
   */
  ratingToWin(
    myElapsedSeconds: number,
    targetCorrectedSeconds: number,
    systemCode: string,
    baseRating: number = 550
  ): number | null {
    // For PHRF Time-on-Time:
    // targetCorrected = myElapsed × (650 / (550 + rating))
    // targetCorrected × (550 + rating) = myElapsed × 650
    // 550 + rating = (myElapsed × 650) / targetCorrected
    // rating = (myElapsed × 650) / targetCorrected - 550

    if (systemCode === 'PHRF' || systemCode === 'ORC' || systemCode === 'ORR') {
      const rating = (myElapsedSeconds * 650) / targetCorrectedSeconds - baseRating;
      return Math.round(rating);
    }

    return null;
  }

  // -------------------------------------------------------------------------
  // HELPERS
  // -------------------------------------------------------------------------

  /**
   * Parse PostgreSQL interval to seconds
   */
  private parseIntervalToSeconds(interval: string | null): number | null {
    if (!interval) return null;

    // Handle "HH:MM:SS" format
    const match = interval.match(/(\d+):(\d+):(\d+)/);
    if (match) {
      const hours = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      const seconds = parseInt(match[3]);
      return hours * 3600 + minutes * 60 + seconds;
    }

    // Handle PostgreSQL interval format
    const parts = interval.match(/(\d+)\s+(\w+)/g);
    if (!parts) return null;

    let totalSeconds = 0;
    for (const part of parts) {
      const [, num, unit] = part.match(/(\d+)\s+(\w+)/) || [];
      if (!num || !unit) continue;

      const value = parseInt(num);
      if (unit.startsWith('hour')) totalSeconds += value * 3600;
      else if (unit.startsWith('min')) totalSeconds += value * 60;
      else if (unit.startsWith('sec')) totalSeconds += value;
    }

    return totalSeconds || null;
  }

  /**
   * Format seconds to time string
   */
  formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.round(seconds % 60);

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  }

  /**
   * Format time delta
   */
  formatDelta(seconds: number): string {
    const sign = seconds >= 0 ? '+' : '-';
    const absSeconds = Math.abs(seconds);
    return `${sign}${this.formatTime(absSeconds)}`;
  }

  /**
   * Get system display info
   */
  getSystemInfo(code: string): {
    name: string;
    color: string;
    description: string;
  } {
    const systems: Record<string, { name: string; color: string; description: string }> = {
      PHRF: { name: 'PHRF', color: '#2563EB', description: 'Performance Handicap Racing Fleet' },
      PHRF_TOD: { name: 'PHRF ToD', color: '#3B82F6', description: 'PHRF Time on Distance' },
      IRC: { name: 'IRC', color: '#059669', description: 'International Rating Certificate' },
      ORC: { name: 'ORC', color: '#7C3AED', description: 'Offshore Racing Congress' },
      ORR: { name: 'ORR', color: '#8B5CF6', description: 'Offshore Racing Rule' },
      HANDICAP: { name: 'Club', color: '#6B7280', description: 'Club Handicap' },
    };
    return systems[code] || { name: code, color: '#6B7280', description: 'Custom System' };
  }
}

// Export singleton
export const handicapService = new HandicapService();
export default HandicapService;
