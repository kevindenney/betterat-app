/**
 * Season Service
 *
 * CRUD operations and business logic for seasons.
 * Handles season management, standings computation, and archive operations.
 */

import { supabase } from './supabase';
import { createLogger } from '@/lib/utils/logger';
import type {
  Season,
  SeasonWithSummary,
  SeasonSummary,
  SeasonStatus,
  SeasonStanding,
  SeasonRegatta,
  CreateSeasonInput,
  UpdateSeasonInput,
  SeasonListItem,
  RaceResult,
  RegattaResult,
} from '@/types/season';

const logger = createLogger('SeasonService');

// =============================================================================
// ROW MAPPERS
// =============================================================================

function mapSeasonRow(row: any): Season {
  return {
    id: row.id,
    name: row.name,
    short_name: row.short_name,
    year: row.year,
    year_end: row.year_end,
    user_id: row.user_id,
    club_id: row.club_id,
    start_date: row.start_date,
    end_date: row.end_date,
    status: row.status as SeasonStatus,
    scoring_rules: row.scoring_rules,
    discard_rules: row.discard_rules,
    description: row.description,
    vision_statement: row.vision_statement ?? null,
    vision_competency_ids: Array.isArray(row.vision_competency_ids)
      ? (row.vision_competency_ids as string[])
      : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapSeasonStandingRow(row: any): SeasonStanding {
  return {
    id: row.id,
    season_id: row.season_id,
    user_id: row.user_id,
    entry_id: row.entry_id,
    sailor_name: row.sailor_name,
    boat_name: row.boat_name,
    sail_number: row.sail_number,
    division: row.division,
    fleet: row.fleet,
    rank: row.rank,
    total_points: row.total_points,
    net_points: row.net_points,
    races_sailed: row.races_sailed,
    races_counted: row.races_counted,
    regatta_results: row.regatta_results || [],
    race_results: row.race_results || [],
    discards: row.discards || [],
    wins: row.wins,
    podiums: row.podiums,
    best_finish: row.best_finish,
    worst_finish: row.worst_finish,
    computed_at: row.computed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapSeasonRegattaRow(row: any): SeasonRegatta {
  return {
    id: row.id,
    season_id: row.season_id,
    regatta_id: row.regatta_id,
    sequence: row.sequence,
    weight: row.weight,
    is_championship: row.is_championship,
    created_at: row.created_at,
    regatta: row.regattas ? {
      id: row.regattas.id,
      name: row.regattas.name,
      start_date: row.regattas.start_date,
      end_date: row.regattas.end_date,
      status: row.regattas.status,
      club_id: row.regattas.club_id,
    } : undefined,
  };
}

// =============================================================================
// SEASON SERVICE CLASS
// =============================================================================

class SeasonServiceClass {
  // ===========================================================================
  // CRUD OPERATIONS
  // ===========================================================================

  /**
   * Create a new season
   */
  async createSeason(input: CreateSeasonInput, userId: string): Promise<Season> {
    logger.info('[SeasonService] Creating season', { name: input.name, userId });

    const { data, error } = await supabase
      .from('seasons')
      .insert({
        name: input.name,
        short_name: input.short_name,
        year: input.year,
        year_end: input.year_end,
        user_id: userId,
        club_id: input.club_id,
        start_date: input.start_date,
        end_date: input.end_date,
        status: 'active',
        description: input.description,
        scoring_rules: input.scoring_rules,
        discard_rules: input.discard_rules,
      })
      .select()
      .single();

    if (error) {
      logger.error('[SeasonService] Failed to create season', { error });
      throw new Error(`Failed to create season: ${error.message}`);
    }

    return mapSeasonRow(data);
  }

  /**
   * Get a season by ID
   */
  async getSeason(seasonId: string): Promise<Season | null> {
    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .eq('id', seasonId)
      .maybeSingle();

    if (error) {
      logger.error('[SeasonService] Failed to get season', { seasonId, error });
      throw new Error(`Failed to get season: ${error.message}`);
    }

    return data ? mapSeasonRow(data) : null;
  }

  /**
   * Update a season
   */
  async updateSeason(seasonId: string, input: UpdateSeasonInput): Promise<Season> {
    logger.info('[SeasonService] Updating season', { seasonId });

    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.short_name !== undefined) updateData.short_name = input.short_name;
    if (input.start_date !== undefined) updateData.start_date = input.start_date;
    if (input.end_date !== undefined) updateData.end_date = input.end_date;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.scoring_rules !== undefined) updateData.scoring_rules = input.scoring_rules;
    if (input.discard_rules !== undefined) updateData.discard_rules = input.discard_rules;
    if (input.vision_statement !== undefined) updateData.vision_statement = input.vision_statement;
    if (input.vision_competency_ids !== undefined)
      updateData.vision_competency_ids = input.vision_competency_ids;

    const { data, error } = await supabase
      .from('seasons')
      .update(updateData)
      .eq('id', seasonId)
      .select()
      .single();

    if (error) {
      logger.error('[SeasonService] Failed to update season', { seasonId, error });
      throw new Error(`Failed to update season: ${error.message}`);
    }

    return mapSeasonRow(data);
  }

  /**
   * Delete a season
   */
  async deleteSeason(seasonId: string): Promise<void> {
    logger.info('[SeasonService] Deleting season', { seasonId });

    const { error } = await supabase
      .from('seasons')
      .delete()
      .eq('id', seasonId);

    if (error) {
      logger.error('[SeasonService] Failed to delete season', { seasonId, error });
      throw new Error(`Failed to delete season: ${error.message}`);
    }
  }

  /**
   * Archive a season (change status to 'archived')
   */
  async archiveSeason(seasonId: string): Promise<Season> {
    return this.updateSeason(seasonId, { status: 'archived' });
  }

  // ===========================================================================
  // QUERY OPERATIONS
  // ===========================================================================

  /**
   * Get current active season for a user
   */
  async getCurrentSeason(userId: string): Promise<SeasonWithSummary | null> {
    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('start_date', { ascending: false })
      // Tie-break same-day arcs by recency so a just-created arc becomes
      // current (the timeline auto-switches to it on create).
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error('[SeasonService] Failed to get current season', { userId, error });
      throw new Error(`Failed to get current season: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    const season = mapSeasonRow(data);
    const summary = await this.getSeasonSummary(season.id, userId);

    return {
      ...season,
      summary,
    };
  }

  /**
   * Get all seasons for a user (for archive view)
   */
  async getUserSeasons(userId: string, options?: {
    status?: SeasonStatus | SeasonStatus[];
    limit?: number;
    offset?: number;
  }): Promise<SeasonListItem[]> {
    let query = supabase
      .from('seasons')
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: false });

    if (options?.status) {
      if (Array.isArray(options.status)) {
        query = query.in('status', options.status);
      } else {
        query = query.eq('status', options.status);
      }
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to get user seasons:', error.message, { userId, code: error.code, details: error.details });
      throw new Error(`Failed to get user seasons: ${error.message}`);
    }

    // Fetch counts for each season
    const seasons = await Promise.all(
      (data || []).map(async (row) => {
        const season = mapSeasonRow(row);
        const counts = await this.getSeasonCounts(season.id);
        const standing = await this.getUserStanding(season.id, userId);

        return {
          id: season.id,
          name: season.name,
          short_name: season.short_name,
          year: season.year,
          status: season.status,
          start_date: season.start_date,
          end_date: season.end_date,
          regatta_count: counts.regattaCount,
          race_count: counts.raceCount,
          completed_count: counts.completedCount,
          user_position: standing?.rank ?? null,
          user_points: standing?.net_points ?? null,
        } as SeasonListItem;
      })
    );

    return seasons;
  }

  /**
   * Get archived seasons for a user
   */
  async getArchivedSeasons(userId: string): Promise<SeasonListItem[]> {
    return this.getUserSeasons(userId, { status: 'archived' });
  }

  /**
   * Get seasons for a club
   */
  async getClubSeasons(clubId: string, options?: {
    status?: SeasonStatus | SeasonStatus[];
  }): Promise<Season[]> {
    let query = supabase
      .from('seasons')
      .select('*')
      .eq('club_id', clubId)
      .order('start_date', { ascending: false });

    if (options?.status) {
      if (Array.isArray(options.status)) {
        query = query.in('status', options.status);
      } else {
        query = query.eq('status', options.status);
      }
    }

    const { data, error } = await query;

    if (error) {
      logger.error('[SeasonService] Failed to get club seasons', { clubId, error });
      throw new Error(`Failed to get club seasons: ${error.message}`);
    }

    return (data || []).map(mapSeasonRow);
  }

  // ===========================================================================
  // SEASON SUMMARY
  // ===========================================================================

  /**
   * Get summary stats for a season
   */
  async getSeasonSummary(seasonId: string, userId?: string): Promise<SeasonSummary> {
    const counts = await this.getSeasonCounts(seasonId);

    let userStanding: SeasonSummary['user_standing'] | undefined;
    let results: (number | null)[] | undefined;

    if (userId) {
      const standing = await this.getUserStanding(seasonId, userId);
      if (standing) {
        userStanding = {
          rank: standing.rank,
          total_entries: await this.getSeasonEntryCount(seasonId),
          net_points: standing.net_points,
          wins: standing.wins,
          podiums: standing.podiums,
          best_finish: standing.best_finish,
        };

        // Extract results sequence for sparkline
        results = standing.race_results.map((r: RaceResult) => r.position);
      }
    }

    return {
      regatta_count: counts.regattaCount,
      total_races: counts.raceCount,
      completed_races: counts.completedCount,
      upcoming_races: counts.raceCount - counts.completedCount,
      user_standing: userStanding,
      results,
    };
  }

  /**
   * Get race/regatta counts for a season
   */
  private async getSeasonCounts(seasonId: string): Promise<{
    regattaCount: number;
    raceCount: number;
    completedCount: number;
  }> {
    // Get all regattas in this season with their status
    const { data: seasonRegattas } = await supabase
      .from('season_regattas')
      .select('regatta_id, regattas!inner(id, status)')
      .eq('season_id', seasonId);

    const regattaCount = seasonRegattas?.length || 0;

    // Count regattas by status (each regatta counts as 1 race for now)
    let regattaRaceCount = 0;
    let regattaCompletedCount = 0;

    if (seasonRegattas && seasonRegattas.length > 0) {
      for (const sr of seasonRegattas) {
        const regatta = sr.regattas as any;
        regattaRaceCount++;
        if (regatta?.status === 'completed') {
          regattaCompletedCount++;
        }
      }
    }

    // Also count personal race_events in this season
    const { count: personalRaceCount } = await supabase
      .from('race_events')
      .select('*', { count: 'exact', head: true })
      .eq('season_id', seasonId);

    const { count: personalCompletedCount } = await supabase
      .from('race_events')
      .select('*', { count: 'exact', head: true })
      .eq('season_id', seasonId)
      .eq('status', 'completed');

    return {
      regattaCount: regattaCount,
      raceCount: regattaRaceCount + (personalRaceCount || 0),
      completedCount: regattaCompletedCount + (personalCompletedCount || 0),
    };
  }

  /**
   * Get total entry count for a season
   */
  private async getSeasonEntryCount(seasonId: string): Promise<number> {
    const { count } = await supabase
      .from('season_standings')
      .select('*', { count: 'exact', head: true })
      .eq('season_id', seasonId);

    return count || 0;
  }

  // ===========================================================================
  // SEASON REGATTAS
  // ===========================================================================

  /**
   * Add a regatta to a season
   */
  async addRegattaToSeason(
    seasonId: string,
    regattaId: string,
    options?: { sequence?: number; weight?: number; is_championship?: boolean }
  ): Promise<SeasonRegatta> {
    logger.info('[SeasonService] Adding regatta to season', { seasonId, regattaId });

    // Get next sequence if not provided
    let sequence = options?.sequence;
    if (sequence === undefined) {
      const { data: existing } = await supabase
        .from('season_regattas')
        .select('sequence')
        .eq('season_id', seasonId)
        .order('sequence', { ascending: false })
        .limit(1);

      sequence = (existing?.[0]?.sequence || 0) + 1;
    }

    const { data, error } = await supabase
      .from('season_regattas')
      .insert({
        season_id: seasonId,
        regatta_id: regattaId,
        sequence,
        weight: options?.weight ?? 1.0,
        is_championship: options?.is_championship ?? false,
      })
      .select(`
        *,
        regattas (
          id,
          name,
          start_date,
          end_date,
          status,
          club_id
        )
      `)
      .single();

    if (error) {
      logger.error('[SeasonService] Failed to add regatta to season', { error });
      throw new Error(`Failed to add regatta to season: ${error.message}`);
    }

    return mapSeasonRegattaRow(data);
  }

  /**
   * Remove a regatta from a season
   */
  async removeRegattaFromSeason(seasonId: string, regattaId: string): Promise<void> {
    logger.info('[SeasonService] Removing regatta from season', { seasonId, regattaId });

    const { error } = await supabase
      .from('season_regattas')
      .delete()
      .eq('season_id', seasonId)
      .eq('regatta_id', regattaId);

    if (error) {
      logger.error('[SeasonService] Failed to remove regatta from season', { error });
      throw new Error(`Failed to remove regatta from season: ${error.message}`);
    }
  }

  /**
   * Get all regattas in a season
   */
  async getSeasonRegattas(seasonId: string): Promise<SeasonRegatta[]> {
    // Skip demo IDs that aren't valid UUIDs
    if (seasonId.startsWith('demo-')) {
      return [];
    }

    const { data, error } = await supabase
      .from('season_regattas')
      .select(`
        *,
        regattas (
          id,
          name,
          start_date,
          end_date,
          status,
          club_id
        )
      `)
      .eq('season_id', seasonId)
      .order('sequence', { ascending: true });

    if (error) {
      logger.error('[SeasonService] Failed to get season regattas', { seasonId, error });
      throw new Error(`Failed to get season regattas: ${error.message}`);
    }

    return (data || []).map(mapSeasonRegattaRow);
  }

  // ===========================================================================
  // STANDINGS
  // ===========================================================================

  /**
   * Get user's standing in a season
   */
  async getUserStanding(seasonId: string, userId: string): Promise<SeasonStanding | null> {
    const { data, error } = await supabase
      .from('season_standings')
      .select('*')
      .eq('season_id', seasonId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      logger.error('[SeasonService] Failed to get user standing', { seasonId, userId, error });
      throw new Error(`Failed to get user standing: ${error.message}`);
    }

    return data ? mapSeasonStandingRow(data) : null;
  }

  /**
   * Get all standings for a season (leaderboard)
   */
  async getSeasonStandings(seasonId: string, options?: {
    division?: string;
    limit?: number;
  }): Promise<SeasonStanding[]> {
    let query = supabase
      .from('season_standings')
      .select('*')
      .eq('season_id', seasonId)
      .order('rank', { ascending: true });

    if (options?.division) {
      query = query.eq('division', options.division);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('[SeasonService] Failed to get season standings', { seasonId, error });
      throw new Error(`Failed to get season standings: ${error.message}`);
    }

    return (data || []).map(mapSeasonStandingRow);
  }

  /**
   * Compute and update standings for a season
   * This aggregates results from all regattas in the season
   */
  async computeSeasonStandings(seasonId: string): Promise<void> {
    logger.info('[SeasonService] Computing season standings', { seasonId });

    // Get season with scoring rules
    const season = await this.getSeason(seasonId);
    if (!season) {
      throw new Error('Season not found');
    }

    // Get all regattas in the season
    const seasonRegattas = await this.getSeasonRegattas(seasonId);

    // Collect all race results across regattas
    const sailorResults = new Map<string, {
      userId: string;
      sailorName: string;
      boatName?: string;
      sailNumber?: string;
      regattaResults: RegattaResult[];
      raceResults: RaceResult[];
      totalPoints: number;
    }>();

    for (const sr of seasonRegattas) {
      if (!sr.regatta) continue;

      // Get series standings for this regatta
      const { data: standings } = await supabase
        .from('series_standings')
        .select(`
          *,
          profiles:user_id (
            id,
            full_name
          )
        `)
        .eq('regatta_id', sr.regatta_id);

      if (!standings) continue;

      for (const standing of standings) {
        const usrId = standing.entry_id || standing.user_id;
        if (!usrId) continue;

        const existing = sailorResults.get(usrId) || {
          userId: standing.user_id,
          sailorName: (standing as any).profiles?.full_name || 'Unknown',
          regattaResults: [] as RegattaResult[],
          raceResults: [] as RaceResult[],
          totalPoints: 0,
        };

        // Add regatta result
        existing.regattaResults.push({
          regatta_id: sr.regatta_id,
          regatta_name: sr.regatta.name,
          position: standing.rank,
          points: standing.net_points * (sr.weight || 1),
          races_in_regatta: standing.races_sailed,
        });

        // Add individual race results from race_scores JSONB
        if (standing.race_scores && Array.isArray(standing.race_scores)) {
          for (let i = 0; i < standing.race_scores.length; i++) {
            const score = standing.race_scores[i];
            existing.raceResults.push({
              regatta_id: sr.regatta_id,
              race_number: i + 1,
              race_date: sr.regatta.start_date,
              position: typeof score === 'number' ? score : null,
              points: typeof score === 'number' ? score : 0,
              status_code: typeof score === 'string' ? score : undefined,
            });
          }
        }

        existing.totalPoints += standing.net_points * (sr.weight || 1);
        sailorResults.set(usrId, existing);
      }
    }

    // Apply discard rules if configured
    const discardRules = season.discard_rules;
    const processedResults = Array.from(sailorResults.values()).map((sailor) => {
      let netPoints = sailor.totalPoints;
      const discards: number[] = [];

      if (discardRules && discardRules.type !== 'none' && sailor.raceResults.length > 0) {
        const minRaces = discardRules.min_races_for_discard || 0;

        if (sailor.raceResults.length >= minRaces) {
          // Sort by points (highest first for discarding worst)
          const sortedIndices = sailor.raceResults
            .map((r, i) => ({ points: r.points, index: i }))
            .sort((a, b) => b.points - a.points);

          let discardCount = 0;
          if (discardRules.type === 'worst_n') {
            discardCount = discardRules.count || 0;
          } else if (discardRules.type === 'percentage') {
            discardCount = Math.floor(sailor.raceResults.length * (discardRules.percentage || 0) / 100);
          }

          for (let i = 0; i < discardCount && i < sortedIndices.length; i++) {
            discards.push(sortedIndices[i].index);
            netPoints -= sortedIndices[i].points;
          }

          // Mark discarded races
          for (const idx of discards) {
            sailor.raceResults[idx].is_discarded = true;
          }
        }
      }

      return {
        ...sailor,
        netPoints,
        discards,
      };
    });

    // Sort by net points and assign ranks
    processedResults.sort((a, b) => a.netPoints - b.netPoints);

    // Calculate stats and upsert standings
    for (let i = 0; i < processedResults.length; i++) {
      const sailor = processedResults[i];
      const positions = sailor.raceResults
        .filter((r) => r.position !== null)
        .map((r) => r.position as number);

      const wins = positions.filter((p) => p === 1).length;
      const podiums = positions.filter((p) => p <= 3).length;
      const bestFinish = positions.length > 0 ? Math.min(...positions) : null;
      const worstFinish = positions.length > 0 ? Math.max(...positions) : null;

      const { error } = await supabase
        .from('season_standings')
        .upsert({
          season_id: seasonId,
          user_id: sailor.userId,
          sailor_name: sailor.sailorName,
          boat_name: sailor.boatName,
          sail_number: sailor.sailNumber,
          rank: i + 1,
          total_points: sailor.totalPoints,
          net_points: sailor.netPoints,
          races_sailed: sailor.raceResults.length,
          races_counted: sailor.raceResults.length - sailor.discards.length,
          regatta_results: sailor.regattaResults,
          race_results: sailor.raceResults,
          discards: sailor.discards,
          wins,
          podiums,
          best_finish: bestFinish,
          worst_finish: worstFinish,
          computed_at: new Date().toISOString(),
        }, {
          onConflict: 'season_id,user_id,division',
        });

      if (error) {
        logger.error('[SeasonService] Failed to upsert standing', { error });
      }
    }

    logger.info('[SeasonService] Season standings computed', {
      seasonId,
      sailorCount: processedResults.length,
    });
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  /**
   * Auto-detect or create season for a race event
   */
  async getOrCreateSeasonForDate(
    userId: string,
    date: string,
    clubId?: string
  ): Promise<Season> {
    const raceDate = new Date(date);
    const year = raceDate.getFullYear();
    const month = raceDate.getMonth();

    // Determine season based on month (simple heuristic)
    // Winter: Nov-Mar, Spring: Mar-May, Summer: Jun-Aug, Fall: Sep-Nov
    let seasonName: string;
    let startMonth: number;
    let endMonth: number;
    let yearEnd: number | undefined;

    if (month >= 10 || month <= 2) {
      // Winter (Nov-Mar)
      seasonName = month >= 10 ? `Winter ${year}-${year + 1}` : `Winter ${year - 1}-${year}`;
      startMonth = 10; // November
      endMonth = 2;    // March
      yearEnd = month >= 10 ? year + 1 : year;
    } else if (month >= 3 && month <= 4) {
      seasonName = `Spring ${year}`;
      startMonth = 3;
      endMonth = 4;
    } else if (month >= 5 && month <= 7) {
      seasonName = `Summer ${year}`;
      startMonth = 5;
      endMonth = 7;
    } else {
      seasonName = `Fall ${year}`;
      startMonth = 8;
      endMonth = 10;
    }

    // Check if season already exists
    const { data: existing } = await supabase
      .from('seasons')
      .select('*')
      .eq('user_id', userId)
      .eq('year', month >= 10 ? year : (month <= 2 ? year - 1 : year))
      .ilike('name', `%${seasonName.split(' ')[0]}%`)
      .maybeSingle();

    if (existing) {
      return mapSeasonRow(existing);
    }

    // Create new season
    const baseYear = month >= 10 ? year : (month <= 2 ? year - 1 : year);
    const startDate = new Date(baseYear, startMonth, 1).toISOString().split('T')[0];
    const endDate = new Date(yearEnd || year, endMonth + 1, 0).toISOString().split('T')[0];

    return this.createSeason({
      name: seasonName,
      year: baseYear,
      year_end: yearEnd,
      start_date: startDate,
      end_date: endDate,
      club_id: clubId,
    }, userId);
  }

  /**
   * Get season with full details including regattas and races
   */
  async getSeasonWithDetails(seasonId: string, userId?: string): Promise<SeasonWithSummary & {
    regattas: SeasonRegatta[];
  }> {
    const season = await this.getSeason(seasonId);
    if (!season) {
      throw new Error('Season not found');
    }

    const [summary, regattas] = await Promise.all([
      this.getSeasonSummary(seasonId, userId),
      this.getSeasonRegattas(seasonId),
    ]);

    return {
      ...season,
      summary,
      regattas,
    };
  }
}

// Export singleton instance
export const SeasonService = new SeasonServiceClass();
export default SeasonService;
