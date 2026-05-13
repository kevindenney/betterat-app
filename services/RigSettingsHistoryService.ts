/**
 * Rig Settings History Service
 * 
 * Stores and retrieves actual rig settings used during races.
 * Enables sailors to track what worked and correlate with performance.
 */

import { supabase } from './supabase';
import { createLogger } from '@/lib/utils/logger';
import type { ActualRigSettingsData } from '@/components/races/ActualRigSettings';

const logger = createLogger('RigSettingsHistoryService');

export interface RigSettingHistoryEntry {
  id: string;
  sailorId: string;
  boatId?: string;
  regattaId?: string;
  raceEventId?: string;
  settings: {
    key: string;
    label: string;
    value: string;
    unit?: string;
  }[];
  windSpeedForecast?: number;
  windSpeedActual?: number;
  windDirectionForecast?: number;
  windDirectionActual?: number;
  waveHeight?: string;
  currentSpeed?: number;
  performanceRating?: number;
  finishPosition?: number;
  fleetSize?: number;
  notes?: string;
  conditionsMatchedForecast?: boolean;
  recommendedSettings?: any;
  deviationFromRecommended?: any;
  recordedAt: string;
  createdAt: string;
}

export interface SaveRigSettingsParams {
  sailorId: string;
  boatId?: string;
  regattaId?: string;
  raceEventId?: string;
  settings: ActualRigSettingsData;
  forecast?: {
    windSpeed?: number;
    windDirection?: number;
  };
  recommendedSettings?: any;
  finishPosition?: number;
  fleetSize?: number;
}

export interface GetHistoryParams {
  sailorId: string;
  boatId?: string;
  boatClassName?: string;
  windSpeedRange?: { min: number; max: number };
  performanceRatingMin?: number;
  limit?: number;
}

class RigSettingsHistoryService {
  /**
   * Save actual rig settings to history
   */
  async saveSettings(params: SaveRigSettingsParams): Promise<string | null> {
    const {
      sailorId,
      boatId,
      regattaId,
      raceEventId,
      settings,
      forecast,
      recommendedSettings,
      finishPosition,
      fleetSize,
    } = params;

    logger.debug('[RigSettingsHistoryService] Saving rig settings', {
      sailorId,
      boatId,
      regattaId,
      settingsCount: settings.settings.length,
    });

    try {
      // Calculate deviation from recommended if both are provided
      let deviationFromRecommended = null;
      if (recommendedSettings && settings.settings) {
        deviationFromRecommended = this.calculateDeviation(
          settings.settings,
          recommendedSettings
        );
      }

      const { data, error } = await supabase
        .from('rig_settings_history')
        .insert({
          sailor_id: sailorId,
          boat_id: boatId,
          regatta_id: regattaId,
          race_event_id: raceEventId,
          settings: settings.settings,
          wind_speed_forecast: forecast?.windSpeed,
          wind_speed_actual: settings.windActual?.speed,
          wind_direction_forecast: forecast?.windDirection,
          wind_direction_actual: settings.windActual?.direction,
          performance_rating: settings.performanceRating,
          finish_position: finishPosition,
          fleet_size: fleetSize,
          notes: settings.notes,
          conditions_matched_forecast: settings.conditionsMatchedForecast,
          recommended_settings: recommendedSettings,
          deviation_from_recommended: deviationFromRecommended,
          recorded_at: settings.recordedAt,
        })
        .select('id')
        .single();

      if (error) {
        logger.error('[RigSettingsHistoryService] Error saving settings:', error);
        return null;
      }

      logger.debug('[RigSettingsHistoryService] Settings saved:', data.id);
      return data.id;
    } catch (error) {
      logger.error('[RigSettingsHistoryService] Exception saving settings:', error);
      return null;
    }
  }

  /**
   * Save settings directly to a regatta record
   */
  async saveToRegatta(
    regattaId: string,
    settings: ActualRigSettingsData
  ): Promise<boolean> {
    logger.debug('[RigSettingsHistoryService] Saving to regatta', { regattaId });

    try {
      const { error } = await supabase
        .from('regattas')
        .update({
          actual_rig_settings: settings,
        })
        .eq('id', regattaId);

      if (error) {
        logger.error('[RigSettingsHistoryService] Error saving to regatta:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('[RigSettingsHistoryService] Exception saving to regatta:', error);
      return false;
    }
  }

  /**
   * Get settings history for analysis
   */
  async getHistory(params: GetHistoryParams): Promise<RigSettingHistoryEntry[]> {
    const {
      sailorId,
      boatId,
      windSpeedRange,
      performanceRatingMin,
      limit = 20,
    } = params;

    logger.debug('[RigSettingsHistoryService] Fetching history', params);

    try {
      let query = supabase
        .from('rig_settings_history')
        .select('*')
        .eq('sailor_id', sailorId)
        .order('recorded_at', { ascending: false })
        .limit(limit);

      if (boatId) {
        query = query.eq('boat_id', boatId);
      }

      if (windSpeedRange) {
        query = query
          .gte('wind_speed_actual', windSpeedRange.min)
          .lte('wind_speed_actual', windSpeedRange.max);
      }

      if (performanceRatingMin) {
        query = query.gte('performance_rating', performanceRatingMin);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('[RigSettingsHistoryService] Error fetching history:', error);
        return [];
      }

      return (data || []).map(this.mapDbToEntry);
    } catch (error) {
      logger.error('[RigSettingsHistoryService] Exception fetching history:', error);
      return [];
    }
  }

  /**
   * Get best performing settings for a wind range
   * Returns settings that had high performance ratings in similar conditions
   */
  async getBestSettingsForConditions(
    sailorId: string,
    boatId: string,
    windSpeed: number,
    tolerance: number = 4 // +/- knots
  ): Promise<RigSettingHistoryEntry | null> {
    logger.debug('[RigSettingsHistoryService] Finding best settings', {
      sailorId,
      boatId,
      windSpeed,
      tolerance,
    });

    try {
      const { data, error } = await supabase
        .from('rig_settings_history')
        .select('*')
        .eq('sailor_id', sailorId)
        .eq('boat_id', boatId)
        .gte('wind_speed_actual', windSpeed - tolerance)
        .lte('wind_speed_actual', windSpeed + tolerance)
        .gte('performance_rating', 4) // Only 4+ star ratings
        .order('performance_rating', { ascending: false })
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        logger.debug('[RigSettingsHistoryService] No best settings found');
        return null;
      }

      return this.mapDbToEntry(data);
    } catch (error) {
      logger.error('[RigSettingsHistoryService] Exception finding best settings:', error);
      return null;
    }
  }

  /**
   * Get settings from a specific regatta
   */
  async getRegattaSettings(regattaId: string): Promise<ActualRigSettingsData | null> {
    try {
      const { data, error } = await supabase
        .from('regattas')
        .select('actual_rig_settings')
        .eq('id', regattaId)
        .single();

      if (error || !data?.actual_rig_settings) {
        return null;
      }

      return data.actual_rig_settings as ActualRigSettingsData;
    } catch (error) {
      logger.error('[RigSettingsHistoryService] Error fetching regatta settings:', error);
      return null;
    }
  }

  /**
   * Calculate deviation between actual and recommended settings
   */
  private calculateDeviation(
    actual: { key: string; value: string }[],
    recommended: { key: string; value: string }[]
  ): Record<string, { recommended: string; actual: string; delta?: string }> {
    const deviation: Record<string, { recommended: string; actual: string; delta?: string }> = {};

    for (const actualSetting of actual) {
      const recSetting = recommended.find(r => r.key === actualSetting.key);
      if (recSetting && recSetting.value !== actualSetting.value) {
        // Try to extract numeric values for delta calculation
        const actualNum = this.extractNumber(actualSetting.value);
        const recNum = this.extractNumber(recSetting.value);

        deviation[actualSetting.key] = {
          recommended: recSetting.value,
          actual: actualSetting.value,
          delta:
            actualNum !== null && recNum !== null
              ? (actualNum - recNum).toString()
              : undefined,
        };
      }
    }

    return deviation;
  }

  /**
   * Extract numeric value from a setting string
   */
  private extractNumber(value: string): number | null {
    const match = value.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : null;
  }

  /**
   * Map database row to entry interface
   */
  private mapDbToEntry(row: any): RigSettingHistoryEntry {
    return {
      id: row.id,
      sailorId: row.sailor_id,
      boatId: row.boat_id,
      regattaId: row.regatta_id,
      raceEventId: row.race_event_id,
      settings: row.settings,
      windSpeedForecast: row.wind_speed_forecast,
      windSpeedActual: row.wind_speed_actual,
      windDirectionForecast: row.wind_direction_forecast,
      windDirectionActual: row.wind_direction_actual,
      waveHeight: row.wave_height,
      currentSpeed: row.current_speed,
      performanceRating: row.performance_rating,
      finishPosition: row.finish_position,
      fleetSize: row.fleet_size,
      notes: row.notes,
      conditionsMatchedForecast: row.conditions_matched_forecast,
      recommendedSettings: row.recommended_settings,
      deviationFromRecommended: row.deviation_from_recommended,
      recordedAt: row.recorded_at,
      createdAt: row.created_at,
    };
  }
}

export const rigSettingsHistoryService = new RigSettingsHistoryService();

