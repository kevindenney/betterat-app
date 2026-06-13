/**
 * Check-In Service
 * Manages competitor check-in for race day operations
 * Supports manual check-in, QR code self-check-in, and auto-DNS
 */

import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { isMissingIdColumn } from '@/lib/utils/supabaseSchemaFallback';

// ============================================================================
// TYPES
// ============================================================================

export type CheckInStatus = 
  | 'pending'
  | 'checked_in'
  | 'late'
  | 'scratched'
  | 'dns_auto'
  | 'dns_manual';

export type CheckInMethod = 
  | 'manual'
  | 'self_qr'
  | 'self_app'
  | 'radio'
  | 'visual';

export interface CheckIn {
  id: string;
  regatta_id: string;
  race_number: number;
  entry_id: string;
  status: CheckInStatus;
  checked_in_at?: string;
  checked_in_by?: string;
  check_in_method?: CheckInMethod;
  scratched_at?: string;
  scratch_reason?: string;
  notes?: string;
  check_in_location?: string;
  latitude?: number;
  longitude?: number;
  entry?: {
    sail_number: string;
    boat_name?: string;
    skipper_name?: string;
    entry_class?: string;
    division?: string;
  };
}

export interface RaceCheckInConfig {
  race_number: number;
  check_in_enabled: boolean;
  check_in_opens_at?: string;
  check_in_closes_at?: string;
  auto_dns_on_start: boolean;
  self_check_in_enabled: boolean;
  check_in_qr_token?: string;
}

export interface CheckInSummary {
  regatta_id: string;
  race_number: number;
  total_entries: number;
  checked_in: number;
  late: number;
  pending: number;
  scratched: number;
  dns: number;
  check_in_percentage: number;
}

export interface FleetStatus {
  total: number;
  checkedIn: number;
  pending: number;
  scratched: number;
  dns: number;
  percentage: number;
  byDivision?: Record<string, {
    total: number;
    checkedIn: number;
    pending: number;
  }>;
  byClass?: Record<string, {
    total: number;
    checkedIn: number;
    pending: number;
  }>;
}

// ============================================================================
// CHECK-IN SERVICE CLASS
// ============================================================================

class CheckInService {
  private raceResultsIdColumn: 'regatta_id' | 'race_id' = 'regatta_id';
  private subscriptions: Map<string, RealtimeChannel> = new Map();
  private listeners: Map<string, Set<(checkIn: CheckIn) => void>> = new Map();

  private async upsertRaceResultWithFallback(
    regattaId: string,
    raceNumber: number,
    entryId: string,
    payload: Record<string, any>
  ): Promise<void> {
    const attempt = async (column: 'regatta_id' | 'race_id') => supabase
      .from('race_results')
      .upsert({
        [column]: regattaId,
        race_number: raceNumber,
        entry_id: entryId,
        ...payload,
      }, {
        onConflict: `${column},race_number,entry_id`,
      });

    const current = this.raceResultsIdColumn;
    let { error } = await attempt(current);
    if (error && current === 'regatta_id' && isMissingIdColumn(error, 'race_results', current)) {
      const fallback = await attempt('race_id');
      error = fallback.error;
      if (!error) {
        this.raceResultsIdColumn = 'race_id';
      }
    }

    if (error) throw error;
  }

  // -------------------------------------------------------------------------
  // CHECK-IN OPERATIONS
  // -------------------------------------------------------------------------

  /**
   * Check in a competitor
   */
  async checkIn(
    regattaId: string,
    raceNumber: number,
    entryId: string,
    options?: {
      method?: CheckInMethod;
      location?: string;
      latitude?: number;
      longitude?: number;
      notes?: string;
    }
  ): Promise<CheckIn> {
    const { data: user } = await supabase.auth.getUser();
    
    // Get race config to check if late
    const { data: race } = await supabase
      .from('regatta_races')
      .select('check_in_closes_at')
      .eq('regatta_id', regattaId)
      .eq('race_number', raceNumber)
      .single();

    const isLate = race?.check_in_closes_at && 
      new Date() > new Date(race.check_in_closes_at);

    const { data, error } = await supabase
      .from('race_check_ins')
      .update({
        status: isLate ? 'late' : 'checked_in',
        checked_in_at: new Date().toISOString(),
        checked_in_by: user.user?.id,
        check_in_method: options?.method || 'manual',
        check_in_location: options?.location,
        latitude: options?.latitude,
        longitude: options?.longitude,
        notes: options?.notes,
      })
      .eq('regatta_id', regattaId)
      .eq('race_number', raceNumber)
      .eq('entry_id', entryId)
      .select(`
        *,
        entry:entry_id (
          sail_number,
          boat_name,
          skipper_name,
          entry_class,
          division
        )
      `)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Quick batch check-in (for multiple boats at once)
   */
  async batchCheckIn(
    regattaId: string,
    raceNumber: number,
    entryIds: string[],
    method: CheckInMethod = 'manual'
  ): Promise<number> {
    const { data: user } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('race_check_ins')
      .update({
        status: 'checked_in',
        checked_in_at: new Date().toISOString(),
        checked_in_by: user.user?.id,
        check_in_method: method,
      })
      .eq('regatta_id', regattaId)
      .eq('race_number', raceNumber)
      .in('entry_id', entryIds)
      .eq('status', 'pending')
      .select();

    if (error) throw error;
    return data?.length || 0;
  }

  /**
   * Self check-in via QR code token
   * Now supports both race_entries and race_participants
   */
  async selfCheckIn(
    qrToken: string,
    entryId: string,
    location?: { latitude: number; longitude: number }
  ): Promise<CheckIn> {
    // Find race by QR token
    const { data: race, error: raceError } = await supabase
      .from('regatta_races')
      .select('regatta_id, race_number, self_check_in_enabled, check_in_closes_at')
      .eq('check_in_qr_token', qrToken)
      .single();

    if (raceError || !race) {
      throw new Error('Invalid QR code');
    }

    if (!race.self_check_in_enabled) {
      throw new Error('Self check-in is not enabled for this race');
    }

    // Check if deadline passed
    const isLate = race.check_in_closes_at && 
      new Date() > new Date(race.check_in_closes_at);

    // Verify current user is registered for this race
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      throw new Error('You must be logged in to check in');
    }

    // Check if user is registered as a participant (new simpler registration)
    const { data: participant } = await supabase
      .from('race_participants')
      .select('id, user_id, regatta_id')
      .eq('regatta_id', race.regatta_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!participant && !entryId) {
      throw new Error('You must register for this race before checking in. Please register first.');
    }

    // If entryId provided, verify it belongs to this regatta and user
    if (entryId) {
      const { data: entry, error: entryError } = await supabase
        .from('race_entries')
        .select('id, sailor_id')
        .eq('id', entryId)
        .eq('regatta_id', race.regatta_id)
        .single();

      if (entryError || !entry) {
        throw new Error('Entry not found for this regatta');
      }

      if (entry.sailor_id !== user.id) {
        throw new Error('You can only check in your own entry');
      }
    }

    // Perform check-in
    const { data, error } = await supabase
      .from('race_check_ins')
      .update({
        status: isLate ? 'late' : 'checked_in',
        checked_in_at: new Date().toISOString(),
        checked_in_by: user.id,
        check_in_method: 'self_qr',
        latitude: location?.latitude,
        longitude: location?.longitude,
      })
      .eq('regatta_id', race.regatta_id)
      .eq('race_number', race.race_number)
      .eq('entry_id', entryId)
      .select(`
        *,
        entry:entry_id (
          sail_number,
          boat_name,
          skipper_name
        )
      `)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Scratch an entry (withdraw before race)
   */
  async scratch(
    regattaId: string,
    raceNumber: number,
    entryId: string,
    reason?: string
  ): Promise<void> {
    const { error } = await supabase
      .from('race_check_ins')
      .update({
        status: 'scratched',
        scratched_at: new Date().toISOString(),
        scratch_reason: reason,
      })
      .eq('regatta_id', regattaId)
      .eq('race_number', raceNumber)
      .eq('entry_id', entryId);

    if (error) throw error;
  }

  /**
   * Manual DNS (mark as not starting)
   */
  async markDNS(
    regattaId: string,
    raceNumber: number,
    entryId: string,
    notes?: string
  ): Promise<void> {
    const { error } = await supabase
      .from('race_check_ins')
      .update({
        status: 'dns_manual',
        notes,
      })
      .eq('regatta_id', regattaId)
      .eq('race_number', raceNumber)
      .eq('entry_id', entryId);

    if (error) throw error;

    // Also update race results if they exist
    await this.upsertRaceResultWithFallback(regattaId, raceNumber, entryId, {
      status: 'dns',
      score_code: 'DNS',
    });
  }

  /**
   * Undo check-in (reset to pending)
   */
  async undoCheckIn(
    regattaId: string,
    raceNumber: number,
    entryId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('race_check_ins')
      .update({
        status: 'pending',
        checked_in_at: null,
        checked_in_by: null,
        check_in_method: null,
      })
      .eq('regatta_id', regattaId)
      .eq('race_number', raceNumber)
      .eq('entry_id', entryId);

    if (error) throw error;
  }

  // -------------------------------------------------------------------------
  // ROSTER & STATUS
  // -------------------------------------------------------------------------

  /**
   * Get check-in roster for a race
   */
  async getRoster(regattaId: string, raceNumber: number): Promise<CheckIn[]> {
    const { data, error } = await supabase
      .from('race_check_ins')
      .select(`
        *,
        entry:entry_id (
          sail_number,
          boat_name,
          skipper_name,
          entry_class,
          division
        )
      `)
      .eq('regatta_id', regattaId)
      .eq('race_number', raceNumber)
      .order('entry(sail_number)');

    if (error) throw error;
    return data || [];
  }

  /**
   * Get check-in summary for a race
   */
  async getSummary(regattaId: string, raceNumber: number): Promise<CheckInSummary> {
    const { data, error } = await supabase
      .from('race_check_in_summary')
      .select('*')
      .eq('regatta_id', regattaId)
      .eq('race_number', raceNumber)
      .single();

    if (error) {
      // Return empty summary if none exists
      return {
        regatta_id: regattaId,
        race_number: raceNumber,
        total_entries: 0,
        checked_in: 0,
        late: 0,
        pending: 0,
        scratched: 0,
        dns: 0,
        check_in_percentage: 0,
      };
    }

    return data;
  }

  /**
   * Get detailed fleet status with breakdowns
   */
  async getFleetStatus(regattaId: string, raceNumber: number): Promise<FleetStatus> {
    const roster = await this.getRoster(regattaId, raceNumber);

    const status: FleetStatus = {
      total: roster.length,
      checkedIn: roster.filter(r => r.status === 'checked_in' || r.status === 'late').length,
      pending: roster.filter(r => r.status === 'pending').length,
      scratched: roster.filter(r => r.status === 'scratched').length,
      dns: roster.filter(r => r.status === 'dns_auto' || r.status === 'dns_manual').length,
      percentage: 0,
      byDivision: {},
      byClass: {},
    };

    status.percentage = status.total > 0 
      ? Math.round((status.checkedIn / status.total) * 100) 
      : 0;

    // Group by division
    roster.forEach(r => {
      const division = r.entry?.division || 'Unassigned';
      if (!status.byDivision![division]) {
        status.byDivision![division] = { total: 0, checkedIn: 0, pending: 0 };
      }
      status.byDivision![division].total++;
      if (r.status === 'checked_in' || r.status === 'late') {
        status.byDivision![division].checkedIn++;
      } else if (r.status === 'pending') {
        status.byDivision![division].pending++;
      }
    });

    // Group by class
    roster.forEach(r => {
      const boatClass = r.entry?.entry_class || 'Unknown';
      if (!status.byClass![boatClass]) {
        status.byClass![boatClass] = { total: 0, checkedIn: 0, pending: 0 };
      }
      status.byClass![boatClass].total++;
      if (r.status === 'checked_in' || r.status === 'late') {
        status.byClass![boatClass].checkedIn++;
      } else if (r.status === 'pending') {
        status.byClass![boatClass].pending++;
      }
    });

    return status;
  }

  /**
   * Get pending entries (not yet checked in)
   */
  async getPendingEntries(regattaId: string, raceNumber: number): Promise<CheckIn[]> {
    const { data, error } = await supabase
      .from('race_check_ins')
      .select(`
        *,
        entry:entry_id (
          sail_number,
          boat_name,
          skipper_name,
          entry_class
        )
      `)
      .eq('regatta_id', regattaId)
      .eq('race_number', raceNumber)
      .eq('status', 'pending')
      .order('entry(sail_number)');

    if (error) throw error;
    return data || [];
  }

  // -------------------------------------------------------------------------
  // RACE CONFIGURATION
  // -------------------------------------------------------------------------

  /**
   * Get check-in config for a race
   */
  async getRaceConfig(regattaId: string, raceNumber: number): Promise<RaceCheckInConfig | null> {
    const { data, error } = await supabase
      .from('regatta_races')
      .select(`
        race_number,
        check_in_enabled,
        check_in_opens_at,
        check_in_closes_at,
        auto_dns_on_start,
        self_check_in_enabled,
        check_in_qr_token
      `)
      .eq('regatta_id', regattaId)
      .eq('race_number', raceNumber)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Update check-in config for a race
   */
  async updateRaceConfig(
    regattaId: string,
    raceNumber: number,
    config: Partial<RaceCheckInConfig>
  ): Promise<void> {
    const { error } = await supabase
      .from('regatta_races')
      .update({
        check_in_enabled: config.check_in_enabled,
        check_in_opens_at: config.check_in_opens_at,
        check_in_closes_at: config.check_in_closes_at,
        auto_dns_on_start: config.auto_dns_on_start,
        self_check_in_enabled: config.self_check_in_enabled,
      })
      .eq('regatta_id', regattaId)
      .eq('race_number', raceNumber);

    if (error) throw error;
  }

  /**
   * Initialize check-in records for a race
   */
  async initializeCheckIns(regattaId: string, raceNumber: number): Promise<number> {
    // Get all confirmed entries
    const { data: entries, error: entriesError } = await supabase
      .from('race_entries')
      .select('id')
      .eq('regatta_id', regattaId)
      .eq('status', 'confirmed');

    if (entriesError) throw entriesError;

    if (!entries || entries.length === 0) return 0;

    // Create check-in records
    const records = entries.map(e => ({
      regatta_id: regattaId,
      race_number: raceNumber,
      entry_id: e.id,
      status: 'pending' as CheckInStatus,
    }));

    const { data, error } = await supabase
      .from('race_check_ins')
      .upsert(records, {
        onConflict: 'regatta_id,race_number,entry_id',
        ignoreDuplicates: true,
      })
      .select();

    if (error) throw error;
    return data?.length || 0;
  }

  // -------------------------------------------------------------------------
  // QR CODE
  // -------------------------------------------------------------------------

  /**
   * Generate QR code URL for self-check-in
   */
  getQRCodeUrl(qrToken: string, baseUrl: string = 'https://regattaflow.com'): string {
    return `${baseUrl}/check-in/${qrToken}`;
  }

  /**
   * Regenerate QR token for a race
   */
  async regenerateQRToken(regattaId: string, raceNumber: number): Promise<string> {
    const newToken = this.generateToken();
    
    const { error } = await supabase
      .from('regatta_races')
      .update({ check_in_qr_token: newToken })
      .eq('regatta_id', regattaId)
      .eq('race_number', raceNumber);

    if (error) throw error;
    return newToken;
  }

  private generateToken(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }

  // -------------------------------------------------------------------------
  // NOTIFICATIONS
  // -------------------------------------------------------------------------

  /**
   * Get entries that need reminders
   */
  async getEntriesNeedingReminder(
    regattaId: string,
    raceNumber: number,
    minutesBeforeDeadline: number = 30
  ): Promise<CheckIn[]> {
    // Get race deadline
    const { data: race } = await supabase
      .from('regatta_races')
      .select('check_in_closes_at')
      .eq('regatta_id', regattaId)
      .eq('race_number', raceNumber)
      .single();

    if (!race?.check_in_closes_at) return [];

    const deadline = new Date(race.check_in_closes_at);
    const reminderTime = new Date(deadline.getTime() - minutesBeforeDeadline * 60000);
    
    if (new Date() < reminderTime) return [];

    const { data: remindedRows, error: remindedError } = await supabase
      .from('check_in_notifications')
      .select('entry_id')
      .eq('regatta_id', regattaId)
      .eq('race_number', raceNumber)
      .eq('notification_type', 'reminder');

    if (remindedError) throw remindedError;

    const remindedEntryIds = Array.from(
      new Set((remindedRows || []).map((row) => row.entry_id).filter(Boolean)),
    );

    // Get pending entries that haven't been reminded.
    let pendingQuery = supabase
      .from('race_check_ins')
      .select(`
        *,
        entry:entry_id (
          sail_number,
          boat_name,
          skipper_name
        )
      `)
      .eq('regatta_id', regattaId)
      .eq('race_number', raceNumber)
      .eq('status', 'pending');

    if (remindedEntryIds.length > 0) {
      pendingQuery = pendingQuery.not('entry_id', 'in', `(${remindedEntryIds.join(',')})`);
    }

    const { data, error } = await pendingQuery;

    if (error) throw error;
    return data || [];
  }

  /**
   * Record notification sent
   */
  async recordNotification(
    regattaId: string,
    raceNumber: number,
    entryId: string,
    type: 'reminder' | 'warning' | 'dns_notice',
    via: 'push' | 'sms' | 'email'
  ): Promise<void> {
    const { error } = await supabase
      .from('check_in_notifications')
      .insert({
        regatta_id: regattaId,
        race_number: raceNumber,
        entry_id: entryId,
        notification_type: type,
        sent_via: via,
      });

    if (error) throw error;
  }

  // -------------------------------------------------------------------------
  // REAL-TIME SUBSCRIPTIONS
  // -------------------------------------------------------------------------

  /**
   * Subscribe to check-in changes for a race
   */
  subscribeToCheckIns(
    regattaId: string,
    raceNumber: number,
    callback: (checkIn: CheckIn) => void
  ) {
    const channelKey = `check-ins:${regattaId}:${raceNumber}`;
    const existingListeners = this.listeners.get(channelKey) || new Set();
    existingListeners.add(callback);
    this.listeners.set(channelKey, existingListeners);

    if (!this.subscriptions.has(channelKey)) {
      const channel = supabase
        .channel(channelKey)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'race_check_ins',
            filter: `regatta_id=eq.${regattaId}&race_number=eq.${raceNumber}`,
          },
          (payload) => {
            const checkIn = payload.new as CheckIn;
            const listeners = this.listeners.get(channelKey);
            if (!listeners || listeners.size === 0) return;
            listeners.forEach((listener) => {
              try {
                listener(checkIn);
              } catch (_err) {
                // Listener errors are isolated so one callback cannot break stream fan-out.
              }
            });
          }
        )
        .subscribe();
      this.subscriptions.set(channelKey, channel);
    }

    return () => this.unsubscribeFromCheckIns(regattaId, raceNumber, callback);
  }

  /**
   * Unsubscribe from check-in changes
   */
  unsubscribeFromCheckIns(
    regattaId: string,
    raceNumber: number,
    callback?: (checkIn: CheckIn) => void
  ) {
    const channelKey = `check-ins:${regattaId}:${raceNumber}`;
    const listeners = this.listeners.get(channelKey);

    if (listeners && callback) {
      listeners.delete(callback);
    } else if (listeners) {
      listeners.clear();
    }

    const remaining = this.listeners.get(channelKey);
    if (remaining && remaining.size > 0) {
      return;
    }

    const channel = this.subscriptions.get(channelKey);
    if (channel) {
      void supabase.removeChannel(channel);
      this.subscriptions.delete(channelKey);
    }
    this.listeners.delete(channelKey);
  }
}

// Export singleton
export const checkInService = new CheckInService();
export default CheckInService;
