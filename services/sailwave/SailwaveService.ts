/**
 * Sailwave Integration Service
 *
 * High-level service for importing and exporting Sailwave .BLW files.
 * Handles the conversion between Sailwave data structures and BetterAt's
 * database schema.
 */

import { supabase } from '@/services/supabase';
import { isMissingIdColumn } from '@/lib/utils/supabaseSchemaFallback';
import { BLWParser, SailwaveData, Competitor, Race, RaceResult, ScoringConfig } from './BLWParser';
import { BLWGenerator } from './BLWGenerator';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('SailwaveService');

// ============================================================================
// Types
// ============================================================================

export interface ImportOptions {
  /** User ID performing the import */
  userId: string;
  /** Optional championship to associate with */
  championshipId?: string;
  /** Optional club to associate with */
  clubId?: string;
  /** Whether to overwrite existing data if sail numbers match */
  overwriteExisting?: boolean;
}

export interface ImportResult {
  success: boolean;
  regattaId?: string;
  warnings: string[];
  errors: string[];
  stats: {
    competitors: number;
    races: number;
    results: number;
    skipped: number;
  };
}

export interface ExportOptions {
  /** Include all races, or only completed */
  includeAllRaces?: boolean;
  /** Include competitor notes */
  includeNotes?: boolean;
}

export interface ExportResult {
  success: boolean;
  content?: string;
  blob?: Blob;
  filename?: string;
  errors: string[];
}

// ============================================================================
// Service Class
// ============================================================================

export class SailwaveService {
  private parser: BLWParser;
  private generator: BLWGenerator;

  constructor() {
    this.parser = new BLWParser();
    this.generator = new BLWGenerator();
  }

  // ==========================================================================
  // Import Methods
  // ==========================================================================

  /**
   * Import a Sailwave .BLW file and create a regatta with all associated data
   */
  async importBLW(file: File | string, options: ImportOptions): Promise<ImportResult> {
    const warnings: string[] = [];
    const errors: string[] = [];
    let content: string;

    try {
      // Get file content
      if (typeof file === 'string') {
        content = file;
      } else {
        content = await file.text();
      }

      // Validate the file
      const validation = this.parser.validate(content);
      warnings.push(...validation.warnings);
      if (!validation.valid) {
        errors.push(...validation.errors);
        return {
          success: false,
          warnings,
          errors,
          stats: { competitors: 0, races: 0, results: 0, skipped: 0 },
        };
      }

      // Parse BLW
      const data = this.parser.parse(content);

      // Create regatta
      const regattaResult = await this.createRegatta(data, options);
      if (!regattaResult.success || !regattaResult.regattaId) {
        errors.push(...regattaResult.errors);
        return {
          success: false,
          warnings,
          errors,
          stats: { competitors: 0, races: 0, results: 0, skipped: 0 },
        };
      }

      const regattaId = regattaResult.regattaId;

      // Import competitors
      const competitorResult = await this.importCompetitors(data.competitors, regattaId, options);
      warnings.push(...competitorResult.warnings);
      errors.push(...competitorResult.errors);

      // Import races
      const raceResult = await this.importRaces(data.races, regattaId);
      warnings.push(...raceResult.warnings);
      errors.push(...raceResult.errors);

      // Import results
      const resultsResult = await this.importResults(
        data.results,
        regattaId,
        competitorResult.idMap,
        raceResult.idMap
      );
      warnings.push(...resultsResult.warnings);
      errors.push(...resultsResult.errors);

      return {
        success: errors.length === 0,
        regattaId,
        warnings,
        errors,
        stats: {
          competitors: competitorResult.count,
          races: raceResult.count,
          results: resultsResult.count,
          skipped: competitorResult.skipped + raceResult.skipped + resultsResult.skipped,
        },
      };
    } catch (error) {
      errors.push(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        success: false,
        warnings,
        errors,
        stats: { competitors: 0, races: 0, results: 0, skipped: 0 },
      };
    }
  }

  /**
   * Import from a File object (for use with file picker)
   */
  async importFromFile(file: File, options: ImportOptions): Promise<ImportResult> {
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.blw')) {
      return {
        success: false,
        warnings: [],
        errors: ['File must have .blw extension'],
        stats: { competitors: 0, races: 0, results: 0, skipped: 0 },
      };
    }

    return this.importBLW(file, options);
  }

  // ==========================================================================
  // Export Methods
  // ==========================================================================

  /**
   * Export a regatta to Sailwave .BLW format
   */
  async exportBLW(regattaId: string, options: ExportOptions = {}): Promise<ExportResult> {
    const errors: string[] = [];

    try {
      // Fetch regatta with all related data
      const { data: regatta, error: regattaError } = await supabase
        .from('regattas')
        .select(
          `
          *,
          regatta_entries (*),
          regatta_races (
            *,
            race_results (*)
          )
        `
        )
        .eq('id', regattaId)
        .single();

      if (regattaError || !regatta) {
        errors.push(`Failed to fetch regatta: ${regattaError?.message || 'Not found'}`);
        return { success: false, errors };
      }

      // Check if we have stored raw Sailwave data for round-trip
      const storedData = regatta.sailwave_raw as SailwaveData | null;

      // Build SailwaveData structure
      const data = this.buildSailwaveData(regatta, storedData, options);

      // Generate BLW content
      const content = this.generator.generate(data);
      const blob = this.generator.generateBlob(data);
      const filename = this.generator.generateFilename(data);

      return {
        success: true,
        content,
        blob,
        filename,
        errors,
      };
    } catch (error) {
      errors.push(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { success: false, errors };
    }
  }

  /**
   * Export and trigger download in browser
   */
  async downloadBLW(regattaId: string, options: ExportOptions = {}): Promise<boolean> {
    const result = await this.exportBLW(regattaId, options);

    if (!result.success || !result.blob || !result.filename) {
      logger.error('Export failed:', result.errors);
      return false;
    }

    // Create download link
    const url = URL.createObjectURL(result.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return true;
  }

  // ==========================================================================
  // Private Methods - Import Helpers
  // ==========================================================================

  private async createRegatta(
    data: SailwaveData,
    options: ImportOptions
  ): Promise<{ success: boolean; regattaId?: string; errors: string[] }> {
    const errors: string[] = [];

    const { data: regatta, error: regattaError } = await supabase
      .from('regattas')
      .insert({
        name: data.event.name,
        start_date: data.event.startDate.toISOString(),
        end_date: data.event.endDate.toISOString(),
        venue_name: data.event.venue,
        organizing_club: data.event.organizingClub,
        boat_class: data.event.boatClass,
        notes: data.event.notes,
        championship_id: options.championshipId || null,
        club_id: options.clubId || null,
        created_by: options.userId,
        scoring_config: this.mapScoringConfigToRegattaFlow(data.scoring, data.discards),
        sailwave_import: true,
        sailwave_raw: data, // Store raw data for perfect round-trip
      })
      .select()
      .single();

    if (regattaError) {
      errors.push(`Failed to create regatta: ${regattaError.message}`);
      return { success: false, errors };
    }

    return { success: true, regattaId: regatta.id, errors };
  }

  private async importCompetitors(
    competitors: Competitor[],
    regattaId: string,
    options: ImportOptions
  ): Promise<{
    count: number;
    skipped: number;
    warnings: string[];
    errors: string[];
    idMap: Map<number, string>;
  }> {
    const warnings: string[] = [];
    const errors: string[] = [];
    const idMap = new Map<number, string>(); // Sailwave ID -> BetterAt ID
    let count = 0;
    let skipped = 0;

    for (const comp of competitors) {
      try {
        const { data: entry, error: entryError } = await supabase
          .from('regatta_entries')
          .insert({
            regatta_id: regattaId,
            sail_number: comp.sailNumber,
            boat_class: comp.boatClass,
            fleet: comp.fleet,
            division: comp.division,
            helm_name: comp.helmName,
            crew_name: comp.crewName,
            club: comp.club,
            nationality: comp.nationality,
            rating: comp.rating,
            rating_system: comp.ratingSystem,
            excluded: comp.excluded,
            notes: comp.notes,
            sailwave_id: comp.id,
          })
          .select()
          .single();

        if (entryError) {
          warnings.push(`Failed to import competitor ${comp.sailNumber}: ${entryError.message}`);
          skipped++;
        } else {
          idMap.set(comp.id, entry.id);
          count++;
        }
      } catch (error) {
        warnings.push(
          `Error importing competitor ${comp.sailNumber}: ${error instanceof Error ? error.message : 'Unknown'}`
        );
        skipped++;
      }
    }

    return { count, skipped, warnings, errors, idMap };
  }

  private async importRaces(
    races: Race[],
    regattaId: string
  ): Promise<{
    count: number;
    skipped: number;
    warnings: string[];
    errors: string[];
    idMap: Map<number, string>;
  }> {
    const warnings: string[] = [];
    const errors: string[] = [];
    const idMap = new Map<number, string>(); // Sailwave ID -> BetterAt ID
    let count = 0;
    let skipped = 0;

    for (const race of races) {
      try {
        const startTime = race.time
          ? `${race.date.toISOString().split('T')[0]}T${race.time}:00Z`
          : null;

        const { data: raceRecord, error: raceError } = await supabase
          .from('regatta_races')
          .insert({
            regatta_id: regattaId,
            race_number: race.rank,
            race_name: race.name,
            race_date: race.date.toISOString().split('T')[0],
            start_time: startTime,
            status: this.mapRaceStatusToRegattaFlow(race.status),
            notes: race.notes,
            wind_direction: race.windDirection,
            wind_speed_avg: race.windSpeed,
            sailwave_id: race.id,
          })
          .select()
          .single();

        if (raceError) {
          warnings.push(`Failed to import race ${race.name}: ${raceError.message}`);
          skipped++;
        } else {
          idMap.set(race.id, raceRecord.id);
          count++;
        }
      } catch (error) {
        warnings.push(
          `Error importing race ${race.name}: ${error instanceof Error ? error.message : 'Unknown'}`
        );
        skipped++;
      }
    }

    return { count, skipped, warnings, errors, idMap };
  }

  private async importResults(
    results: RaceResult[],
    regattaId: string,
    competitorIdMap: Map<number, string>,
    raceIdMap: Map<number, string>
  ): Promise<{
    count: number;
    skipped: number;
    warnings: string[];
    errors: string[];
  }> {
    const warnings: string[] = [];
    const errors: string[] = [];
    let count = 0;
    let skipped = 0;

    for (const result of results) {
      const raceId = raceIdMap.get(result.raceId);
      const entryId = competitorIdMap.get(result.competitorId);

      if (!raceId) {
        warnings.push(`Skipping result: unknown race ID ${result.raceId}`);
        skipped++;
        continue;
      }

      if (!entryId) {
        warnings.push(`Skipping result: unknown competitor ID ${result.competitorId}`);
        skipped++;
        continue;
      }

      try {
        const basePayload = {
          entry_id: entryId,
          finish_position: result.position,
          elapsed_time: result.elapsedTime,
          corrected_time: result.correctedTime,
          score_code: result.statusCode || null,
          points: result.points,
          notes: result.notes,
          penalty_code: result.penalty,
          redress_given: result.redress,
          redress_position: result.redressPosition,
          sailwave_id: result.id,
        };

        let { error: resultError } = await supabase.from('race_results').insert({
          race_id: raceId,
          ...basePayload,
        });

        if (isMissingIdColumn(resultError, 'race_results', 'race_id')) {
          const { data: raceRecord, error: raceLookupError } = await supabase
            .from('regatta_races')
            .select('race_number')
            .eq('id', raceId)
            .maybeSingle();

          if (raceLookupError || !raceRecord?.race_number) {
            warnings.push(
              `Failed to import result: could not resolve race_number fallback (${raceLookupError?.message || 'missing race'})`
            );
            skipped++;
            continue;
          }

          const fallbackInsert = await supabase.from('race_results').insert({
            regatta_id: regattaId,
            race_number: raceRecord.race_number,
            ...basePayload,
          });
          resultError = fallbackInsert.error;
        }

        if (resultError) {
          warnings.push(`Failed to import result: ${resultError.message}`);
          skipped++;
        } else {
          count++;
        }
      } catch (error) {
        warnings.push(
          `Error importing result: ${error instanceof Error ? error.message : 'Unknown'}`
        );
        skipped++;
      }
    }

    return { count, skipped, warnings, errors };
  }

  // ==========================================================================
  // Private Methods - Export Helpers
  // ==========================================================================

  private buildSailwaveData(
    regatta: any,
    storedData: SailwaveData | null,
    options: ExportOptions
  ): SailwaveData {
    const entries = regatta.regatta_entries || [];
    const races = regatta.regatta_races || [];

    // Use stored data as base if available (for round-trip fidelity)
    const baseSeries = storedData?.series || { name: regatta.name };
    const baseEvent = storedData?.event || {
      name: regatta.name,
      startDate: new Date(regatta.start_date),
      endDate: new Date(regatta.end_date),
      venue: regatta.venue_name || '',
      organizingClub: regatta.organizing_club || '',
      boatClass: regatta.boat_class,
    };

    return {
      series: baseSeries,
      event: {
        ...baseEvent,
        name: regatta.name,
        startDate: new Date(regatta.start_date),
        endDate: new Date(regatta.end_date),
        venue: regatta.venue_name || '',
        organizingClub: regatta.organizing_club || '',
        boatClass: regatta.boat_class,
        notes: options.includeNotes ? regatta.notes : undefined,
      },
      scoring: this.mapRegattaFlowScoringToSailwave(regatta.scoring_config),
      discards: this.extractDiscards(regatta.scoring_config),
      fleets: storedData?.fleets || [],
      divisions: storedData?.divisions || [],
      competitors: entries.map((entry: any, index: number) => ({
        id: entry.sailwave_id || index + 1,
        sailNumber: entry.sail_number,
        boatClass: entry.boat_class,
        fleet: entry.fleet,
        division: entry.division,
        helmName: entry.helm_name,
        crewName: entry.crew_name,
        club: entry.club,
        nationality: entry.nationality,
        rating: entry.rating,
        ratingSystem: entry.rating_system,
        excluded: entry.excluded,
        notes: options.includeNotes ? entry.notes : undefined,
      })),
      races: races
        .filter((race: any) => options.includeAllRaces || race.status === 'completed')
        .map((race: any) => ({
          id: race.sailwave_id || race.race_number,
          date: new Date(race.race_date),
          time: race.start_time ? new Date(race.start_time).toTimeString().slice(0, 5) : undefined,
          name: race.race_name || `Race ${race.race_number}`,
          rank: race.race_number,
          status: this.mapRegattaFlowStatusToSailwave(race.status),
          notes: options.includeNotes ? race.notes : undefined,
          windDirection: race.wind_direction,
          windSpeed: race.wind_speed_avg,
        })),
      results: this.flattenResults(races, entries, options),
      raw: storedData?.raw || [],
    };
  }

  private flattenResults(races: any[], entries: any[], options: ExportOptions): RaceResult[] {
    const results: RaceResult[] = [];
    let resultId = 1;

    // Build entry ID to Sailwave ID map
    const entryIdToSailwaveId = new Map<string, number>();
    entries.forEach((entry: any, index: number) => {
      entryIdToSailwaveId.set(entry.id, entry.sailwave_id || index + 1);
    });

    for (const race of races) {
      if (!options.includeAllRaces && race.status !== 'completed') continue;

      for (const result of race.race_results || []) {
        results.push({
          id: result.sailwave_id || resultId++,
          raceId: race.sailwave_id || race.race_number,
          competitorId: entryIdToSailwaveId.get(result.entry_id) || 0,
          position: result.finish_position,
          elapsedTime: result.elapsed_time,
          correctedTime: result.corrected_time,
          statusCode: result.score_code,
          points: result.points || 0,
          notes: options.includeNotes ? result.notes : undefined,
          penalty: result.penalty_code,
          redress: result.redress_given,
          redressPosition: result.redress_position,
        });
      }
    }

    return results;
  }

  // ==========================================================================
  // Private Methods - Data Mapping
  // ==========================================================================

  private mapScoringConfigToRegattaFlow(
    scoring: ScoringConfig,
    discards: number[]
  ): Record<string, any> {
    return {
      system: scoring.system,
      system_code: scoring.systemCode,
      system_name: scoring.systemName,
      dnf_points: scoring.dnfValue,
      dnc_points: scoring.dncValue,
      dsq_points: scoring.dsqValue,
      dne_points: scoring.dneValue,
      ocs_points: scoring.ocsValue,
      zfp_penalty: scoring.zfpPenalty,
      bfd_points: scoring.bfdValue,
      scp_penalty: scoring.scpPenalty,
      discards: this.discardArrayToConfig(discards),
    };
  }

  private mapRegattaFlowScoringToSailwave(config: any): ScoringConfig {
    return {
      system: config?.system || 'low-point',
      systemCode: config?.system_code || (config?.system === 'high-point' ? 'rrs-hp' : 'rrs-lp'),
      systemName:
        config?.system_name ||
        (config?.system === 'high-point' ? 'RRS High Point' : 'RRS Low Point 2021-2024'),
      dnfValue: config?.dnf_points || 'n+1',
      dncValue: config?.dnc_points || 'n+1',
      dsqValue: config?.dsq_points || 'n+1',
      dneValue: config?.dne_points || 'n+1',
      ocsValue: config?.ocs_points || 'n+1',
      zfpPenalty: config?.zfp_penalty || '20%',
      bfdValue: config?.bfd_points || 'n+1',
      ufpValue: config?.ufp_points || 'n+1',
      scpPenalty: config?.scp_penalty || 'n+1',
      retValue: config?.ret_points || 'n+1',
      rafValue: config?.raf_points || 'n+1',
    };
  }

  private discardArrayToConfig(discards: number[]): { after_races: number; discards: number }[] {
    const config: { after_races: number; discards: number }[] = [];
    let lastDiscard = 0;

    for (let i = 0; i < discards.length; i++) {
      if (discards[i] !== lastDiscard) {
        config.push({ after_races: i, discards: discards[i] });
        lastDiscard = discards[i];
      }
    }

    // If no discards specified, add default
    if (config.length === 0) {
      config.push({ after_races: 0, discards: 0 });
    }

    return config;
  }

  private extractDiscards(config: any): number[] {
    const discards: number[] = [];
    const discardConfig = config?.discards || [];

    for (let i = 0; i < 20; i++) {
      let discardsForRace = 0;
      for (const rule of discardConfig) {
        if (i >= rule.after_races) {
          discardsForRace = rule.discards;
        }
      }
      discards.push(discardsForRace);
    }

    return discards;
  }

  private mapRaceStatusToRegattaFlow(status: string): string {
    const map: Record<string, string> = {
      sailed: 'completed',
      abandoned: 'abandoned',
      cancelled: 'cancelled',
      scheduled: 'scheduled',
    };
    return map[status] || 'scheduled';
  }

  private mapRegattaFlowStatusToSailwave(
    status: string
  ): 'sailed' | 'abandoned' | 'cancelled' | 'scheduled' {
    const map: Record<string, 'sailed' | 'abandoned' | 'cancelled' | 'scheduled'> = {
      completed: 'sailed',
      abandoned: 'abandoned',
      cancelled: 'cancelled',
      scheduled: 'scheduled',
      started: 'sailed',
      in_progress: 'sailed',
    };
    return map[status] || 'scheduled';
  }
}

// Export singleton instance
export const sailwaveService = new SailwaveService();
