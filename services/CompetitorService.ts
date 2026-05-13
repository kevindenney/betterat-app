/**
 * Competitor Dashboard Service
 * 
 * Personal command center for sailors - boats, results, stats, alerts
 */

import { supabase } from './supabase';

// ============================================================================
// Types
// ============================================================================

export interface CompetitorBoat {
  id: string;
  user_id: string;
  name: string;
  sail_number: string;
  hull_number?: string;
  boat_class: string;
  class_association?: string;
  year_built?: number;
  builder?: string;
  designer?: string;
  hull_color?: string;
  ownership_type: OwnershipType;
  
  // Ratings
  phrf_rating?: number;
  phrf_certificate_number?: string;
  phrf_expiry?: string;
  irc_rating?: number;
  irc_certificate_number?: string;
  irc_expiry?: string;
  orc_rating?: number;
  orc_certificate_number?: string;
  orc_expiry?: string;
  custom_rating?: number;
  custom_rating_system?: string;
  
  // Documents
  measurement_certificate_url?: string;
  insurance_certificate_url?: string;
  registration_document_url?: string;
  photo_urls?: string[];
  
  is_active: boolean;
  is_primary: boolean;
  notes?: string;
  
  created_at: string;
  updated_at: string;
}

export type OwnershipType = 'owner' | 'co_owner' | 'charter' | 'crew';

export interface CompetitorAlert {
  id: string;
  user_id: string;
  alert_type: AlertType;
  regatta_id?: string;
  race_id?: string;
  club_id?: string;
  title: string;
  message: string;
  priority: AlertPriority;
  is_read: boolean;
  read_at?: string;
  action_url?: string;
  push_sent: boolean;
  email_sent: boolean;
  created_at: string;
  expires_at?: string;
  // Joined
  regatta?: { name: string };
  club?: { name: string; logo_url?: string };
}

export type AlertType = 
  | 'race_reminder'
  | 'results_posted'
  | 'schedule_change'
  | 'recall'
  | 'postponement'
  | 'abandonment'
  | 'protest_filed'
  | 'protest_hearing'
  | 'protest_decision'
  | 'check_in_reminder'
  | 'registration_open'
  | 'registration_closing'
  | 'weather_alert'
  | 'notice_posted'
  | 'standings_update';

export type AlertPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface CompetitorFavorite {
  id: string;
  user_id: string;
  favorite_type: 'club' | 'regatta' | 'series';
  club_id?: string;
  regatta_id?: string;
  notify_new_events: boolean;
  notify_results: boolean;
  notify_schedule_changes: boolean;
  created_at: string;
  // Joined
  club?: { name: string; logo_url?: string };
  regatta?: { name: string };
}

export interface RaceHistory {
  result_id: string;
  race_id: string;
  entry_id: string;
  user_id: string;
  sail_number: string;
  boat_name?: string;
  boat_class?: string;
  finish_position?: number;
  corrected_position?: number;
  points?: number;
  status_code?: string;
  finish_time?: string;
  elapsed_time_seconds?: number;
  race_name?: string;
  race_number?: number;
  scheduled_start?: string;
  regatta_name: string;
  regatta_id: string;
  regatta_start?: string;
  regatta_end?: string;
  club_name: string;
  club_id: string;
}

export interface UpcomingRace {
  entry_id: string;
  user_id: string;
  sail_number: string;
  boat_name?: string;
  boat_class?: string;
  entry_status: string;
  race_id: string;
  race_name?: string;
  race_number?: number;
  scheduled_start?: string;
  race_status: string;
  regatta_name: string;
  regatta_id: string;
  venue?: string;
  regatta_start?: string;
  regatta_end?: string;
  club_name: string;
  club_id: string;
  club_logo?: string;
  check_in_status?: string;
  checked_in_at?: string;
}

export interface CompetitorStats {
  user_id: string;
  total_races: number;
  total_regattas: number;
  first_places: number;
  second_places: number;
  third_places: number;
  podiums: number;
  dnf_count: number;
  dsq_count: number;
  dns_count: number;
  ocs_count: number;
  avg_finish?: number;
  best_finish?: number;
  races_this_year: number;
  podiums_this_year: number;
  recent_avg_finish?: number;
}

export interface SeriesStanding {
  series_id: string;
  series_name: string;
  regatta_id: string;
  club_name: string;
  position: number;
  total_entries: number;
  points: number;
  races_sailed: number;
  races_remaining: number;
}

export interface DashboardData {
  upcomingRaces: UpcomingRace[];
  recentResults: RaceHistory[];
  activeStandings: SeriesStanding[];
  alerts: CompetitorAlert[];
  stats: CompetitorStats | null;
  boats: CompetitorBoat[];
}

// ============================================================================
// Competitor Service Class
// ============================================================================

class CompetitorService {
  private async getClubMetaByIds(clubIds: string[]): Promise<Map<string, { name: string; logo_url?: string }>> {
    const map = new Map<string, { name: string; logo_url?: string }>();
    if (clubIds.length === 0) return map;

    const { data: clubsData } = await supabase
      .from('clubs')
      .select('id, name, club_name, logo_url')
      .in('id', clubIds);

    (clubsData || []).forEach((club: any) => {
      if (club?.id) {
        map.set(club.id, { name: club.name || club.club_name || 'Club', logo_url: club.logo_url || undefined });
      }
    });

    const missingIds = clubIds.filter((id) => !map.has(id));
    if (missingIds.length > 0) {
      const { data: yachtClubsData } = await supabase
        .from('yacht_clubs')
        .select('id, name, logo_url')
        .in('id', missingIds);

      (yachtClubsData || []).forEach((club: any) => {
        if (club?.id) {
          map.set(club.id, { name: club.name || 'Club', logo_url: club.logo_url || undefined });
        }
      });
    }

    return map;
  }

  // ==========================================================================
  // Boat Management
  // ==========================================================================
  
  /**
   * Get all boats for the current user
   */
  async getMyBoats(): Promise<CompetitorBoat[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const { data, error } = await supabase
      .from('competitor_boats')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('is_primary', { ascending: false })
      .order('name');
    
    if (error) throw error;
    return data || [];
  }
  
  /**
   * Get a single boat
   */
  async getBoat(boatId: string): Promise<CompetitorBoat | null> {
    const { data, error } = await supabase
      .from('competitor_boats')
      .select('*')
      .eq('id', boatId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }
  
  /**
   * Add a new boat
   */
  async addBoat(boat: Partial<CompetitorBoat>): Promise<CompetitorBoat> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const { data, error } = await supabase
      .from('competitor_boats')
      .insert({
        ...boat,
        user_id: user.id,
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
  
  /**
   * Update a boat
   */
  async updateBoat(boatId: string, updates: Partial<CompetitorBoat>): Promise<CompetitorBoat> {
    const { data, error } = await supabase
      .from('competitor_boats')
      .update(updates)
      .eq('id', boatId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
  
  /**
   * Delete a boat (soft delete)
   */
  async deleteBoat(boatId: string): Promise<void> {
    const { error } = await supabase
      .from('competitor_boats')
      .update({ is_active: false })
      .eq('id', boatId);
    
    if (error) throw error;
  }
  
  /**
   * Set primary boat
   */
  async setPrimaryBoat(boatId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    // Clear existing primary
    await supabase
      .from('competitor_boats')
      .update({ is_primary: false })
      .eq('user_id', user.id);
    
    // Set new primary
    const { error } = await supabase
      .from('competitor_boats')
      .update({ is_primary: true })
      .eq('id', boatId);
    
    if (error) throw error;
  }
  
  /**
   * Update boat rating
   */
  async updateRating(
    boatId: string, 
    ratingType: 'phrf' | 'irc' | 'orc' | 'custom',
    rating: number,
    certificateNumber?: string,
    expiryDate?: string
  ): Promise<CompetitorBoat> {
    const updates: Partial<CompetitorBoat> = {};
    
    switch (ratingType) {
      case 'phrf':
        updates.phrf_rating = rating;
        updates.phrf_certificate_number = certificateNumber;
        updates.phrf_expiry = expiryDate;
        break;
      case 'irc':
        updates.irc_rating = rating;
        updates.irc_certificate_number = certificateNumber;
        updates.irc_expiry = expiryDate;
        break;
      case 'orc':
        updates.orc_rating = rating;
        updates.orc_certificate_number = certificateNumber;
        updates.orc_expiry = expiryDate;
        break;
      case 'custom':
        updates.custom_rating = rating;
        break;
    }
    
    return this.updateBoat(boatId, updates);
  }
  
  // ==========================================================================
  // Race History & Results
  // ==========================================================================
  
  /**
   * Get race history for current user
   */
  async getRaceHistory(options?: {
    limit?: number;
    year?: number;
    boatClass?: string;
    clubId?: string;
  }): Promise<RaceHistory[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    let query = supabase
      .from('competitor_race_history')
      .select('*')
      .eq('user_id', user.id)
      .order('scheduled_start', { ascending: false });
    
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    
    if (options?.year) {
      query = query
        .gte('scheduled_start', `${options.year}-01-01`)
        .lt('scheduled_start', `${options.year + 1}-01-01`);
    }
    
    if (options?.boatClass) {
      query = query.eq('boat_class', options.boatClass);
    }
    
    if (options?.clubId) {
      query = query.eq('club_id', options.clubId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }
  
  /**
   * Get upcoming races for current user
   */
  async getUpcomingRaces(): Promise<UpcomingRace[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const { data, error } = await supabase
      .from('competitor_upcoming_races')
      .select('*')
      .eq('user_id', user.id);
    
    if (error) throw error;
    return data || [];
  }
  
  /**
   * Get competitor statistics
   */
  async getStats(): Promise<CompetitorStats | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const { data, error } = await supabase
      .from('competitor_statistics')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }
  
  /**
   * Get active series standings
   */
  async getSeriesStandings(): Promise<SeriesStanding[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const { data, error } = await supabase
      .rpc('get_competitor_series_standings', { p_user_id: user.id });
    
    if (error) throw error;
    return data || [];
  }
  
  // ==========================================================================
  // Alerts
  // ==========================================================================
  
  /**
   * Get alerts for current user
   */
  async getAlerts(options?: {
    unreadOnly?: boolean;
    limit?: number;
    types?: AlertType[];
  }): Promise<CompetitorAlert[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    let query = supabase
      .from('competitor_alerts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (options?.unreadOnly) {
      query = query.eq('is_read', false);
    }
    
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    
    if (options?.types && options.types.length > 0) {
      query = query.in('alert_type', options.types);
    }
    
    // Filter expired alerts
    query = query.or('expires_at.is.null,expires_at.gt.now()');
    
    const { data, error } = await query;
    if (error) throw error;
    const rows = data || [];

    const regattaIds = Array.from(
      new Set(rows.map((row: any) => row?.regatta_id).filter(Boolean))
    ) as string[];
    const clubIds = Array.from(
      new Set(rows.map((row: any) => row?.club_id).filter(Boolean))
    ) as string[];

    const regattaNameById = new Map<string, string>();
    if (regattaIds.length > 0) {
      const { data: regattasData } = await supabase
        .from('regattas')
        .select('id, name')
        .in('id', regattaIds);
      (regattasData || []).forEach((regatta: any) => {
        if (regatta?.id && regatta?.name) regattaNameById.set(regatta.id, regatta.name);
      });
    }

    const clubById = await this.getClubMetaByIds(clubIds);

    return rows.map((row: any) => ({
      ...row,
      regatta: row.regatta_id ? { name: regattaNameById.get(row.regatta_id) || 'Regatta' } : undefined,
      club: row.club_id ? clubById.get(row.club_id) : undefined,
    }));
  }
  
  /**
   * Get unread alert count
   */
  async getUnreadCount(): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const { count, error } = await supabase
      .from('competitor_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
      .or('expires_at.is.null,expires_at.gt.now()');
    
    if (error) throw error;
    return count || 0;
  }
  
  /**
   * Mark alert as read
   */
  async markAlertRead(alertId: string): Promise<void> {
    const { error } = await supabase
      .from('competitor_alerts')
      .update({ 
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', alertId);
    
    if (error) throw error;
  }
  
  /**
   * Mark all alerts as read
   */
  async markAllAlertsRead(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const { error } = await supabase
      .from('competitor_alerts')
      .update({ 
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('is_read', false);
    
    if (error) throw error;
  }
  
  /**
   * Delete alert
   */
  async deleteAlert(alertId: string): Promise<void> {
    const { error } = await supabase
      .from('competitor_alerts')
      .delete()
      .eq('id', alertId);
    
    if (error) throw error;
  }
  
  // ==========================================================================
  // Favorites
  // ==========================================================================
  
  /**
   * Get favorites
   */
  async getFavorites(): Promise<CompetitorFavorite[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const { data, error } = await supabase
      .from('competitor_favorites')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    const rows = data || [];

    const regattaIds = Array.from(
      new Set(rows.map((row: any) => row?.regatta_id).filter(Boolean))
    ) as string[];
    const clubIds = Array.from(
      new Set(rows.map((row: any) => row?.club_id).filter(Boolean))
    ) as string[];

    const regattaNameById = new Map<string, string>();
    if (regattaIds.length > 0) {
      const { data: regattasData } = await supabase
        .from('regattas')
        .select('id, name')
        .in('id', regattaIds);
      (regattasData || []).forEach((regatta: any) => {
        if (regatta?.id && regatta?.name) regattaNameById.set(regatta.id, regatta.name);
      });
    }

    const clubById = await this.getClubMetaByIds(clubIds);

    return rows.map((row: any) => ({
      ...row,
      regatta: row.regatta_id ? { name: regattaNameById.get(row.regatta_id) || 'Regatta' } : undefined,
      club: row.club_id ? clubById.get(row.club_id) : undefined,
    }));
  }
  
  /**
   * Add favorite club
   */
  async favoriteClub(clubId: string): Promise<CompetitorFavorite> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const { data, error } = await supabase
      .from('competitor_favorites')
      .insert({
        user_id: user.id,
        favorite_type: 'club',
        club_id: clubId,
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
  
  /**
   * Add favorite regatta
   */
  async favoriteRegatta(regattaId: string): Promise<CompetitorFavorite> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const { data, error } = await supabase
      .from('competitor_favorites')
      .insert({
        user_id: user.id,
        favorite_type: 'regatta',
        regatta_id: regattaId,
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
  
  /**
   * Remove favorite
   */
  async removeFavorite(favoriteId: string): Promise<void> {
    const { error } = await supabase
      .from('competitor_favorites')
      .delete()
      .eq('id', favoriteId);
    
    if (error) throw error;
  }
  
  /**
   * Update favorite notification settings
   */
  async updateFavoriteSettings(
    favoriteId: string, 
    settings: Partial<Pick<CompetitorFavorite, 'notify_new_events' | 'notify_results' | 'notify_schedule_changes'>>
  ): Promise<void> {
    const { error } = await supabase
      .from('competitor_favorites')
      .update(settings)
      .eq('id', favoriteId);
    
    if (error) throw error;
  }
  
  // ==========================================================================
  // Dashboard
  // ==========================================================================
  
  /**
   * Get complete dashboard data
   */
  async getDashboardData(): Promise<DashboardData> {
    const [
      upcomingRaces,
      recentResults,
      activeStandings,
      alerts,
      stats,
      boats,
    ] = await Promise.all([
      this.getUpcomingRaces(),
      this.getRaceHistory({ limit: 10 }),
      this.getSeriesStandings(),
      this.getAlerts({ unreadOnly: false, limit: 20 }),
      this.getStats(),
      this.getMyBoats(),
    ]);
    
    return {
      upcomingRaces,
      recentResults,
      activeStandings,
      alerts,
      stats,
      boats,
    };
  }
  
  // ==========================================================================
  // Performance Analysis
  // ==========================================================================
  
  /**
   * Get performance by boat class
   */
  async getPerformanceByClass(): Promise<{
    boat_class: string;
    races: number;
    avg_finish: number;
    podiums: number;
    best_finish: number;
  }[]> {
    const history = await this.getRaceHistory();
    
    const byClass = new Map<string, {
      races: number;
      finishes: number[];
      podiums: number;
    }>();
    
    for (const race of history) {
      if (!race.boat_class) continue;
      
      const current = byClass.get(race.boat_class) || {
        races: 0,
        finishes: [],
        podiums: 0,
      };
      
      current.races++;
      if (race.finish_position && race.finish_position > 0) {
        current.finishes.push(race.finish_position);
        if (race.finish_position <= 3) {
          current.podiums++;
        }
      }
      
      byClass.set(race.boat_class, current);
    }
    
    return Array.from(byClass.entries()).map(([boat_class, data]) => ({
      boat_class,
      races: data.races,
      avg_finish: data.finishes.length > 0 
        ? Math.round(data.finishes.reduce((a, b) => a + b, 0) / data.finishes.length * 10) / 10
        : 0,
      podiums: data.podiums,
      best_finish: data.finishes.length > 0 ? Math.min(...data.finishes) : 0,
    })).sort((a, b) => b.races - a.races);
  }
  
  /**
   * Get performance trend (last N races)
   */
  async getPerformanceTrend(races: number = 20): Promise<{
    race_name: string;
    regatta_name: string;
    date: string;
    position: number;
    fleet_size: number;
    percentage: number;
  }[]> {
    const history = await this.getRaceHistory({ limit: races });
    
    // This would need fleet size data - simplified for now
    return history
      .filter(r => r.finish_position && r.finish_position > 0)
      .map(r => ({
        race_name: r.race_name || `Race ${r.race_number}`,
        regatta_name: r.regatta_name,
        date: r.scheduled_start || '',
        position: r.finish_position!,
        fleet_size: 20, // Would come from actual data
        percentage: Math.round((1 - (r.finish_position! - 1) / 20) * 100),
      }));
  }
  
  // ==========================================================================
  // Utilities
  // ==========================================================================
  
  /**
   * Get alert type info
   */
  getAlertTypeInfo(type: AlertType): {
    label: string;
    icon: string;
    color: string;
  } {
    const types: Record<AlertType, { label: string; icon: string; color: string }> = {
      race_reminder: { label: 'Race Reminder', icon: '⏰', color: '#3b82f6' },
      results_posted: { label: 'Results Posted', icon: '🏆', color: '#16a34a' },
      schedule_change: { label: 'Schedule Change', icon: '📅', color: '#f59e0b' },
      recall: { label: 'Recall', icon: '🚩', color: '#dc2626' },
      postponement: { label: 'Postponement', icon: '⏸️', color: '#f59e0b' },
      abandonment: { label: 'Abandonment', icon: '🛑', color: '#dc2626' },
      protest_filed: { label: 'Protest Filed', icon: '⚠️', color: '#dc2626' },
      protest_hearing: { label: 'Hearing Scheduled', icon: '⚖️', color: '#8b5cf6' },
      protest_decision: { label: 'Protest Decision', icon: '📋', color: '#8b5cf6' },
      check_in_reminder: { label: 'Check-In', icon: '✅', color: '#3b82f6' },
      registration_open: { label: 'Registration Open', icon: '📝', color: '#16a34a' },
      registration_closing: { label: 'Closing Soon', icon: '⏳', color: '#f59e0b' },
      weather_alert: { label: 'Weather Alert', icon: '🌊', color: '#0ea5e9' },
      notice_posted: { label: 'Notice Posted', icon: '📢', color: '#6b7280' },
      standings_update: { label: 'Standings Update', icon: '📊', color: '#3b82f6' },
    };
    return types[type];
  }
  
  /**
   * Get priority info
   */
  getPriorityInfo(priority: AlertPriority): {
    label: string;
    color: string;
    bgColor: string;
  } {
    const priorities: Record<AlertPriority, { label: string; color: string; bgColor: string }> = {
      low: { label: 'Low', color: '#6b7280', bgColor: '#f3f4f6' },
      normal: { label: 'Normal', color: '#3b82f6', bgColor: '#eff6ff' },
      high: { label: 'High', color: '#f59e0b', bgColor: '#fef3c7' },
      urgent: { label: 'Urgent', color: '#dc2626', bgColor: '#fee2e2' },
    };
    return priorities[priority];
  }
  
  /**
   * Format finish position with suffix
   */
  formatPosition(position: number): string {
    if (position === 1) return '1st';
    if (position === 2) return '2nd';
    if (position === 3) return '3rd';
    return `${position}th`;
  }
  
  /**
   * Get position medal emoji
   */
  getPositionEmoji(position: number): string {
    if (position === 1) return '🥇';
    if (position === 2) return '🥈';
    if (position === 3) return '🥉';
    return '';
  }
}

// Export singleton instance
export const competitorService = new CompetitorService();
export default competitorService;
