/**
 * Race Timer Service
 * GPS-tracked countdown timer for race performance tracking
 * Records GPS track points and race conditions
 */

import { Platform } from 'react-native';
import { supabase } from './supabase';
import { createLogger } from '@/lib/utils/logger';
import { isMissingIdColumn } from '@/lib/utils/supabaseSchemaFallback';

// Dynamic import helper for expo-location (native only)
let LocationModule: typeof import('expo-location') | null = null;

async function getLocationModule() {
  if (Platform.OS === 'web') {
    return null;
  }
  if (!LocationModule) {
    LocationModule = await import('expo-location');
  }
  return LocationModule;
}

export interface GPSTrackPoint {
  timestamp: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  altitude?: number;
}

export interface RaceTimerSession {
  id: string;
  sailor_id: string;
  regatta_id?: string;
  race_id?: string;
  start_time: string;
  end_time?: string;
  duration_seconds?: number;
  track_points?: GPSTrackPoint[];
  wind_direction?: number;
  wind_speed?: number;
  wave_height?: number;
  position?: number;
  fleet_size?: number;
  auto_analyzed: boolean;
  created_at: string;
}

export interface RaceConditions {
  wind_direction?: number;
  wind_speed?: number;
  wave_height?: number;
}

const logger = createLogger('RaceTimerService');
export class RaceTimerService {
  private static activeSession: string | null = null;
  private static trackingInterval: ReturnType<typeof setInterval> | null = null;
  private static trackPoints: GPSTrackPoint[] = [];
  private static raceTimerSessionIdColumn: 'regatta_id' | 'race_id' = 'regatta_id';

  /**
   * Start a race timer session
   */
  static async startSession(
    sailorId: string,
    regattaId?: string,
    conditions?: RaceConditions
  ): Promise<RaceTimerSession | null> {
    const Location = await getLocationModule();
    if (!Location) {
      logger.error('Location tracking not available on web');
      return null;
    }

    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        logger.error('Location permission not granted');
        return null;
      }

      // Create session
      const createWithColumn = (column: 'regatta_id' | 'race_id') =>
        supabase
          .from('race_timer_sessions')
          .insert({
            sailor_id: sailorId,
            [column]: regattaId,
            start_time: new Date().toISOString(),
            wind_direction: conditions?.wind_direction,
            wind_speed: conditions?.wind_speed,
            wave_height: conditions?.wave_height,
          })
          .select()
          .single();

      let { data: session, error } = await createWithColumn(this.raceTimerSessionIdColumn);
      if (
        error &&
        this.raceTimerSessionIdColumn === 'regatta_id' &&
        isMissingIdColumn(error, 'race_timer_sessions', 'regatta_id')
      ) {
        const fallback = await createWithColumn('race_id');
        session = fallback.data;
        error = fallback.error;
        if (!error) {
          this.raceTimerSessionIdColumn = 'race_id';
        }
      }

      if (error) throw error;

      // Start GPS tracking
      this.activeSession = session.id;
      this.trackPoints = [];
      await this.startGPSTracking();

      return session;
    } catch (error) {
      logger.error('Error starting race timer session:', error);
      return null;
    }
  }

  /**
   * Start GPS tracking
   */
  private static async startGPSTracking(): Promise<void> {
    // Record GPS point immediately
    await this.recordGPSPoint();

    // Record GPS every 5 seconds
    this.trackingInterval = setInterval(async () => {
      await this.recordGPSPoint();
    }, 5000);
  }

  /**
   * Record a GPS track point
   */
  private static async recordGPSPoint(): Promise<void> {
    const Location = await getLocationModule();
    if (!Location) return;

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const trackPoint: GPSTrackPoint = {
        timestamp: new Date().toISOString(),
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        speed: location.coords.speed ?? undefined,
        heading: location.coords.heading ?? undefined,
        altitude: location.coords.altitude ?? undefined,
      };

      this.trackPoints.push(trackPoint);
    } catch (error) {
      logger.error('Error recording GPS point:', error);
    }
  }

  /**
   * Stop GPS tracking
   */
  private static stopGPSTracking(): void {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }
  }

  /**
   * End a race timer session
   */
  static async endSession(
    sessionId: string,
    position?: number,
    fleetSize?: number
  ): Promise<RaceTimerSession | null> {
    try {
      // Stop GPS tracking
      this.stopGPSTracking();

      const endTime = new Date().toISOString();

      // Get session start time to calculate duration
      const { data: existingSession } = await supabase
        .from('race_timer_sessions')
        .select('start_time')
        .eq('id', sessionId)
        .single();

      const durationSeconds = existingSession
        ? Math.floor(
            (new Date(endTime).getTime() - new Date(existingSession.start_time).getTime()) / 1000
          )
        : undefined;

      // Update session
      const { data: session, error } = await supabase
        .from('race_timer_sessions')
        .update({
          end_time: endTime,
          duration_seconds: durationSeconds,
          track_points: this.trackPoints,
          position,
          fleet_size: fleetSize,
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;

      // Clear active session
      this.activeSession = null;
      this.trackPoints = [];

      // Trigger AI analysis in background (don't wait for completion)
      this.triggerAnalysisInBackground(sessionId);

      return session;
    } catch (error) {
      logger.error('Error ending race timer session:', error);
      return null;
    }
  }

  /**
   * Trigger AI race analysis in background
   * This runs asynchronously and doesn't block the endSession method
   */
  private static async triggerAnalysisInBackground(sessionId: string): Promise<void> {
    try {
      // Import dynamically to avoid circular dependencies
      const { RaceAnalysisService } = await import('./RaceAnalysisService');

      // Trigger analysis (runs asynchronously)
      logger.debug('Triggering AI analysis for session:', sessionId);
      await RaceAnalysisService.analyzeRaceSession(sessionId);
      logger.debug('AI analysis completed for session:', sessionId);
    } catch (error) {
      // Log error but don't throw - this is a background operation
      logger.error('Error triggering AI analysis:', error);
    }
  }

  /**
   * Get active session
   */
  static getActiveSessionId(): string | null {
    return this.activeSession;
  }

  /**
   * Get current track point count
   */
  static getTrackPointCount(): number {
    return this.trackPoints.length;
  }

  /**
   * Get a race timer session
   */
  static async getSession(sessionId: string): Promise<RaceTimerSession | null> {
    try {
      const { data: session, error } = await supabase
        .from('race_timer_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) throw error;

      return session;
    } catch (error) {
      logger.error('Error getting race timer session:', error);
      return null;
    }
  }

  /**
   * Get all sessions for a sailor
   */
  static async getSailorSessions(sailorId: string, limit: number = 20): Promise<RaceTimerSession[]> {
    try {
      const { data: sessions, error } = await supabase
        .from('race_timer_sessions')
        .select('*')
        .eq('sailor_id', sailorId)
        .order('start_time', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return sessions || [];
    } catch (error) {
      logger.error('Error getting sailor sessions:', error);
      return [];
    }
  }

  /**
   * Get sessions for a regatta
   */
  static async getRegattaSessions(regattaId: string): Promise<RaceTimerSession[]> {
    try {
      const queryWithColumn = (column: 'regatta_id' | 'race_id') =>
        supabase
          .from('race_timer_sessions')
          .select('*')
          .eq(column, regattaId)
          .order('start_time', { ascending: false });

      let { data: sessions, error } = await queryWithColumn(this.raceTimerSessionIdColumn);
      if (
        error &&
        this.raceTimerSessionIdColumn === 'regatta_id' &&
        isMissingIdColumn(error, 'race_timer_sessions', 'regatta_id')
      ) {
        const fallback = await queryWithColumn('race_id');
        sessions = fallback.data;
        error = fallback.error;
        if (!error) {
          this.raceTimerSessionIdColumn = 'race_id';
        }
      }

      if (error) throw error;

      return sessions || [];
    } catch (error) {
      logger.error('Error getting regatta sessions:', error);
      return [];
    }
  }

  /**
   * Delete a session
   */
  static async deleteSession(sessionId: string, sailorId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('race_timer_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('sailor_id', sailorId)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Race timer session not found.');

      return true;
    } catch (error) {
      logger.error('Error deleting race timer session:', error);
      return false;
    }
  }

  /**
   * Update race conditions during session
   */
  static async updateConditions(
    sessionId: string,
    conditions: RaceConditions
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('race_timer_sessions')
        .update({
          wind_direction: conditions.wind_direction,
          wind_speed: conditions.wind_speed,
          wave_height: conditions.wave_height,
        })
        .eq('id', sessionId)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Race timer session not found.');

      return true;
    } catch (error) {
      logger.error('Error updating race conditions:', error);
      return false;
    }
  }

  /**
   * Check if session has been analyzed by AI
   */
  static async isAnalyzed(sessionId: string): Promise<boolean> {
    try {
      const { data: session, error } = await supabase
        .from('race_timer_sessions')
        .select('auto_analyzed')
        .eq('id', sessionId)
        .single();

      if (error) throw error;

      return session?.auto_analyzed || false;
    } catch (error) {
      logger.error('Error checking if session is analyzed:', error);
      return false;
    }
  }

  /**
   * Get unanalyzed sessions for a sailor
   */
  static async getUnanalyzedSessions(sailorId: string): Promise<RaceTimerSession[]> {
    try {
      const { data: sessions, error } = await supabase
        .from('race_timer_sessions')
        .select('*')
        .eq('sailor_id', sailorId)
        .eq('auto_analyzed', false)
        .not('end_time', 'is', null) // Only completed sessions
        .order('start_time', { ascending: false });

      if (error) throw error;

      return sessions || [];
    } catch (error) {
      logger.error('Error getting unanalyzed sessions:', error);
      return [];
    }
  }

  /**
   * Cancel active session (cleanup)
   */
  static async cancelActiveSession(): Promise<void> {
    if (this.activeSession) {
      // Stop GPS tracking
      this.stopGPSTracking();

      // Delete incomplete session
      await supabase
        .from('race_timer_sessions')
        .delete()
        .eq('id', this.activeSession);

      this.activeSession = null;
      this.trackPoints = [];
    }
  }
}
