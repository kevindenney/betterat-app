/**
 * DrillLibraryService
 *
 * Service for accessing the drill library.
 * Read-only access to drill catalog for browsing and filtering.
 */

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import {
  Drill,
  DrillRow,
  DrillCategory,
  DrillDifficulty,
  SkillArea,
  DrillSkillMapping,
  DrillSkillMappingRow,
  rowToDrill,
  rowToDrillSkillMapping,
} from '@/types/practice';

const logger = createLogger('DrillLibraryService');

/**
 * Filter options for drill queries
 */
export interface DrillFilterOptions {
  category?: DrillCategory;
  difficulty?: DrillDifficulty;
  skillArea?: SkillArea;
  crewSize?: number;
  hasMarks?: boolean;
  hasCoachBoat?: boolean;
  soloFriendly?: boolean;
  search?: string;
  limit?: number;
}

/**
 * Service for accessing the drill library
 */
class DrillLibraryServiceClass {
  // =========================================================================
  // DRILL QUERIES
  // =========================================================================

  /**
   * Get all active drills
   */
  async getAllDrills(): Promise<Drill[]> {
    const { data, error } = await supabase
      .from('drills')
      .select('*')
      .eq('is_active', true)
      .order('category')
      .order('difficulty')
      .order('name');

    if (error) {
      logger.error('Failed to get all drills:', error);
      throw error;
    }

    return (data || []).map((row) => rowToDrill(row as DrillRow));
  }

  /**
   * Get drills by category
   */
  async getDrillsByCategory(category: DrillCategory): Promise<Drill[]> {
    const { data, error } = await supabase
      .from('drills')
      .select('*')
      .eq('category', category)
      .eq('is_active', true)
      .order('difficulty')
      .order('name');

    if (error) {
      logger.error('Failed to get drills by category:', error);
      throw error;
    }

    return (data || []).map((row) => rowToDrill(row as DrillRow));
  }

  /**
   * Get drills for a skill area (for AI suggestions)
   * Returns drills sorted by relevance score
   */
  async getDrillsForSkillArea(skillArea: SkillArea): Promise<Drill[]> {
    // First get drill IDs mapped to this skill area, sorted by relevance
    const { data: mappings, error: mappingError } = await supabase
      .from('drill_skill_mappings')
      .select('drill_id, relevance_score')
      .eq('skill_area', skillArea)
      .order('relevance_score', { ascending: false });

    if (mappingError) {
      logger.error('Failed to get drill mappings for skill area:', mappingError);
      throw mappingError;
    }

    if (!mappings || mappings.length === 0) {
      return [];
    }

    const drillIds = mappings.map((m) => m.drill_id);

    // Now get the drills
    const { data: drills, error: drillError } = await supabase
      .from('drills')
      .select('*')
      .in('id', drillIds)
      .eq('is_active', true);

    if (drillError) {
      logger.error('Failed to get drills for skill area:', drillError);
      throw drillError;
    }

    // Sort by relevance score from mappings
    const relevanceMap = new Map(mappings.map((m) => [m.drill_id, m.relevance_score]));
    const sortedDrills = (drills || [])
      .map((row) => rowToDrill(row as DrillRow))
      .sort((a, b) => {
        const aScore = relevanceMap.get(a.id) || 0;
        const bScore = relevanceMap.get(b.id) || 0;
        return bScore - aScore;
      });

    return sortedDrills;
  }

  /**
   * Get a single drill by ID or slug
   */
  async getDrill(idOrSlug: string): Promise<Drill | null> {
    // Try by ID first (UUID format)
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

    const { data, error } = await supabase
      .from('drills')
      .select('*')
      .eq(isUUID ? 'id' : 'slug', idOrSlug)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      logger.error('Failed to get drill:', error);
      throw error;
    }

    return rowToDrill(data as DrillRow);
  }

  /**
   * Get drills with learning module links
   */
  async getDrillsWithInteractives(): Promise<Drill[]> {
    const { data, error } = await supabase
      .from('drills')
      .select('*')
      .eq('is_active', true)
      .not('linked_interactive_id', 'is', null)
      .order('category')
      .order('name');

    if (error) {
      logger.error('Failed to get drills with interactives:', error);
      throw error;
    }

    return (data || []).map((row) => rowToDrill(row as DrillRow));
  }

  /**
   * Search drills by name or description
   */
  async searchDrills(query: string): Promise<Drill[]> {
    const searchTerm = `%${query.toLowerCase()}%`;

    const { data, error } = await supabase
      .from('drills')
      .select('*')
      .eq('is_active', true)
      .or(`name.ilike.${searchTerm},description.ilike.${searchTerm}`)
      .order('name')
      .limit(20);

    if (error) {
      logger.error('Failed to search drills:', error);
      throw error;
    }

    return (data || []).map((row) => rowToDrill(row as DrillRow));
  }

  /**
   * Get drills suitable for given conditions
   */
  async getDrillsForConditions(options: {
    crewSize: number;
    hasMarks?: boolean;
    hasCoachBoat?: boolean;
    difficulty?: DrillDifficulty;
  }): Promise<Drill[]> {
    let query = supabase
      .from('drills')
      .select('*')
      .eq('is_active', true)
      .lte('min_crew', options.crewSize)
      .gte('max_crew', options.crewSize);

    // Filter by mark requirements
    if (options.hasMarks === false) {
      query = query.eq('requires_marks', false);
    }

    // Filter by coach boat requirements
    if (options.hasCoachBoat === false) {
      query = query.eq('requires_coach_boat', false);
    }

    // Filter by difficulty
    if (options.difficulty) {
      query = query.eq('difficulty', options.difficulty);
    }

    const { data, error } = await query.order('category').order('name');

    if (error) {
      logger.error('Failed to get drills for conditions:', error);
      throw error;
    }

    return (data || []).map((row) => rowToDrill(row as DrillRow));
  }

  /**
   * Get drills with flexible filtering
   */
  async getDrills(options: DrillFilterOptions = {}): Promise<Drill[]> {
    let query = supabase.from('drills').select('*').eq('is_active', true);

    // Apply filters
    if (options.category) {
      query = query.eq('category', options.category);
    }

    if (options.difficulty) {
      query = query.eq('difficulty', options.difficulty);
    }

    if (options.crewSize !== undefined) {
      query = query.lte('min_crew', options.crewSize).gte('max_crew', options.crewSize);
    }

    if (options.hasMarks === false) {
      query = query.eq('requires_marks', false);
    }

    if (options.hasCoachBoat === false) {
      query = query.eq('requires_coach_boat', false);
    }

    if (options.soloFriendly === true) {
      query = query.eq('solo_friendly', true);
    }

    if (options.search) {
      const searchTerm = `%${options.search.toLowerCase()}%`;
      query = query.or(`name.ilike.${searchTerm},description.ilike.${searchTerm}`);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query.order('category').order('name');

    if (error) {
      logger.error('Failed to get drills with filters:', error);
      throw error;
    }

    // If skill area filter, we need to join with mappings
    let drills = (data || []).map((row) => rowToDrill(row as DrillRow));

    if (options.skillArea) {
      // Get drill IDs for this skill area
      const { data: mappings } = await supabase
        .from('drill_skill_mappings')
        .select('drill_id')
        .eq('skill_area', options.skillArea);

      const skillAreaDrillIds = new Set((mappings || []).map((m) => m.drill_id));
      drills = drills.filter((d) => skillAreaDrillIds.has(d.id));
    }

    return drills;
  }

  // =========================================================================
  // SKILL MAPPINGS
  // =========================================================================

  /**
   * Get all skill mappings for a drill
   */
  async getSkillMappingsForDrill(drillId: string): Promise<DrillSkillMapping[]> {
    const { data, error } = await supabase
      .from('drill_skill_mappings')
      .select('*')
      .eq('drill_id', drillId)
      .order('relevance_score', { ascending: false });

    if (error) {
      logger.error('Failed to get skill mappings for drill:', error);
      throw error;
    }

    return (data || []).map((row) => rowToDrillSkillMapping(row as DrillSkillMappingRow));
  }

  /**
   * Get all mappings for a skill area
   */
  async getMappingsForSkillArea(skillArea: SkillArea): Promise<DrillSkillMapping[]> {
    const { data, error } = await supabase
      .from('drill_skill_mappings')
      .select('*')
      .eq('skill_area', skillArea)
      .order('relevance_score', { ascending: false });

    if (error) {
      logger.error('Failed to get mappings for skill area:', error);
      throw error;
    }

    return (data || []).map((row) => rowToDrillSkillMapping(row as DrillSkillMappingRow));
  }

  // =========================================================================
  // AGGREGATION HELPERS
  // =========================================================================

  /**
   * Get drill categories with counts
   */
  async getCategoriesWithCounts(): Promise<{ category: DrillCategory; count: number }[]> {
    const { data, error } = await supabase
      .from('drills')
      .select('category')
      .eq('is_active', true);

    if (error) {
      logger.error('Failed to get category counts:', error);
      throw error;
    }

    // Count by category
    const counts = new Map<string, number>();
    (data || []).forEach((row) => {
      const cat = row.category;
      counts.set(cat, (counts.get(cat) || 0) + 1);
    });

    return Array.from(counts.entries()).map(([category, count]) => ({
      category: category as DrillCategory,
      count,
    }));
  }

  /**
   * Get available difficulties
   */
  async getDifficultiesWithCounts(): Promise<
    { difficulty: DrillDifficulty; count: number }[]
  > {
    const { data, error } = await supabase
      .from('drills')
      .select('difficulty')
      .eq('is_active', true);

    if (error) {
      logger.error('Failed to get difficulty counts:', error);
      throw error;
    }

    const counts = new Map<string, number>();
    (data || []).forEach((row) => {
      const diff = row.difficulty;
      counts.set(diff, (counts.get(diff) || 0) + 1);
    });

    return Array.from(counts.entries()).map(([difficulty, count]) => ({
      difficulty: difficulty as DrillDifficulty,
      count,
    }));
  }
}

// Export singleton instance
export const drillLibraryService = new DrillLibraryServiceClass();
