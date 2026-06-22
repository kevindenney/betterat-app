/**
 * Race Signal Service
 * Live race status and flag signal broadcasting
 * SAILTI-competitive feature for real-time race communication
 */

import { supabase } from './supabase';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { realtimeService } from './RealtimeService';
import { isMissingIdColumn } from '@/lib/utils/supabaseSchemaFallback';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('RaceSignalService');

// ============================================================================
// TYPES
// ============================================================================

export type RaceFlag =
  | 'AP'        // Postponement
  | 'AP_A'      // Races postponed - no more racing today
  | 'AP_H'      // All racing postponed (AP over H)
  | 'AP_numeral' // AP + numeral pennant - postponed for that many minutes
  | 'N'         // Abandonment
  | 'N_A'       // All races abandoned - no more racing today  
  | 'N_H'       // All racing abandoned (N over H)
  | 'H'         // Come within hail
  | 'L'         // Come ashore
  | 'Y'         // Life jackets required
  | 'I'         // Rule 30.1 - Round ends of starting line
  | 'Z'         // Rule 30.2 - 20% penalty
  | 'U'         // Rule 30.3 - UFD rule
  | 'BLACK'     // Rule 30.4 - Black flag rule
  | 'P'         // Preparatory signal (4 min)
  | 'WARNING'   // Class flag (5 min warning)
  | 'RECALL_X'  // Individual recall (X flag)
  | 'RECALL_1'  // General recall (First substitute)
  | 'START'     // Race started
  | 'S'         // Shortened course
  | 'M'         // Mark missing
  | 'C'         // Course change
  | 'BLUE'      // Committee boat signals finishing position
  | 'ORANGE'    // Start/finish line mark
  | 'FIRST_SUB' // General recall
  | 'NUMERAL'   // Course designation
  | 'ANSWER';   // Answer pennant (during starting sequence)

export type RaceStatus =
  | 'scheduled'
  | 'postponed'
  | 'warning'
  | 'preparatory'
  | 'one_minute'
  | 'start'
  | 'racing'
  | 'shortened'
  | 'abandoned'
  | 'finished'
  | 'protesting';

export interface RaceSignal {
  id: string;
  regatta_id: string;
  race_number: number;
  fleet_id?: string;
  fleet_name?: string;
  
  // Signal info
  signal_type: 'flag' | 'sound' | 'status_change' | 'announcement' | 'course_change';
  flags?: RaceFlag[];
  sounds?: number;  // Number of sound signals
  status?: RaceStatus;
  
  // Content
  title: string;
  message?: string;
  course_designation?: string;
  
  // Timing
  signal_time: string;
  expires_at?: string;
  
  // Meta
  signaled_by?: string;
  is_active: boolean;
  created_at: string;
}

export interface LiveRaceState {
  regatta_id: string;
  race_number: number;
  fleet_id?: string;
  fleet_name?: string;
  status: RaceStatus;
  
  // Current flags
  active_flags: RaceFlag[];
  
  // Timing
  warning_time?: string;
  start_time?: string;
  
  // Start sequence
  sequence_started: boolean;
  time_to_start?: number;  // seconds until start
  
  // Course
  course_designation?: string;
  
  // Signals history
  recent_signals: RaceSignal[];
  
  last_updated: string;
}

export interface SignalInput {
  regatta_id: string;
  race_number: number;
  fleet_id?: string;
  signal_type: 'flag' | 'sound' | 'status_change' | 'announcement' | 'course_change';
  flags?: RaceFlag[];
  sounds?: number;
  status?: RaceStatus;
  title: string;
  message?: string;
  course_designation?: string;
  expires_in_minutes?: number;
}

// ============================================================================
// RACE SIGNAL SERVICE CLASS
// ============================================================================

class RaceSignalService {
  private signalWrappers: Map<
    string,
    Map<(signal: RaceSignal) => void, (payload: RealtimePostgresChangesPayload<RaceSignal>) => void>
  > = new Map();
  private raceSignalsIdColumn: 'regatta_id' | 'race_id' = 'regatta_id';
  private liveRaceStateIdColumn: 'regatta_id' | 'race_id' = 'regatta_id';

  // -------------------------------------------------------------------------
  // SIGNAL BROADCASTING
  // -------------------------------------------------------------------------

  /**
   * Broadcast a race signal
   */
  async broadcastSignal(input: SignalInput): Promise<RaceSignal> {
    const { data: user } = await supabase.auth.getUser();

    const expiresAt = input.expires_in_minutes
      ? new Date(Date.now() + input.expires_in_minutes * 60000).toISOString()
      : null;

    // Get fleet name if fleet_id provided
    let fleetName: string | undefined;
    if (input.fleet_id) {
      const { data: fleet } = await supabase
        .from('fleets')
        .select('name')
        .eq('id', input.fleet_id)
        .single();
      fleetName = fleet?.name;
    }

    const buildSignalPayload = (column: 'regatta_id' | 'race_id') => ({
      [column]: input.regatta_id,
      race_number: input.race_number,
      fleet_id: input.fleet_id,
      fleet_name: fleetName,
      signal_type: input.signal_type,
      flags: input.flags,
      sounds: input.sounds,
      status: input.status,
      title: input.title,
      message: input.message,
      course_designation: input.course_designation,
      signal_time: new Date().toISOString(),
      expires_at: expiresAt,
      signaled_by: user.user?.id,
      is_active: true,
    });

    let insertResult = await supabase
      .from('race_signals')
      .insert(buildSignalPayload(this.raceSignalsIdColumn))
      .select()
      .single();

    if (
      insertResult.error &&
      this.raceSignalsIdColumn === 'regatta_id' &&
      isMissingIdColumn(insertResult.error, 'race_signals', 'regatta_id')
    ) {
      insertResult = await supabase
        .from('race_signals')
        .insert(buildSignalPayload('race_id'))
        .select()
        .single();
      if (!insertResult.error) {
        this.raceSignalsIdColumn = 'race_id';
      }
    }

    const signal = insertResult.data;
    const error = insertResult.error;

    if (error) throw error;

    // Update race state if status changed
    if (input.status) {
      await this.updateRaceState(input.regatta_id, input.race_number, {
        status: input.status,
        active_flags: input.flags || [],
        course_designation: input.course_designation,
      }, input.fleet_id);
    }

    return signal;
  }

  /**
   * Quick signal presets
   */
  async signalPostponement(regattaId: string, raceNumber: number, minutes?: number, fleetId?: string): Promise<RaceSignal> {
    const flags: RaceFlag[] = minutes ? ['AP_numeral'] : ['AP'];
    const title = minutes 
      ? `Racing postponed ${minutes} minutes`
      : 'Racing postponed';

    return this.broadcastSignal({
      regatta_id: regattaId,
      race_number: raceNumber,
      fleet_id: fleetId,
      signal_type: 'flag',
      flags,
      sounds: 2,
      status: 'postponed',
      title,
      message: minutes ? `Races will resume in ${minutes} minutes` : 'Watch for further signals',
    });
  }

  async signalAbandonment(regattaId: string, raceNumber: number, resail: boolean, fleetId?: string): Promise<RaceSignal> {
    return this.broadcastSignal({
      regatta_id: regattaId,
      race_number: raceNumber,
      fleet_id: fleetId,
      signal_type: 'flag',
      flags: ['N'],
      sounds: 3,
      status: 'abandoned',
      title: 'Race abandoned',
      message: resail ? 'Race will be resailed' : 'No resail',
    });
  }

  async signalWarning(regattaId: string, raceNumber: number, fleetName: string, fleetId?: string): Promise<RaceSignal> {
    return this.broadcastSignal({
      regatta_id: regattaId,
      race_number: raceNumber,
      fleet_id: fleetId,
      signal_type: 'flag',
      flags: ['WARNING'],
      sounds: 1,
      status: 'warning',
      title: `${fleetName} - 5 minute warning`,
    });
  }

  async signalPreparatory(regattaId: string, raceNumber: number, fleetId?: string): Promise<RaceSignal> {
    return this.broadcastSignal({
      regatta_id: regattaId,
      race_number: raceNumber,
      fleet_id: fleetId,
      signal_type: 'flag',
      flags: ['P'],
      sounds: 1,
      status: 'preparatory',
      title: '4 minute signal - P flag up',
    });
  }

  async signalOneMinute(regattaId: string, raceNumber: number, fleetId?: string): Promise<RaceSignal> {
    return this.broadcastSignal({
      regatta_id: regattaId,
      race_number: raceNumber,
      fleet_id: fleetId,
      signal_type: 'sound',
      sounds: 1,
      status: 'one_minute',
      title: '1 minute signal',
    });
  }

  async signalStart(regattaId: string, raceNumber: number, fleetId?: string): Promise<RaceSignal> {
    return this.broadcastSignal({
      regatta_id: regattaId,
      race_number: raceNumber,
      fleet_id: fleetId,
      signal_type: 'flag',
      flags: ['START'],
      sounds: 1,
      status: 'racing',
      title: 'Start signal - race started',
    });
  }

  async signalIndividualRecall(regattaId: string, raceNumber: number, sailNumbers?: string[], fleetId?: string): Promise<RaceSignal> {
    const message = sailNumbers?.length
      ? `OCS: ${sailNumbers.join(', ')}`
      : 'One or more boats are OCS';

    return this.broadcastSignal({
      regatta_id: regattaId,
      race_number: raceNumber,
      fleet_id: fleetId,
      signal_type: 'flag',
      flags: ['RECALL_X'],
      sounds: 1,
      status: 'racing',
      title: 'Individual recall - X flag',
      message,
    });
  }

  async signalGeneralRecall(regattaId: string, raceNumber: number, fleetId?: string): Promise<RaceSignal> {
    return this.broadcastSignal({
      regatta_id: regattaId,
      race_number: raceNumber,
      fleet_id: fleetId,
      signal_type: 'flag',
      flags: ['RECALL_1', 'FIRST_SUB'],
      sounds: 2,
      status: 'scheduled',
      title: 'General recall - First substitute',
      message: 'Start sequence will restart',
    });
  }

  async signalShortenedCourse(regattaId: string, raceNumber: number, fleetId?: string): Promise<RaceSignal> {
    return this.broadcastSignal({
      regatta_id: regattaId,
      race_number: raceNumber,
      fleet_id: fleetId,
      signal_type: 'flag',
      flags: ['S'],
      sounds: 2,
      status: 'shortened',
      title: 'Course shortened',
      message: 'Finish at next rounding',
    });
  }

  async signalCourseChange(regattaId: string, raceNumber: number, newCourse: string, fleetId?: string): Promise<RaceSignal> {
    return this.broadcastSignal({
      regatta_id: regattaId,
      race_number: raceNumber,
      fleet_id: fleetId,
      signal_type: 'course_change',
      flags: ['C'],
      course_designation: newCourse,
      title: 'Course change',
      message: `New course: ${newCourse}`,
    });
  }

  async signalAnnouncement(regattaId: string, raceNumber: number, title: string, message: string, fleetId?: string): Promise<RaceSignal> {
    return this.broadcastSignal({
      regatta_id: regattaId,
      race_number: raceNumber,
      fleet_id: fleetId,
      signal_type: 'announcement',
      title,
      message,
      expires_in_minutes: 30,
    });
  }

  // -------------------------------------------------------------------------
  // RACE STATE
  // -------------------------------------------------------------------------

  /**
   * Update race state
   */
  private async updateRaceState(
    regattaId: string,
    raceNumber: number,
    updates: Partial<LiveRaceState>,
    fleetId?: string
  ): Promise<void> {
    const buildStatePayload = (column: 'regatta_id' | 'race_id') => ({
      [column]: regattaId,
      race_number: raceNumber,
      fleet_id: fleetId,
      ...updates,
      last_updated: new Date().toISOString(),
    });

    let stateResult = await supabase
      .from('live_race_state')
      .upsert(buildStatePayload(this.liveRaceStateIdColumn), {
        onConflict: `${this.liveRaceStateIdColumn},race_number,fleet_id`,
      });

    if (
      stateResult.error &&
      this.liveRaceStateIdColumn === 'regatta_id' &&
      isMissingIdColumn(stateResult.error, 'live_race_state', 'regatta_id')
    ) {
      stateResult = await supabase
        .from('live_race_state')
        .upsert(buildStatePayload('race_id'), {
          onConflict: 'race_id,race_number,fleet_id',
        });
      if (!stateResult.error) {
        this.liveRaceStateIdColumn = 'race_id';
      }
    }

    const { error } = stateResult;

    if (error) {
      logger.error('Error updating race state:', error);
    }
  }

  /**
   * Get current race state
   */
  async getRaceState(
    regattaId: string,
    raceNumber: number,
    fleetId?: string
  ): Promise<LiveRaceState | null> {
    let query = supabase
      .from('live_race_state')
      .select('*')
      .eq(this.liveRaceStateIdColumn, regattaId)
      .eq('race_number', raceNumber);

    if (fleetId) {
      query = query.eq('fleet_id', fleetId);
    } else {
      query = query.is('fleet_id', null);
    }

    let result = await query.single();
    if (
      result.error &&
      this.liveRaceStateIdColumn === 'regatta_id' &&
      isMissingIdColumn(result.error, 'live_race_state', 'regatta_id')
    ) {
      this.liveRaceStateIdColumn = 'race_id';
      let fallbackQuery = supabase
        .from('live_race_state')
        .select('*')
        .eq('race_id', regattaId)
        .eq('race_number', raceNumber);
      if (fleetId) {
        fallbackQuery = fallbackQuery.eq('fleet_id', fleetId);
      } else {
        fallbackQuery = fallbackQuery.is('fleet_id', null);
      }
      result = await fallbackQuery.single();
    }

    const { data, error } = result;
    if (error) {
      logger.warn('[RaceSignalService.getRaceState] Failed', { error, regattaId, raceNumber });
      return null;
    }
    return data;
  }

  /**
   * Get active signals for a regatta
   */
  async getActiveSignals(regattaId: string): Promise<RaceSignal[]> {
    let result = await supabase
      .from('race_signals')
      .select('*')
      .eq(this.raceSignalsIdColumn, regattaId)
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('signal_time', { ascending: false });

    if (
      result.error &&
      this.raceSignalsIdColumn === 'regatta_id' &&
      isMissingIdColumn(result.error, 'race_signals', 'regatta_id')
    ) {
      this.raceSignalsIdColumn = 'race_id';
      result = await supabase
        .from('race_signals')
        .select('*')
        .eq('race_id', regattaId)
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('signal_time', { ascending: false });
    }

    const { data, error } = result;

    if (error) throw error;
    return data || [];
  }

  /**
   * Get signal history
   */
  async getSignalHistory(
    regattaId: string,
    raceNumber?: number,
    limit: number = 50
  ): Promise<RaceSignal[]> {
    let query = supabase
      .from('race_signals')
      .select('*')
      .eq(this.raceSignalsIdColumn, regattaId)
      .order('signal_time', { ascending: false })
      .limit(limit);

    if (raceNumber) {
      query = query.eq('race_number', raceNumber);
    }

    let result = await query;
    if (
      result.error &&
      this.raceSignalsIdColumn === 'regatta_id' &&
      isMissingIdColumn(result.error, 'race_signals', 'regatta_id')
    ) {
      this.raceSignalsIdColumn = 'race_id';
      let fallbackQuery = supabase
        .from('race_signals')
        .select('*')
        .eq('race_id', regattaId)
        .order('signal_time', { ascending: false })
        .limit(limit);
      if (raceNumber) {
        fallbackQuery = fallbackQuery.eq('race_number', raceNumber);
      }
      result = await fallbackQuery;
    }
    const { data, error } = result;
    if (error) throw error;
    return data || [];
  }

  /**
   * Expire a signal
   */
  async expireSignal(signalId: string): Promise<void> {
    const { data, error } = await supabase
      .from('race_signals')
      .update({ is_active: false })
      .eq('id', signalId)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Race signal not found.');
  }

  // -------------------------------------------------------------------------
  // REALTIME SUBSCRIPTIONS
  // -------------------------------------------------------------------------

  /**
   * Subscribe to signals for a regatta
   */
  subscribeToSignals(
    regattaId: string,
    callback: (signal: RaceSignal) => void
  ): () => void {
    const channelKey = `signals:${regattaId}`;
    const wrappers = this.signalWrappers.get(channelKey) || new Map();

    if (!wrappers.has(callback)) {
      const wrapper = (payload: RealtimePostgresChangesPayload<RaceSignal>) => {
        const signal = payload.new as RaceSignal;
        const signalRaceId = (signal as any).regatta_id || (signal as any).race_id;
        if (signalRaceId !== regattaId) return;
        callback(signal);
      };
      wrappers.set(callback, wrapper);
      this.signalWrappers.set(channelKey, wrappers);

      realtimeService.subscribe<RaceSignal>(
        channelKey,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'race_signals',
        },
        wrapper
      );
    }

    // Return unsubscribe function
    return () => {
      const current = this.signalWrappers.get(channelKey);
      const wrapper = current?.get(callback);
      if (wrapper) {
        void realtimeService.unsubscribe(channelKey, wrapper);
        current!.delete(callback);
      }
      if (current && current.size === 0) {
        this.signalWrappers.delete(channelKey);
      }
    };
  }

  /**
   * Unsubscribe from all
   */
  unsubscribeAll(): void {
    for (const channelKey of this.signalWrappers.keys()) {
      void realtimeService.unsubscribe(channelKey);
    }
    this.signalWrappers.clear();
  }

  // -------------------------------------------------------------------------
  // FLAG INFO
  // -------------------------------------------------------------------------

  /**
   * Get flag description
   */
  getFlagInfo(flag: RaceFlag): { name: string; meaning: string; color: string } {
    const flagInfo: Record<RaceFlag, { name: string; meaning: string; color: string }> = {
      'AP': { name: 'AP (Answering Pennant)', meaning: 'Races not started are postponed', color: '#FFFFFF' },
      'AP_A': { name: 'AP over A', meaning: 'No more racing today', color: '#FFFFFF' },
      'AP_H': { name: 'AP over H', meaning: 'All racing postponed', color: '#FFFFFF' },
      'AP_numeral': { name: 'AP + Numeral', meaning: 'Postponed for indicated minutes', color: '#FFFFFF' },
      'N': { name: 'N (November)', meaning: 'Race abandoned', color: '#1E3A8A' },
      'N_A': { name: 'N over A', meaning: 'All races abandoned, no more today', color: '#1E3A8A' },
      'N_H': { name: 'N over H', meaning: 'All racing abandoned', color: '#1E3A8A' },
      'H': { name: 'H (Hotel)', meaning: 'Come within hail of committee', color: '#FFFFFF' },
      'L': { name: 'L (Lima)', meaning: 'Come ashore immediately', color: '#FBBF24' },
      'Y': { name: 'Y (Yankee)', meaning: 'Life jackets required', color: '#FBBF24' },
      'I': { name: 'I (India)', meaning: 'Rule 30.1 - Round ends of line', color: '#FBBF24' },
      'Z': { name: 'Z (Zulu)', meaning: 'Rule 30.2 - 20% penalty', color: '#FBBF24' },
      'U': { name: 'U (Uniform)', meaning: 'Rule 30.3 - UFD rule', color: '#EF4444' },
      'BLACK': { name: 'Black Flag', meaning: 'Rule 30.4 - Black flag rule', color: '#000000' },
      'P': { name: 'P (Papa)', meaning: 'Preparatory signal (4 min)', color: '#1E3A8A' },
      'WARNING': { name: 'Class Flag', meaning: '5 minute warning signal', color: '#10B981' },
      'RECALL_X': { name: 'X (X-ray)', meaning: 'Individual recall', color: '#1E3A8A' },
      'RECALL_1': { name: 'First Substitute', meaning: 'General recall', color: '#FBBF24' },
      'START': { name: 'Start', meaning: 'Race has started', color: '#10B981' },
      'S': { name: 'S (Sierra)', meaning: 'Course shortened', color: '#1E3A8A' },
      'M': { name: 'M (Mike)', meaning: 'Mark missing/displaced', color: '#FFFFFF' },
      'C': { name: 'C (Charlie)', meaning: 'Course change', color: '#EF4444' },
      'BLUE': { name: 'Blue Flag', meaning: 'Committee boat finishing', color: '#3B82F6' },
      'ORANGE': { name: 'Orange Flag', meaning: 'Start/finish line', color: '#F97316' },
      'FIRST_SUB': { name: 'First Substitute', meaning: 'General recall', color: '#FBBF24' },
      'NUMERAL': { name: 'Numeral Pennant', meaning: 'Course designation', color: '#1E3A8A' },
      'ANSWER': { name: 'Answer Pennant', meaning: 'Postponement/wait', color: '#EF4444' },
    };

    return flagInfo[flag] || { name: flag, meaning: 'Unknown flag', color: '#94A3B8' };
  }
}

// Export singleton
export const raceSignalService = new RaceSignalService();
export default RaceSignalService;
