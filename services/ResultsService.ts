// @ts-nocheck

/**
 * Results Service
 * High-level service for managing race results and series standings
 * Integrates with ScoringEngine for calculations
 */

import { supabase } from './supabase';
import { ScoringEngine, ScoringConfiguration, SeriesStanding, DEFAULT_LOW_POINT_CONFIG } from './scoring/ScoringEngine';
import { createLogger } from '@/lib/utils/logger';
import { isMissingIdColumn } from '@/lib/utils/supabaseSchemaFallback';

export interface RegattaWithResults {
  id: string;
  name: string;
  start_date: Date;
  end_date: Date;
  venue: string;
  boat_classes: string[];
  divisions: string[];
  results_published: boolean;
  results_published_at?: Date;
}

export interface ResultsPublishingOptions {
  divisions?: string[];
  includeProvisional?: boolean;
  notifyParticipants?: boolean;
}

const logger = createLogger('ResultsService');
type RaceResultsIdColumn = 'regatta_id' | 'race_id';
export class ResultsService {
  private static async withRaceResultsIdFallback<T>(
    operation: (column: RaceResultsIdColumn) => Promise<{ data: T | null; error: any }>
  ): Promise<{ data: T | null; error: any }> {
    let result = await operation('regatta_id');
    if (result.error && isMissingIdColumn(result.error, 'race_results', 'regatta_id')) {
      result = await operation('race_id');
    }
    return result;
  }

  /**
   * Get scoring configuration for a regatta
   */
  static async getScoringConfiguration(
    regattaId: string,
    division?: string
  ): Promise<ScoringConfiguration> {
    const { data, error } = await supabase
      .from('scoring_configurations')
      .select('*')
      .eq('regatta_id', regattaId)
      .eq('division', division || null)
      .single();

    if (error || !data) {
      // Return default configuration if not found
      return DEFAULT_LOW_POINT_CONFIG;
    }

    return {
      system: data.system,
      discards: data.discards,
      use_corrected_time: data.use_corrected_time,
      exclude_dns_dnc_from_discard: data.exclude_dns_dnc_from_discard,
      first_place_points: data.first_place_points,
      scoring_penalties: data.scoring_penalties,
      tie_breaking_rules: data.tie_breaking_rules,
      custom_formula: data.custom_formula,
    };
  }

  /**
   * Calculate and save series standings
   */
  static async calculateStandings(
    regattaId: string,
    division?: string
  ): Promise<SeriesStanding[]> {
    // Get scoring configuration
    const config = await this.getScoringConfiguration(regattaId, division);

    // Initialize scoring engine
    const engine = new ScoringEngine(config);

    // Calculate standings
    const standings = await engine.calculateSeriesStandings(regattaId, division);

    return standings;
  }

  /**
   * Get current standings for a regatta
   */
  static async getStandings(
    regattaId: string,
    division?: string
  ): Promise<SeriesStanding[]> {
    const { data, error } = await supabase
      .from('series_standings')
      .select(`
        *,
        entry:entry_id (
          id,
          entry_number,
          sail_number,
          entry_class,
          division,
          sailor:sailor_id (
            id,
            full_name,
            club_name
          )
        )
      `)
      .eq('regatta_id', regattaId)
      .order('rank');

    if (error) throw error;

    // Filter by division if specified
    const filtered = division
      ? (data || []).filter(s => s.division === division)
      : (data || []);

    return filtered.map(s => ({
      rank: s.rank,
      entry: {
        entry_id: s.entry.id,
        entry_number: s.entry.entry_number || '',
        sailor_name: s.entry.sailor?.full_name || '',
        sail_number: s.entry.sail_number,
        boat_class: s.entry.entry_class,
        division: s.entry.division,
        club: s.entry.sailor?.club_name,
      },
      race_scores: s.race_scores || [],
      total_points: s.total_points,
      net_points: s.net_points,
      races_sailed: s.races_sailed,
      discards_used: s.discards_used,
      tied: s.tied,
      tie_breaker: s.tie_breaker,
    }));
  }

  /**
   * Publish results (make them public)
   */
  static async publishResults(
    regattaId: string,
    options: ResultsPublishingOptions = {}
  ): Promise<void> {
    const { divisions, notifyParticipants = true } = options;

    // Recalculate all divisions
    if (divisions && divisions.length > 0) {
      for (const division of divisions) {
        await this.calculateStandings(regattaId, division);
      }
    } else {
      // Calculate overall standings
      await this.calculateStandings(regattaId);
    }

    // Mark as published
    const { error } = await supabase
      .from('regattas')
      .update({
        results_published: true,
        results_published_at: new Date().toISOString(),
        results_published_by: (await supabase.auth.getUser()).data.user?.id,
      })
      .eq('id', regattaId);

    if (error) throw error;

    // Notify participants if requested
    if (notifyParticipants) {
      await this.notifyParticipants(regattaId);
    }
  }

  /**
   * Approve race results
   */
  static async approveRaceResults(
    regattaId: string,
    raceNumber: number
  ): Promise<void> {
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const { error } = await supabase
      .from('regatta_races')
      .update({
        results_approved: true,
        results_approved_by: userId,
        results_approved_at: new Date().toISOString(),
      })
      .eq('regatta_id', regattaId)
      .eq('race_number', raceNumber);

    if (error) throw error;

    // Recalculate series standings after approval
    await this.calculateStandings(regattaId);
  }

  /**
   * Get regatta races
   */
  static async getRaces(regattaId: string) {
    const { data, error } = await supabase
      .from('regatta_races')
      .select('*')
      .eq('regatta_id', regattaId)
      .order('race_number');

    if (error) throw error;
    return data || [];
  }

  /**
   * Get race results
   */
  static async getRaceResults(regattaId: string, raceNumber: number) {
    const { data, error } = await this.withRaceResultsIdFallback((column) =>
      supabase
        .from('race_results')
        .select(`
          *,
          entry:entry_id (
            entry_number,
            sail_number,
            entry_class,
            sailor:sailor_id (
              full_name,
              club_name
            )
          )
        `)
        .eq(column, regattaId)
        .eq('race_number', raceNumber)
        .order('finish_position')
    );

    if (error) throw error;
    return data || [];
  }

  /**
   * Export results to various formats
   */
  static async exportResults(
    regattaId: string,
    format: 'csv' | 'pdf' | 'sailwave' | 'json'
  ): Promise<string | Blob> {
    const standings = await this.getStandings(regattaId);

    switch (format) {
      case 'csv':
        return this.exportToCSV(standings);
      case 'sailwave':
        return this.exportToSailwave(regattaId);
      case 'json':
        return JSON.stringify(standings, null, 2);
      case 'pdf':
        return this.exportToPDF(standings);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Export to CSV format
   */
  private static exportToCSV(standings: SeriesStanding[]): string {
    let csv = 'Rank,Sail Number,Name,Club,Total Points,Net Points,';

    // Add race columns
    if (standings.length > 0) {
      const races = standings[0].race_scores.length;
      for (let i = 1; i <= races; i++) {
        csv += `R${i},`;
      }
    }
    csv += '\n';

    // Add data rows
    for (const s of standings) {
      csv += `${s.rank},${s.entry.sail_number},"${s.entry.sailor_name}",`;
      csv += `"${s.entry.club || ''}",${s.total_points},${s.net_points},`;

      for (const score of s.race_scores) {
        const display = score.excluded
          ? `(${score.points})`
          : score.score_code || score.points.toString();
        csv += `${display},`;
      }
      csv += '\n';
    }

    return csv;
  }

  /**
   * Export to Sailwave format
   */
  private static async exportToSailwave(regattaId: string): Promise<string> {
    const config = await this.getScoringConfiguration(regattaId);
    const engine = new ScoringEngine(config);
    return await engine.exportToSailwave(regattaId);
  }

  /**
   * Export to PDF format
   */
  private static async exportToPDF(_standings: SeriesStanding[]): Promise<Blob> {
    // This would generate a PDF using a library like jsPDF
    // For now, return a placeholder
    throw new Error('PDF export not yet implemented');
  }

  /**
   * Import results from Sailwave
   */
  static async importFromSailwave(
    regattaId: string,
    file: File
  ): Promise<void> {
    // Read file content
    const content = await file.text();

    // Track import
    const { data: importRecord, error: importError } = await supabase
      .from('sailwave_imports')
      .insert({
        regatta_id: regattaId,
        file_name: file.name,
        file_size: file.size,
        status: 'processing',
        imported_by: (await supabase.auth.getUser()).data.user?.id,
      })
      .select()
      .single();

    if (importError) throw importError;

    try {
      // Parse and import
      const config = await this.getScoringConfiguration(regattaId);
      const engine = new ScoringEngine(config);
      await engine.importFromSailwave(regattaId, content);

      // Mark as completed
      await supabase
        .from('sailwave_imports')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', importRecord.id);
    } catch (error) {
      // Mark as failed
      await supabase
        .from('sailwave_imports')
        .update({
          status: 'failed',
          errors: [{ message: String(error) }],
        })
        .eq('id', importRecord.id);

      throw error;
    }
  }

  /**
   * Notify participants of published results
   */
  private static async notifyParticipants(regattaId: string): Promise<void> {
    try {
      // Get all participants
      const { data: entries, error: entriesError } = await supabase
        .from('race_entries')
        .select('sailor_id, sailor:sailor_id(email)')
        .eq('regatta_id', regattaId)
        .eq('status', 'confirmed');

      if (entriesError) {
        throw entriesError;
      }
      if (!entries || entries.length === 0) return;

      // Get regatta info
      const { data: regatta, error: regattaError } = await supabase
        .from('regattas')
        .select('name, venue')
        .eq('id', regattaId)
        .single();

      if (regattaError || !regatta) {
        throw regattaError || new Error('Regatta not found');
      }

      const participantIds = Array.from(
        new Set(
          entries
            .map((entry: any) => entry?.sailor_id)
            .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
        )
      );

      if (participantIds.length === 0) return;

      const message = `${regatta.name} results are now published${regatta.venue ? ` for ${regatta.venue}` : ''}.`;
      const payload = participantIds.map((userId) => ({
        user_id: userId,
        type: 'results_published',
        title: 'Results Published',
        message,
        data: {
          regatta_id: regattaId,
          regatta_name: regatta.name,
          venue: regatta.venue || null,
        },
        read: false,
      }));

      const notifyResult = await supabase
        .from('notifications')
        .insert(payload);

      if (notifyResult.error) {
        // Fallback schema for social notifications in newer builds.
        // RLS requires actor_id = auth.uid(), so attribute to the publisher.
        const { data: auth } = await supabase.auth.getUser();
        const publisherId = auth?.user?.id ?? null;
        const fallbackPayload = participantIds.map((userId) => ({
          user_id: userId,
          type: 'race_result_posted',
          actor_id: publisherId,
          regatta_id: regattaId,
          title: 'Results Published',
          body: message,
        }));

        const fallback = await supabase
          .from('social_notifications')
          .insert(fallbackPayload);

        if (fallback.error) {
          throw fallback.error;
        }
      }

      logger.debug(`Created result notifications for ${participantIds.length} participants`, {
        regattaId,
        regattaName: regatta.name,
      });
    } catch (error) {
      // Best-effort path: notification failure should not block publishing.
      logger.warn('Failed to notify participants after results publication', {
        regattaId,
        error,
      });
    }
  }

  /**
   * Get regatta info with results metadata
   */
  static async getRegattaWithResults(regattaId: string): Promise<RegattaWithResults | null> {
    const { data, error } = await supabase
      .from('regattas')
      .select(`
        id,
        name,
        start_date,
        end_date,
        venue,
        boat_classes,
        results_published,
        results_published_at
      `)
      .eq('id', regattaId)
      .single();

    if (error || !data) return null;

    // Get divisions from entries
    const { data: entries } = await supabase
      .from('race_entries')
      .select('division')
      .eq('regatta_id', regattaId);

    const divisions = [...new Set((entries || []).map((entry: { division: string | null }) => entry.division).filter(Boolean))];

    return {
      id: data.id,
      name: data.name,
      start_date: new Date(data.start_date),
      end_date: new Date(data.end_date),
      venue: data.venue,
      boat_classes: data.boat_classes || [],
      divisions,
      results_published: data.results_published,
      results_published_at: data.results_published_at ? new Date(data.results_published_at) : undefined,
    };
  }

  /**
   * Get results summary for dashboard
   */
  static async getResultsSummary(regattaId: string) {
    const races = await this.getRaces(regattaId);
    const standings = await this.getStandings(regattaId);

    const completedRaces = races.filter((race: { status: string }) => race.status === 'completed').length;
    const totalRaces = races.length;
    const totalEntries = standings.length;

    return {
      completedRaces,
      totalRaces,
      totalEntries,
      progressPercentage: totalRaces > 0 ? (completedRaces / totalRaces) * 100 : 0,
      standings: standings.slice(0, 5), // Top 5
    };
  }
}

export default ResultsService;
