/**
 * RaceChecklistService
 *
 * Unified service for managing race checklists across all phases.
 * Handles CRUD operations, phase progression, and personalized item injection.
 */

import { supabase } from './supabase';
import { logger } from '@/lib/utils/logger';
import { signatureInsightService } from '@/services/SignatureInsightService';
import type {
  RaceChecklistItem,
  RaceChecklistItemRow,
  RacePhase,
  ChecklistCategory,
  ChecklistItemSource,
  ChecklistItemStatus,
  CreateChecklistItemInput,
  RaceTimeline,
  PhaseStatus,
} from '@/types/excellenceFramework';

export class RaceChecklistService {
  private static getIsoWeekWindow(now: Date = new Date()): { start: string; end: string } {
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const weekday = dayStart.getUTCDay();
    const diffToMonday = (weekday + 6) % 7;
    const start = new Date(dayStart);
    start.setUTCDate(start.getUTCDate() - diffToMonday);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  }

  private static async resolveLatestAiAnalysisForRace(input: {
    sailorId: string;
    raceEventId: string;
  }): Promise<{
    aiAnalysisId: string | null;
    confidenceScore: number | null;
    summary: string | null;
  }> {
    const { data: raceEventRow, error: raceEventError } = await supabase
      .from('race_events')
      .select('id,regatta_id')
      .eq('id', input.raceEventId)
      .eq('user_id', input.sailorId)
      .maybeSingle();
    if (raceEventError) {
      logger.warn('[RaceChecklistService] Failed to resolve race event for signature insight', {
        error: raceEventError,
        sailorId: input.sailorId,
        raceEventId: input.raceEventId,
      });
      return { aiAnalysisId: null, confidenceScore: null, summary: null };
    }

    const regattaId = String((raceEventRow as any)?.regatta_id || '').trim();
    if (!regattaId) {
      return { aiAnalysisId: null, confidenceScore: null, summary: null };
    }

    const { data: sessionRows, error: sessionError } = await supabase
      .from('race_timer_sessions')
      .select('id,regatta_id,race_id,start_time')
      .eq('sailor_id', input.sailorId)
      .or(`regatta_id.eq.${regattaId},race_id.eq.${regattaId}`)
      .order('start_time', { ascending: false })
      .limit(12);
    if (sessionError) {
      logger.warn('[RaceChecklistService] Failed to resolve timer sessions for signature insight', {
        error: sessionError,
        sailorId: input.sailorId,
        raceEventId: input.raceEventId,
        regattaId,
      });
      return { aiAnalysisId: null, confidenceScore: null, summary: null };
    }

    const sessionIds = Array.from(
      new Set((sessionRows || []).map((row: any) => String(row?.id || '').trim()).filter(Boolean))
    );
    if (sessionIds.length === 0) {
      return { aiAnalysisId: null, confidenceScore: null, summary: null };
    }

    const { data: analysisRows, error: analysisError } = await supabase
      .from('ai_coach_analysis')
      .select('id,timer_session_id,confidence_score,overall_summary,created_at')
      .in('timer_session_id', sessionIds)
      .order('created_at', { ascending: false })
      .limit(1);
    if (analysisError) {
      logger.warn('[RaceChecklistService] Failed to resolve AI analysis for signature insight', {
        error: analysisError,
        sailorId: input.sailorId,
        raceEventId: input.raceEventId,
      });
      return { aiAnalysisId: null, confidenceScore: null, summary: null };
    }

    const latest = (analysisRows || [])[0] as any;
    if (!latest?.id) return { aiAnalysisId: null, confidenceScore: null, summary: null };

    return {
      aiAnalysisId: String(latest.id),
      confidenceScore:
        typeof latest.confidence_score === 'number' && Number.isFinite(latest.confidence_score)
          ? Number(latest.confidence_score)
          : null,
      summary: typeof latest.overall_summary === 'string' ? latest.overall_summary.trim() : null,
    };
  }

  private static async maybeEmitSignatureInsightForChecklistCompletion(
    row: RaceChecklistItemRow,
    interestId: string
  ): Promise<void> {
    const sailorId = String(row.sailor_id || '').trim();
    const raceEventId = String(row.race_event_id || '').trim();
    if (!sailorId || !raceEventId) return;

    const ai = await this.resolveLatestAiAnalysisForRace({ sailorId, raceEventId });
    if (!ai.aiAnalysisId) {
      return;
    }

    const confidenceScore = ai.confidenceScore ?? null;
    if (confidenceScore !== null && confidenceScore < 0.4) {
      return;
    }

    const phaseLabel = String(row.phase || 'review');
    const itemTitle = String(row.title || 'recent step').trim() || 'recent step';
    const evidence = ai.summary
      ? ai.summary.slice(0, 220)
      : `AI analysis is available for your completed ${phaseLabel} step "${itemTitle}".`;
    const insightText = `You are getting better at ${phaseLabel} execution because ${evidence}`;
    const principleText = `When completing ${phaseLabel} steps like "${itemTitle}", carry one concrete execution adjustment into the next race.`;

    const { data: dismissedMatchRows, error: dismissedMatchError } = await supabase
      .from('signature_insight_events')
      .select('id')
      .eq('user_id', sailorId)
      .eq('interest_id', interestId)
      .eq('outcome', 'dismissed')
      .eq('principle_text', principleText)
      .limit(1);
    if (dismissedMatchError) {
      logger.warn('[RaceChecklistService] Failed dismissed-insight suppression lookup', {
        error: dismissedMatchError,
        sailorId,
        raceEventId,
        checklistItemId: row.id,
      });
    }
    if ((dismissedMatchRows || []).length > 0) {
      return;
    }

    const window = this.getIsoWeekWindow(new Date());
    try {
      await signatureInsightService.logSignatureInsightEvent({
        userId: sailorId,
        organizationId: null,
        interestId,
        raceEventId,
        checklistItemId: row.id,
        aiAnalysisId: ai.aiAnalysisId,
        sourceKind: 'timeline_step_completion',
        sourceWindowStart: window.start,
        sourceWindowEnd: window.end,
        insightText,
        principleText,
        evidenceText: evidence,
        confidenceScore,
        metadata: {
          phase: row.phase,
          checklistItemTitle: row.title,
          checklistItemCategory: row.category,
        },
      });
    } catch (error: any) {
      const message = String(error?.message || '');
      const code = String(error?.code || '');
      const isDuplicate = code === '23505' || message.toLowerCase().includes('duplicate key');
      if (!isDuplicate) {
        logger.warn('[RaceChecklistService] Failed to emit signature insight event', {
          error,
          checklistItemId: row.id,
          raceEventId,
          sailorId,
        });
      }
    }
  }

  // ============================================
  // Checklist Item CRUD
  // ============================================

  /**
   * Get all checklist items for a race
   */
  static async getChecklistForRace(
    sailorId: string,
    raceEventId: string,
    phase?: RacePhase
  ): Promise<RaceChecklistItem[]> {
    try {
      let query = supabase
        .from('race_checklist_items')
        .select('*')
        .eq('sailor_id', sailorId)
        .eq('race_event_id', raceEventId)
        .order('sort_order', { ascending: true });

      if (phase) {
        query = query.eq('phase', phase);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to get checklist items', { error, sailorId, raceEventId });
        throw error;
      }

      return (data || []).map(this.mapRowToItem);
    } catch (error) {
      logger.error('Error in getChecklistForRace', { error });
      throw error;
    }
  }

  /**
   * Get a single checklist item by ID
   */
  static async getChecklistItem(itemId: string): Promise<RaceChecklistItem | null> {
    try {
      const { data, error } = await supabase
        .from('race_checklist_items')
        .select('*')
        .eq('id', itemId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw error;
      }

      return this.mapRowToItem(data);
    } catch (error) {
      logger.error('Error in getChecklistItem', { error, itemId });
      throw error;
    }
  }

  /**
   * Create a new checklist item
   */
  static async createChecklistItem(
    sailorId: string,
    input: CreateChecklistItemInput
  ): Promise<RaceChecklistItem> {
    try {
      const row: Partial<RaceChecklistItemRow> = {
        sailor_id: sailorId,
        race_event_id: input.raceEventId,
        phase: input.phase,
        category: input.category,
        title: input.title,
        description: input.description || null,
        source: input.source,
        source_learning_event_id: input.sourceLearningEventId || null,
        is_personalized: input.isPersonalized || false,
        personalization_reason: input.personalizationReason || null,
        confidence_score: input.confidenceScore || null,
        template_item_id: input.templateItemId || null,
        sort_order: input.sortOrder || 0,
        status: 'pending',
      };

      const { data, error } = await supabase
        .from('race_checklist_items')
        .insert(row)
        .select()
        .single();

      if (error) {
        logger.error('Failed to create checklist item', { error, input });
        throw error;
      }

      return this.mapRowToItem(data);
    } catch (error) {
      logger.error('Error in createChecklistItem', { error });
      throw error;
    }
  }

  /**
   * Create multiple checklist items at once
   */
  static async createChecklistItems(
    sailorId: string,
    items: CreateChecklistItemInput[]
  ): Promise<RaceChecklistItem[]> {
    try {
      const rows: Partial<RaceChecklistItemRow>[] = items.map((input, index) => ({
        sailor_id: sailorId,
        race_event_id: input.raceEventId,
        phase: input.phase,
        category: input.category,
        title: input.title,
        description: input.description || null,
        source: input.source,
        source_learning_event_id: input.sourceLearningEventId || null,
        is_personalized: input.isPersonalized || false,
        personalization_reason: input.personalizationReason || null,
        confidence_score: input.confidenceScore || null,
        template_item_id: input.templateItemId || null,
        sort_order: input.sortOrder ?? index,
        status: 'pending' as ChecklistItemStatus,
      }));

      const { data, error } = await supabase
        .from('race_checklist_items')
        .insert(rows)
        .select();

      if (error) {
        logger.error('Failed to create checklist items', { error });
        throw error;
      }

      return (data || []).map(this.mapRowToItem);
    } catch (error) {
      logger.error('Error in createChecklistItems', { error });
      throw error;
    }
  }

  /**
   * Update checklist item status
   */
  static async updateChecklistStatus(
    itemId: string,
    status: ChecklistItemStatus,
    options?: {
      interestId?: string;
    }
  ): Promise<RaceChecklistItem> {
    try {
      const updates: Partial<RaceChecklistItemRow> = {
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : null,
      };

      const { data, error } = await supabase
        .from('race_checklist_items')
        .update(updates)
        .eq('id', itemId)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update checklist status', { error, itemId, status });
        throw error;
      }

      if (status === 'completed') {
        const interestId = String(options?.interestId || 'sailing').trim() || 'sailing';
        await this.maybeEmitSignatureInsightForChecklistCompletion(data as RaceChecklistItemRow, interestId);
      }

      return this.mapRowToItem(data);
    } catch (error) {
      logger.error('Error in updateChecklistStatus', { error });
      throw error;
    }
  }

  /**
   * Rate checklist item outcome (during Review phase)
   */
  static async rateChecklistOutcome(
    itemId: string,
    rating: number,
    notes?: string
  ): Promise<RaceChecklistItem> {
    try {
      if (rating < 1 || rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }

      const { data, error } = await supabase
        .from('race_checklist_items')
        .update({
          outcome_rating: rating,
          outcome_notes: notes || null,
        })
        .eq('id', itemId)
        .select()
        .single();

      if (error) {
        logger.error('Failed to rate checklist outcome', { error, itemId, rating });
        throw error;
      }

      return this.mapRowToItem(data);
    } catch (error) {
      logger.error('Error in rateChecklistOutcome', { error });
      throw error;
    }
  }

  /**
   * Delete a checklist item
   */
  static async deleteChecklistItem(itemId: string): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('race_checklist_items')
        .delete()
        .eq('id', itemId)
        .select('id')
        .maybeSingle();

      if (error) {
        logger.error('Failed to delete checklist item', { error, itemId });
        throw error;
      }
      if (!data) throw new Error('Race checklist item not found.');
    } catch (error) {
      logger.error('Error in deleteChecklistItem', { error });
      throw error;
    }
  }

  // ============================================
  // Phase Progress
  // ============================================

  /**
   * Get phase progress for a race
   */
  static async getPhaseProgress(
    sailorId: string,
    raceEventId: string,
    phase: RacePhase
  ): Promise<PhaseStatus> {
    try {
      const items = await this.getChecklistForRace(sailorId, raceEventId, phase);

      const completed = items.filter((i) => i.status === 'completed');
      const skipped = items.filter((i) => i.status === 'skipped');
      const ratedItems = items.filter((i) => i.outcomeRating !== undefined);

      const completionRate = items.length > 0 ? completed.length / items.length : 0;
      const averageRating =
        ratedItems.length > 0
          ? ratedItems.reduce((sum, i) => sum + (i.outcomeRating || 0), 0) / ratedItems.length
          : undefined;

      return {
        itemsTotal: items.length,
        itemsCompleted: completed.length,
        itemsSkipped: skipped.length,
        completionRate,
        averageRating,
        startedAt: completed.length > 0 ? completed[0].completedAt : undefined,
        completedAt:
          completed.length === items.length && items.length > 0
            ? completed[completed.length - 1].completedAt
            : undefined,
      };
    } catch (error) {
      logger.error('Error in getPhaseProgress', { error });
      throw error;
    }
  }

  /**
   * Get complete race timeline with all phases
   */
  static async getRaceTimeline(
    sailorId: string,
    raceEventId: string
  ): Promise<RaceTimeline> {
    try {
      const [prep, launch, race, review] = await Promise.all([
        this.getPhaseProgress(sailorId, raceEventId, 'prep'),
        this.getPhaseProgress(sailorId, raceEventId, 'launch'),
        this.getPhaseProgress(sailorId, raceEventId, 'race'),
        this.getPhaseProgress(sailorId, raceEventId, 'review'),
      ]);

      // Determine current phase based on completion
      let currentPhase: RacePhase = 'prep';
      if (prep.completionRate >= 0.8) {
        currentPhase = 'launch';
      }
      if (launch.completionRate >= 0.8) {
        currentPhase = 'race';
      }
      if (race.completionRate >= 0.8) {
        currentPhase = 'review';
      }

      const totalItems =
        prep.itemsTotal + launch.itemsTotal + race.itemsTotal + review.itemsTotal;
      const totalCompleted =
        prep.itemsCompleted +
        launch.itemsCompleted +
        race.itemsCompleted +
        review.itemsCompleted;

      return {
        raceEventId,
        currentPhase,
        phases: { prep, launch, race, review },
        overallProgress: totalItems > 0 ? totalCompleted / totalItems : 0,
      };
    } catch (error) {
      logger.error('Error in getRaceTimeline', { error });
      throw error;
    }
  }

  // ============================================
  // Template-based Checklist Generation
  // ============================================

  /**
   * Initialize checklist for a race from templates
   */
  static async initializeChecklistFromTemplates(
    sailorId: string,
    raceEventId: string,
    phase: RacePhase,
    options?: {
      boatClassId?: string;
      raceType?: 'fleet' | 'team' | 'match' | 'distance';
    }
  ): Promise<RaceChecklistItem[]> {
    try {
      // Get applicable templates
      let query = supabase
        .from('checklist_templates')
        .select('*')
        .eq('phase', phase)
        .order('sort_order', { ascending: true });

      // Filter by system templates or user's own
      query = query.or(`is_system_template.eq.true,created_by.eq.${sailorId}`);

      // Filter by boat class if specified
      if (options?.boatClassId) {
        query = query.or(`boat_class_id.is.null,boat_class_id.eq.${options.boatClassId}`);
      }

      // Filter by race type if specified
      if (options?.raceType) {
        query = query.or(`race_type.is.null,race_type.eq.${options.raceType}`);
      }

      const { data: templates, error } = await query;

      if (error) {
        logger.error('Failed to get checklist templates', { error });
        throw error;
      }

      if (!templates || templates.length === 0) {
        return [];
      }

      // Create checklist items from templates
      const items: CreateChecklistItemInput[] = templates.map((template, index) => ({
        raceEventId,
        phase,
        category: template.category as ChecklistCategory,
        title: template.title,
        description: template.default_description || undefined,
        source: 'template' as ChecklistItemSource,
        templateItemId: template.id,
        sortOrder: index,
      }));

      return this.createChecklistItems(sailorId, items);
    } catch (error) {
      logger.error('Error in initializeChecklistFromTemplates', { error });
      throw error;
    }
  }

  // ============================================
  // Personalized Item Injection
  // ============================================

  /**
   * Inject personalized items from learning nudges into checklist
   * Called by AdaptiveLearningService when generating nudges
   */
  static async injectPersonalizedItems(
    sailorId: string,
    raceEventId: string,
    items: {
      phase: RacePhase;
      category: ChecklistCategory;
      title: string;
      description?: string;
      sourceLearningEventId: string;
      personalizationReason: string;
      confidenceScore: number;
    }[]
  ): Promise<RaceChecklistItem[]> {
    try {
      const inputs: CreateChecklistItemInput[] = items.map((item, index) => ({
        raceEventId,
        phase: item.phase,
        category: item.category,
        title: item.title,
        description: item.description,
        source: 'learning_nudge',
        sourceLearningEventId: item.sourceLearningEventId,
        isPersonalized: true,
        personalizationReason: item.personalizationReason,
        confidenceScore: item.confidenceScore,
        sortOrder: 1000 + index, // Put personalized items at end
      }));

      return this.createChecklistItems(sailorId, inputs);
    } catch (error) {
      logger.error('Error in injectPersonalizedItems', { error });
      throw error;
    }
  }

  /**
   * Get only personalized items for a race
   */
  static async getPersonalizedItems(
    sailorId: string,
    raceEventId: string,
    phase?: RacePhase
  ): Promise<RaceChecklistItem[]> {
    try {
      let query = supabase
        .from('race_checklist_items')
        .select('*')
        .eq('sailor_id', sailorId)
        .eq('race_event_id', raceEventId)
        .eq('is_personalized', true)
        .order('sort_order', { ascending: true });

      if (phase) {
        query = query.eq('phase', phase);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to get personalized items', { error });
        throw error;
      }

      return (data || []).map(this.mapRowToItem);
    } catch (error) {
      logger.error('Error in getPersonalizedItems', { error });
      throw error;
    }
  }

  // ============================================
  // Bulk Operations
  // ============================================

  /**
   * Mark all items in a phase as completed
   */
  static async completePhase(
    sailorId: string,
    raceEventId: string,
    phase: RacePhase
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('race_checklist_items')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('sailor_id', sailorId)
        .eq('race_event_id', raceEventId)
        .eq('phase', phase)
        .eq('status', 'pending');

      if (error) {
        logger.error('Failed to complete phase', { error, phase });
        throw error;
      }
    } catch (error) {
      logger.error('Error in completePhase', { error });
      throw error;
    }
  }

  /**
   * Delete all checklist items for a race
   */
  static async clearChecklist(sailorId: string, raceEventId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('race_checklist_items')
        .delete()
        .eq('sailor_id', sailorId)
        .eq('race_event_id', raceEventId);

      if (error) {
        logger.error('Failed to clear checklist', { error, raceEventId });
        throw error;
      }
    } catch (error) {
      logger.error('Error in clearChecklist', { error });
      throw error;
    }
  }

  // ============================================
  // Aggregation Queries
  // ============================================

  /**
   * Get checklist completion stats for a sailor across multiple races
   */
  static async getCompletionStats(
    sailorId: string,
    options?: {
      seasonId?: string;
      limit?: number;
    }
  ): Promise<{
    totalRaces: number;
    averageCompletionRate: number;
    averageRating: number;
    phaseStats: Record<RacePhase, { completionRate: number; averageRating: number }>;
  }> {
    try {
      // Get distinct races with checklist items
      const { data: raceIds, error: raceError } = await supabase
        .from('race_checklist_items')
        .select('race_event_id')
        .eq('sailor_id', sailorId)
        .limit(options?.limit || 50);

      if (raceError) throw raceError;

      const uniqueRaceIds = [...new Set((raceIds || []).map((r) => r.race_event_id))];

      if (uniqueRaceIds.length === 0) {
        return {
          totalRaces: 0,
          averageCompletionRate: 0,
          averageRating: 0,
          phaseStats: {
            prep: { completionRate: 0, averageRating: 0 },
            launch: { completionRate: 0, averageRating: 0 },
            race: { completionRate: 0, averageRating: 0 },
            review: { completionRate: 0, averageRating: 0 },
          },
        };
      }

      // Get all items for these races
      const { data: items, error: itemsError } = await supabase
        .from('race_checklist_items')
        .select('*')
        .eq('sailor_id', sailorId)
        .in('race_event_id', uniqueRaceIds);

      if (itemsError) throw itemsError;

      const allItems = items || [];
      const completed = allItems.filter((i) => i.status === 'completed');
      const rated = allItems.filter((i) => i.outcome_rating !== null);

      // Calculate phase-specific stats
      const phases: RacePhase[] = ['prep', 'launch', 'race', 'review'];
      const phaseStats = {} as Record<RacePhase, { completionRate: number; averageRating: number }>;

      for (const phase of phases) {
        const phaseItems = allItems.filter((i) => i.phase === phase);
        const phaseCompleted = phaseItems.filter((i) => i.status === 'completed');
        const phaseRated = phaseItems.filter((i) => i.outcome_rating !== null);

        phaseStats[phase] = {
          completionRate: phaseItems.length > 0 ? phaseCompleted.length / phaseItems.length : 0,
          averageRating:
            phaseRated.length > 0
              ? phaseRated.reduce((sum, i) => sum + (i.outcome_rating || 0), 0) /
                phaseRated.length
              : 0,
        };
      }

      return {
        totalRaces: uniqueRaceIds.length,
        averageCompletionRate: allItems.length > 0 ? completed.length / allItems.length : 0,
        averageRating:
          rated.length > 0
            ? rated.reduce((sum, i) => sum + (i.outcome_rating || 0), 0) / rated.length
            : 0,
        phaseStats,
      };
    } catch (error) {
      logger.error('Error in getCompletionStats', { error });
      throw error;
    }
  }

  // ============================================
  // Private Helpers
  // ============================================

  /**
   * Map database row to RaceChecklistItem type
   */
  private static mapRowToItem(row: RaceChecklistItemRow): RaceChecklistItem {
    return {
      id: row.id,
      sailorId: row.sailor_id,
      raceEventId: row.race_event_id,
      phase: row.phase as RacePhase,
      category: row.category as ChecklistCategory,
      title: row.title,
      description: row.description || undefined,
      status: row.status as ChecklistItemStatus,
      completedAt: row.completed_at || undefined,
      outcomeRating: row.outcome_rating || undefined,
      outcomeNotes: row.outcome_notes || undefined,
      source: row.source as ChecklistItemSource,
      sourceLearningEventId: row.source_learning_event_id || undefined,
      isPersonalized: row.is_personalized,
      personalizationReason: row.personalization_reason || undefined,
      confidenceScore: row.confidence_score || undefined,
      templateItemId: row.template_item_id || undefined,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export default RaceChecklistService;
