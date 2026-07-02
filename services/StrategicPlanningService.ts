import { createLogger } from '@/lib/utils/logger';
import { isMissingSupabaseColumn } from '@/lib/utils/supabaseSchemaFallback';
import { supabase } from './supabase';
import type { StrategySectionId, RaceStrategyNotes, StrategySectionNote } from '@/types/raceStrategy';

const logger = createLogger('StrategicPlanningService');

/**
 * Strategic plan for each phase of the race
 */
export interface RaceStrategyPlan {
  rigTuningStrategy?: string;
  prestartStrategy?: string;
  startStrategy?: string;
  upwindStrategy?: string;
  windwardMarkStrategy?: string;
  downwindStrategy?: string;
  leewardMarkStrategy?: string;
  finishStrategy?: string;
}

/**
 * AI-generated strategy suggestions based on conditions and learning profile
 */
export interface AIStrategySuggestions {
  rigTuning?: string;
  prestart?: string;
  start?: string;
  upwind?: string;
  windwardMark?: string;
  downwind?: string;
  leewardMark?: string;
  finish?: string;
  contextualInsights?: string[];
  learningBasedTips?: string[];
  generatedAt?: string;
}

/**
 * Complete race preparation including strategic planning
 */
export interface RacePreparationWithStrategy {
  id?: string;
  race_event_id: string;
  sailor_id: string;

  // Existing fields
  rig_notes?: string;
  selected_rig_preset_id?: string;
  regulatory_acknowledgements?: any;
  race_brief_data?: any;

  // Strategic planning fields
  rig_tuning_strategy?: string;
  prestart_strategy?: string;
  start_strategy?: string;
  upwind_strategy?: string;
  windward_mark_strategy?: string;
  downwind_strategy?: string;
  leeward_mark_strategy?: string;
  finish_strategy?: string;

  // AI suggestions
  ai_strategy_suggestions?: AIStrategySuggestions;

  // Coach sharing
  shared_with_coach?: boolean;
  coach_id?: string;
  shared_at?: string;

  // Public sharing
  share_token?: string;
  share_enabled?: boolean;
  public_shared_at?: string;

  created_at?: string;
  updated_at?: string;
}

/**
 * Public sharing status
 */
export interface PublicSharingStatus {
  enabled: boolean;
  token: string | null;
  url: string | null;
  sharedAt: string | null;
}

class StrategicPlanningService {
  /**
   * Get race preparation with strategic plan
   */
  async getPreparationWithStrategy(
    raceEventId: string,
    sailorId: string
  ): Promise<RacePreparationWithStrategy | null> {
    try {
      const { data, error } = await supabase
        .from('sailor_race_preparation')
        .select('*')
        .eq('race_event_id', raceEventId)
        .eq('sailor_id', sailorId)
        .maybeSingle();

      if (error) {
        logger.error('Error fetching preparation with strategy:', error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Failed to get preparation with strategy:', error);
      return null;
    }
  }

  /**
   * Get race preparation by its ID (used when post-race analysis links directly to preparation)
   */
  async getPreparationById(preparationId: string): Promise<RacePreparationWithStrategy | null> {
    try {
      const { data, error } = await supabase
        .from('sailor_race_preparation')
        .select('*')
        .eq('id', preparationId)
        .maybeSingle();

      if (error) {
        logger.error('Error fetching preparation by id:', error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Failed to get preparation by id:', error);
      return null;
    }
  }

  /**
   * Update strategic plan for a specific race phase
   */
  async updatePhaseStrategy(
    raceEventId: string,
    sailorId: string,
    phase: keyof RaceStrategyPlan,
    strategy: string
  ): Promise<boolean> {
    try {
      // Map phase to database column name
      const columnMap: Record<keyof RaceStrategyPlan, string> = {
        rigTuningStrategy: 'rig_tuning_strategy',
        prestartStrategy: 'prestart_strategy',
        startStrategy: 'start_strategy',
        upwindStrategy: 'upwind_strategy',
        windwardMarkStrategy: 'windward_mark_strategy',
        downwindStrategy: 'downwind_strategy',
        leewardMarkStrategy: 'leeward_mark_strategy',
        finishStrategy: 'finish_strategy',
      };

      const columnName = columnMap[phase];

      const { error } = await supabase
        .from('sailor_race_preparation')
        .upsert(
          {
            race_event_id: raceEventId,
            sailor_id: sailorId,
            [columnName]: strategy,
          },
          {
            onConflict: 'race_event_id,sailor_id',
          }
        );

      if (error) {
        logger.error(`Error updating ${phase} strategy:`, error);
        throw error;
      }

      logger.info(`Updated ${phase} strategy successfully`);
      return true;
    } catch (error) {
      logger.error(`Failed to update ${phase} strategy:`, error);
      return false;
    }
  }

  /**
   * Update complete strategic plan at once
   */
  async updateCompleteStrategy(
    raceEventId: string,
    sailorId: string,
    plan: RaceStrategyPlan
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('sailor_race_preparation')
        .upsert(
          {
            race_event_id: raceEventId,
            sailor_id: sailorId,
            rig_tuning_strategy: plan.rigTuningStrategy,
            prestart_strategy: plan.prestartStrategy,
            start_strategy: plan.startStrategy,
            upwind_strategy: plan.upwindStrategy,
            windward_mark_strategy: plan.windwardMarkStrategy,
            downwind_strategy: plan.downwindStrategy,
            leeward_mark_strategy: plan.leewardMarkStrategy,
            finish_strategy: plan.finishStrategy,
          },
          {
            onConflict: 'race_event_id,sailor_id',
          }
        );

      if (error) {
        logger.error('Error updating complete strategy:', error);
        throw error;
      }

      logger.info('Complete strategy updated successfully');
      return true;
    } catch (error) {
      logger.error('Failed to update complete strategy:', error);
      return false;
    }
  }

  /**
   * Store AI-generated strategy suggestions
   */
  async storeAISuggestions(
    raceEventId: string,
    sailorId: string,
    suggestions: AIStrategySuggestions
  ): Promise<boolean> {
    try {
      const suggestionsWithTimestamp = {
        ...suggestions,
        generatedAt: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('sailor_race_preparation')
        .upsert(
          {
            race_event_id: raceEventId,
            sailor_id: sailorId,
            ai_strategy_suggestions: suggestionsWithTimestamp,
          },
          {
            onConflict: 'race_event_id,sailor_id',
          }
        );

      if (error) {
        logger.error('Error storing AI suggestions:', error);
        throw error;
      }

      logger.info('AI suggestions stored successfully');
      return true;
    } catch (error) {
      logger.error('Failed to store AI suggestions:', error);
      return false;
    }
  }

  /**
   * Get AI-generated strategy suggestions
   */
  async getAISuggestions(
    raceEventId: string,
    sailorId: string
  ): Promise<AIStrategySuggestions | null> {
    try {
      const { data, error } = await supabase
        .from('sailor_race_preparation')
        .select('ai_strategy_suggestions')
        .eq('race_event_id', raceEventId)
        .eq('sailor_id', sailorId)
        .maybeSingle();

      if (error) {
        logger.error('Error fetching AI suggestions:', error);
        throw error;
      }

      return data?.ai_strategy_suggestions || null;
    } catch (error) {
      logger.error('Failed to get AI suggestions:', error);
      return null;
    }
  }

  // ==========================================
  // SECTION-SPECIFIC NOTES METHODS
  // ==========================================

  /**
   * Save a user's strategy note for a specific section
   * Notes are stored in the ai_strategy_suggestions JSONB under userSectionNotes
   */
  async saveSectionNote(
    raceEventId: string,
    sailorId: string,
    sectionId: StrategySectionId,
    note: string
  ): Promise<boolean> {
    try {
      // First get existing suggestions to merge with
      const { data: existing, error: fetchError } = await supabase
        .from('sailor_race_preparation')
        .select('ai_strategy_suggestions')
        .eq('race_event_id', raceEventId)
        .eq('sailor_id', sailorId)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        logger.error('Error fetching existing suggestions:', fetchError);
        throw fetchError;
      }

      // Merge the new note into existing suggestions
      const currentSuggestions = existing?.ai_strategy_suggestions || {};
      const currentUserNotes = currentSuggestions.userSectionNotes || {};

      const updatedSuggestions = {
        ...currentSuggestions,
        userSectionNotes: {
          ...currentUserNotes,
          [sectionId]: {
            userPlan: note,
            updatedAt: new Date().toISOString(),
          },
        },
      };

      const { error } = await supabase
        .from('sailor_race_preparation')
        .upsert(
          {
            race_event_id: raceEventId,
            sailor_id: sailorId,
            ai_strategy_suggestions: updatedSuggestions,
          },
          {
            onConflict: 'race_event_id,sailor_id',
          }
        );

      if (error) {
        logger.error(`Error saving section note for ${sectionId}:`, error);
        throw error;
      }

      logger.info(`Saved section note for ${sectionId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to save section note for ${sectionId}:`, error);
      return false;
    }
  }

  /**
   * Get all user section notes for a race
   */
  async getSectionNotes(
    raceEventId: string,
    sailorId: string
  ): Promise<Partial<Record<StrategySectionId, StrategySectionNote>> | null> {
    try {
      const { data, error } = await supabase
        .from('sailor_race_preparation')
        .select('ai_strategy_suggestions')
        .eq('race_event_id', raceEventId)
        .eq('sailor_id', sailorId)
        .maybeSingle();

      if (error) {
        logger.error('Error fetching section notes:', error);
        throw error;
      }

      return data?.ai_strategy_suggestions?.userSectionNotes || null;
    } catch (error) {
      logger.error('Failed to get section notes:', error);
      return null;
    }
  }

  /**
   * Save multiple section notes at once
   */
  async saveBulkSectionNotes(
    raceEventId: string,
    sailorId: string,
    notes: Partial<Record<StrategySectionId, string>>
  ): Promise<boolean> {
    try {
      // First get existing suggestions to merge with
      const { data: existing, error: fetchError } = await supabase
        .from('sailor_race_preparation')
        .select('ai_strategy_suggestions')
        .eq('race_event_id', raceEventId)
        .eq('sailor_id', sailorId)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        logger.error('Error fetching existing suggestions:', fetchError);
        throw fetchError;
      }

      const now = new Date().toISOString();
      const currentSuggestions = existing?.ai_strategy_suggestions || {};
      const currentUserNotes = currentSuggestions.userSectionNotes || {};

      // Build updated notes object
      const updatedUserNotes = { ...currentUserNotes };
      for (const [sectionId, note] of Object.entries(notes)) {
        if (note !== undefined) {
          updatedUserNotes[sectionId] = {
            userPlan: note,
            updatedAt: now,
          };
        }
      }

      const updatedSuggestions = {
        ...currentSuggestions,
        userSectionNotes: updatedUserNotes,
      };

      const { error } = await supabase
        .from('sailor_race_preparation')
        .upsert(
          {
            race_event_id: raceEventId,
            sailor_id: sailorId,
            ai_strategy_suggestions: updatedSuggestions,
          },
          {
            onConflict: 'race_event_id,sailor_id',
          }
        );

      if (error) {
        logger.error('Error saving bulk section notes:', error);
        throw error;
      }

      logger.info(`Saved ${Object.keys(notes).length} section notes`);
      return true;
    } catch (error) {
      logger.error('Failed to save bulk section notes:', error);
      return false;
    }
  }

  /**
   * Share strategic plan with coach
   */
  async shareWithCoach(
    raceEventId: string,
    sailorId: string,
    coachId: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('sailor_race_preparation')
        .update({
          shared_with_coach: true,
          coach_id: coachId,
          shared_at: new Date().toISOString(),
        })
        .eq('race_event_id', raceEventId)
        .eq('sailor_id', sailorId);

      if (error) {
        logger.error('Error sharing with coach:', error);
        throw error;
      }

      logger.info('Strategy shared with coach successfully');
      return true;
    } catch (error) {
      logger.error('Failed to share with coach:', error);
      return false;
    }
  }

  /**
   * Unshare strategic plan from coach
   */
  async unshareFromCoach(
    raceEventId: string,
    sailorId: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('sailor_race_preparation')
        .update({
          shared_with_coach: false,
          coach_id: null,
          shared_at: null,
        })
        .eq('race_event_id', raceEventId)
        .eq('sailor_id', sailorId);

      if (error) {
        logger.error('Error unsharing from coach:', error);
        throw error;
      }

      logger.info('Strategy unshared from coach successfully');
      return true;
    } catch (error) {
      logger.error('Failed to unshare from coach:', error);
      return false;
    }
  }

  /**
   * Get all strategic plans shared with a specific coach
   */
  async getSharedPlansForCoach(coachId: string): Promise<RacePreparationWithStrategy[]> {
    try {
      const { data, error } = await supabase
        .from('sailor_race_preparation')
        .select(`
          *,
          race_events!inner (
            id,
            name,
            event_date,
            venue_location
          ),
          sailor_profiles!inner (
            id,
            user_id,
            sailing_number
          )
        `)
        .eq('coach_id', coachId)
        .eq('shared_with_coach', true)
        .order('shared_at', { ascending: false });

      if (error) {
        logger.error('Error fetching shared plans:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('Failed to get shared plans:', error);
      return [];
    }
  }

  /**
   * Check if strategic plan is complete (all phases documented)
   */
  isPlanComplete(plan: RacePreparationWithStrategy): boolean {
    return !!(
      plan.rig_tuning_strategy &&
      plan.prestart_strategy &&
      plan.start_strategy &&
      plan.upwind_strategy &&
      plan.windward_mark_strategy &&
      plan.downwind_strategy &&
      plan.leeward_mark_strategy &&
      plan.finish_strategy
    );
  }

  /**
   * Get completion percentage of strategic plan
   */
  getPlanCompletionPercentage(plan: RacePreparationWithStrategy): number {
    const phases = [
      plan.rig_tuning_strategy,
      plan.prestart_strategy,
      plan.start_strategy,
      plan.upwind_strategy,
      plan.windward_mark_strategy,
      plan.downwind_strategy,
      plan.leeward_mark_strategy,
      plan.finish_strategy,
    ];

    const completedPhases = phases.filter((phase) => phase && phase.trim().length > 0).length;
    return Math.round((completedPhases / phases.length) * 100);
  }

  /**
   * Get list of incomplete phases
   */
  getIncompletePhases(plan: RacePreparationWithStrategy): string[] {
    const phaseChecks = [
      { name: 'Rig Tuning', value: plan.rig_tuning_strategy },
      { name: 'Pre-Start', value: plan.prestart_strategy },
      { name: 'Start', value: plan.start_strategy },
      { name: 'Upwind', value: plan.upwind_strategy },
      { name: 'Windward Mark', value: plan.windward_mark_strategy },
      { name: 'Downwind', value: plan.downwind_strategy },
      { name: 'Leeward Mark', value: plan.leeward_mark_strategy },
      { name: 'Finish', value: plan.finish_strategy },
    ];

    return phaseChecks
      .filter((phase) => !phase.value || phase.value.trim().length === 0)
      .map((phase) => phase.name);
  }

  // ==========================================
  // PUBLIC SHARING METHODS
  // ==========================================

  /**
   * Generate a unique share token
   */
  private generateShareToken(): string {
    // Generate a URL-safe random token (12 characters)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    const array = new Uint8Array(12);
    crypto.getRandomValues(array);
    for (let i = 0; i < 12; i++) {
      token += chars[array[i] % chars.length];
    }
    return token;
  }

  /**
   * Get the base URL for public sharing
   */
  private getBaseUrl(): string {
    // If running in browser, detect localhost and use current origin
    if (typeof window !== 'undefined') {
      const isLocalhost = 
        window.location?.hostname === 'localhost' || 
        window.location?.hostname === '127.0.0.1' ||
        window.location?.hostname === '';
      
      if (isLocalhost) {
        // Use current origin (e.g., http://localhost:8081)
        return window.location.origin;
      }
    }
    
    // Use environment variable or fallback to production
    return process.env.EXPO_PUBLIC_API_URL || 'https://better.at';
  }

  /**
   * Get public sharing status for a preparation
   */
  async getPublicSharingStatus(
    raceEventId: string,
    sailorId: string
  ): Promise<PublicSharingStatus> {
    try {
      // First check if the share columns exist by selecting from sailor_race_preparation
      // If columns don't exist (migration not run), this will fail gracefully
      const { data, error } = await supabase
        .from('sailor_race_preparation')
        .select('share_token, share_enabled, public_shared_at')
        .eq('race_event_id', raceEventId)
        .eq('sailor_id', sailorId)
        .maybeSingle();

      if (error) {
        // Check if error is due to missing columns (migration not run)
        if (isMissingSupabaseColumn(error) || error.message?.includes('column')) {
          logger.warn('Public sharing columns do not exist - migration may not be run yet');
          return {
            enabled: false,
            token: null,
            url: null,
            sharedAt: null,
          };
        }
        logger.error('Error fetching public sharing status:', error);
        throw error;
      }

      if (!data) {
        return {
          enabled: false,
          token: null,
          url: null,
          sharedAt: null,
        };
      }

      const baseUrl = this.getBaseUrl();
      return {
        enabled: data.share_enabled || false,
        token: data.share_token || null,
        url: data.share_enabled && data.share_token 
          ? `${baseUrl}/p/strategy/${data.share_token}` 
          : null,
        sharedAt: data.public_shared_at || null,
      };
    } catch (error) {
      logger.error('Failed to get public sharing status:', error);
      return {
        enabled: false,
        token: null,
        url: null,
        sharedAt: null,
      };
    }
  }

  /**
   * Enable public sharing for a strategy
   * Generates a share token if one doesn't exist
   */
  async enablePublicSharing(
    raceEventId: string,
    sailorId: string
  ): Promise<PublicSharingStatus> {
    logger.info('[enablePublicSharing] Starting with params:', { raceEventId, sailorId });
    
    // Validate inputs
    if (!raceEventId) {
      logger.error('[enablePublicSharing] raceEventId is missing!');
      throw new Error('raceEventId is required');
    }
    if (!sailorId) {
      logger.error('[enablePublicSharing] sailorId is missing!');
      throw new Error('sailorId is required');
    }
    
    try {
      // Check auth session
      const { data: { session } } = await supabase.auth.getSession();
      logger.info('[enablePublicSharing] Auth session:', { 
        hasSession: !!session, 
        userId: session?.user?.id,
        matchesSailorId: session?.user?.id === sailorId 
      });
      
      // First check if there's already a record
      logger.info('[enablePublicSharing] Checking for existing record...');
      const { data: existing, error: selectError } = await supabase
        .from('sailor_race_preparation')
        .select('id, share_token')
        .eq('race_event_id', raceEventId)
        .eq('sailor_id', sailorId)
        .maybeSingle();

      logger.info('[enablePublicSharing] Select result:', { 
        hasExisting: !!existing, 
        existingId: existing?.id,
        hasShareToken: !!existing?.share_token,
        selectError: selectError ? { message: selectError.message, code: selectError.code } : null 
      });

      if (selectError) {
        logger.error('[enablePublicSharing] Error checking existing preparation:', {
          message: selectError.message,
          code: selectError.code,
          details: selectError.details,
          hint: selectError.hint,
        });
        throw new Error(`Select failed: ${selectError.message} (code: ${selectError.code})`);
      }

      // Generate new token only if one doesn't exist
      const shareToken = existing?.share_token || this.generateShareToken();
      const now = new Date().toISOString();
      
      logger.info('[enablePublicSharing] Generated token:', { shareToken, isNew: !existing?.share_token });

      if (existing) {
        // Update existing record
        logger.info('[enablePublicSharing] Updating existing record:', { recordId: existing.id });
        const updatePayload = {
          share_token: shareToken,
          share_enabled: true,
          public_shared_at: existing.share_token ? undefined : now,
        };
        logger.info('[enablePublicSharing] Update payload:', updatePayload);
        
        const { error: updateError, data: updateData, status, statusText } = await supabase
          .from('sailor_race_preparation')
          .update(updatePayload)
          .eq('id', existing.id)
          .select();

        logger.info('[enablePublicSharing] Update response:', { 
          status, 
          statusText, 
          updateData,
          updateError: updateError ? { message: updateError.message, code: updateError.code, details: updateError.details, hint: updateError.hint } : null 
        });

        if (updateError) {
          logger.error('[enablePublicSharing] Error updating public sharing:', {
            message: updateError.message,
            code: updateError.code,
            details: updateError.details,
            hint: updateError.hint,
          });
          throw new Error(`Database error: ${updateError.message || 'Unknown error'} (code: ${updateError.code})`);
        }
      } else {
        // Insert new record
        logger.info('[enablePublicSharing] Inserting new record...');
        const insertPayload = {
          race_event_id: raceEventId,
          sailor_id: sailorId,
          share_token: shareToken,
          share_enabled: true,
          public_shared_at: now,
        };
        logger.info('[enablePublicSharing] Insert payload:', insertPayload);
        
        const { error: insertError, data: insertData, status, statusText } = await supabase
          .from('sailor_race_preparation')
          .insert(insertPayload)
          .select();

        logger.info('[enablePublicSharing] Insert response:', { 
          status, 
          statusText, 
          insertData,
          insertError: insertError ? { message: insertError.message, code: insertError.code, details: insertError.details, hint: insertError.hint } : null 
        });

        if (insertError) {
          logger.error('[enablePublicSharing] Error inserting public sharing record:', {
            message: insertError.message,
            code: insertError.code,
            details: insertError.details,
            hint: insertError.hint,
          });
          throw new Error(`Database error: ${insertError.message || 'Unknown error'} (code: ${insertError.code})`);
        }
      }

      const baseUrl = this.getBaseUrl();
      logger.info('Public sharing enabled successfully', { shareToken, url: `${baseUrl}/p/strategy/${shareToken}` });
      
      return {
        enabled: true,
        token: shareToken,
        url: `${baseUrl}/p/strategy/${shareToken}`,
        sharedAt: now,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      logger.error('[StrategicPlanningService] Failed to enable public sharing:', errorMessage);
      throw error;
    }
  }

  /**
   * Disable public sharing for a strategy
   * Keeps the token for potential re-enabling
   */
  async disablePublicSharing(
    raceEventId: string,
    sailorId: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('sailor_race_preparation')
        .update({
          share_enabled: false,
        })
        .eq('race_event_id', raceEventId)
        .eq('sailor_id', sailorId);

      if (error) {
        logger.error('Error disabling public sharing:', error);
        throw error;
      }

      logger.info('Public sharing disabled successfully');
      return true;
    } catch (error) {
      logger.error('Failed to disable public sharing:', error);
      return false;
    }
  }

  /**
   * Toggle public sharing on/off
   */
  async togglePublicSharing(
    raceEventId: string,
    sailorId: string,
    enabled: boolean
  ): Promise<PublicSharingStatus> {
    if (enabled) {
      return this.enablePublicSharing(raceEventId, sailorId);
    } else {
      await this.disablePublicSharing(raceEventId, sailorId);
      
      // Return current status after disabling
      const { data } = await supabase
        .from('sailor_race_preparation')
        .select('share_token, public_shared_at')
        .eq('race_event_id', raceEventId)
        .eq('sailor_id', sailorId)
        .maybeSingle();

      return {
        enabled: false,
        token: data?.share_token || null,
        url: null,
        sharedAt: data?.public_shared_at || null,
      };
    }
  }

  /**
   * Regenerate share token (invalidates old links)
   */
  async regenerateShareToken(
    raceEventId: string,
    sailorId: string
  ): Promise<PublicSharingStatus> {
    try {
      const newToken = this.generateShareToken();
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('sailor_race_preparation')
        .update({
          share_token: newToken,
          share_enabled: true,
          public_shared_at: now,
        })
        .eq('race_event_id', raceEventId)
        .eq('sailor_id', sailorId);

      if (error) {
        logger.error('Error regenerating share token:', error);
        throw error;
      }

      const baseUrl = this.getBaseUrl();
      logger.info('Share token regenerated successfully');
      
      return {
        enabled: true,
        token: newToken,
        url: `${baseUrl}/p/strategy/${newToken}`,
        sharedAt: now,
      };
    } catch (error) {
      logger.error('Failed to regenerate share token:', error);
      throw error;
    }
  }
}

export const strategicPlanningService = new StrategicPlanningService();
