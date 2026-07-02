/**
 * Club Management Service
 * Marine-grade yacht club management for professional sailing platform
 * Handles club operations, race creation, and sailor data distribution
 */

// @ts-nocheck

import { supabase } from '@/services/supabase';
import { raceDataDistribution } from '@/services/raceDataDistribution';
import { ClubRole, hasAdminAccess } from '@/types/club';

export interface Club {
  id: string;
  name: string;
  short_name: string;
  description?: string;
  location: {
    lat: number;
    lng: number;
    address: string;
    city: string;
    country: string;
  };
  website?: string;
  email?: string;
  phone?: string;
  logo_url?: string;

  // Sailing specifics
  sailing_area: {
    name: string;
    boundaries: { lat: number; lng: number }[];
    hazards: string[];
    typical_conditions: string;
  };

  // Club details
  established_year?: number;
  membership_count?: number;
  club_type: 'yacht_club' | 'sailing_club' | 'racing_organization' | 'marina';
  facilities: string[];

  // BetterAt integration
  subscription_tier: 'free' | 'club_basic' | 'club_pro' | 'club_enterprise';
  subscription_status: 'active' | 'inactive' | 'trial';
  created_at: string;
  updated_at: string;
}

export interface ClubMember {
  id: string;
  club_id: string;
  user_id: string;
  role: ClubRole;
  permissions: string[];
  joined_at: string;
  is_active: boolean;

  // Member details
  member_number?: string;
  member_since?: string;
  boat_details?: {
    name: string;
    class: string;
    sail_number: string;
    hull_color: string;
  };
}

export interface RaceEvent {
  id: string;
  club_id: string;

  // Race details
  name: string;
  description?: string;
  race_type: 'fleet_race' | 'match_race' | 'team_race' | 'pursuit_race';
  sailing_class: string;

  // Scheduling
  start_date: string;
  end_date: string;
  registration_deadline: string;
  max_participants?: number;

  // Course information
  race_course: {
    type: 'windward_leeward' | 'triangle' | 'olympic' | 'custom';
    marks: {
      id: string;
      name: string;
      lat: number;
      lng: number;
      type: 'start' | 'windward' | 'leeward' | 'gate' | 'finish';
    }[];
    instructions: string;
    safety_notes: string[];
  };

  // Conditions
  wind_conditions: {
    min_wind: number;
    max_wind: number;
    direction_range: string;
  };

  // Registration
  entry_fee?: number;
  registration_form_url?: string;
  requirements: string[];

  // Status
  status: 'draft' | 'published' | 'registration_open' | 'registration_closed' | 'in_progress' | 'completed' | 'cancelled';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RaceRegistration {
  id: string;
  race_id: string;
  user_id: string;

  // Boat details
  boat_name: string;
  sail_number: string;
  boat_class: string;
  skipper_name: string;
  crew_names: string[];

  // Registration details
  registration_date: string;
  payment_status: 'pending' | 'paid' | 'cancelled' | 'refunded';
  payment_amount?: number;

  // Special requirements
  dietary_requirements?: string;
  emergency_contact: {
    name: string;
    phone: string;
    relationship: string;
  };

  status: 'registered' | 'confirmed' | 'cancelled' | 'dnf' | 'dsq';
}

/**
 * Club Management Service Class
 */
export class ClubService {
  private static instance: ClubService;

  static getInstance(): ClubService {
    if (!ClubService.instance) {
      ClubService.instance = new ClubService();
    }
    return ClubService.instance;
  }

  /**
   * Get club details by ID
   */
  async getClub(clubId: string): Promise<Club | null> {
    try {
      const { data, error } = await supabase
        .from('clubs')
        .select('*')
        .eq('id', clubId)
        .single();

      if (error) {

        return null;
      }

      return data as Club;
    } catch (error) {

      return null;
    }
  }

  /**
   * Get clubs that user is a member of
   */
  async getUserClubs(userId: string): Promise<Club[]> {
    try {
      const { data, error } = await supabase
        .from('club_members')
        .select(`
          club_id,
          role,
          clubs (*)
        `)
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {

        return [];
      }

      return data.map(item => item.clubs).filter(Boolean) as Club[];
    } catch (error) {

      return [];
    }
  }

  /**
   * Get club members with their roles
   */
  async getClubMembers(clubId: string): Promise<ClubMember[]> {
    try {
      const { data, error } = await supabase
        .from('club_members')
        .select(`
          *,
          users (
            id,
            full_name,
            email
          )
        `)
        .eq('club_id', clubId)
        .eq('is_active', true)
        .order('role', { ascending: true });

      if (error) {

        return [];
      }

      return data as ClubMember[];
    } catch (error) {

      return [];
    }
  }

  /**
   * Create a new race event
   */
  async createRaceEvent(
    clubId: string,
    raceData: Omit<RaceEvent, 'id' | 'created_at' | 'updated_at'>
  ): Promise<RaceEvent | null> {
    try {
      const { data, error } = await supabase
        .from('race_events')
        .insert({
          ...raceData,
          club_id: clubId,
        })
        .select()
        .single();

      if (error) {

        return null;
      }

      return data as RaceEvent;
    } catch (error) {

      return null;
    }
  }

  /**
   * Get club race events
   */
  async getClubRaceEvents(
    clubId: string,
    options: {
      status?: RaceEvent['status'];
      startDate?: string;
      endDate?: string;
      limit?: number;
    } = {}
  ): Promise<RaceEvent[]> {
    try {
      let query = supabase
        .from('race_events')
        .select('*')
        .eq('club_id', clubId);

      if (options.status) {
        query = query.eq('status', options.status);
      }

      if (options.startDate) {
        query = query.gte('start_date', options.startDate);
      }

      if (options.endDate) {
        query = query.lte('end_date', options.endDate);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      query = query.order('start_date', { ascending: true });

      const { data, error } = await query;

      if (error) {

        return [];
      }

      return data as RaceEvent[];
    } catch (error) {

      return [];
    }
  }

  /**
   * Update race event
   */
  async updateRaceEvent(
    raceId: string,
    updates: Partial<RaceEvent>
  ): Promise<RaceEvent | null> {
    try {
      const { data, error } = await supabase
        .from('race_events')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', raceId)
        .select()
        .single();

      if (error) {

        return null;
      }

      return data as RaceEvent;
    } catch (error) {

      return null;
    }
  }

  /**
   * Publish race event (makes it visible to sailors)
   */
  async publishRaceEvent(raceId: string): Promise<boolean> {
    try {
      const updated = await this.updateRaceEvent(raceId, {
        status: 'published',
      });

      if (updated) {
        // Trigger race data distribution to registered sailors
        await this.distributeRaceData(raceId);
        return true;
      }

      return false;
    } catch (error) {

      return false;
    }
  }

  /**
   * Distribute race data to sailors
   * Core feature: Automatic race data delivery to sailor apps
   */
  private async distributeRaceData(raceId: string): Promise<boolean> {
    try {

      // Use the dedicated race data distribution service
      const result = await raceDataDistribution.distributeRaceData(raceId);

      if (result.success) {
        return true;
      } else {
        return result.sailors_reached > 0; // Success if at least some sailors received data
      }
    } catch (error) {

      return false;
    }
  }

  /**
   * Get race data distribution status
   */
  async getRaceDistributionStatus(raceId: string): Promise<{
    is_distributed: boolean;
    distribution_time?: string;
    sailors_reached?: number;
    total_registered?: number;
  }> {
    return await raceDataDistribution.getDistributionStatus(raceId);
  }

  /**
   * Retry failed race data distributions
   */
  async retryRaceDataDistribution(raceId: string): Promise<boolean> {
    try {
      const result = await raceDataDistribution.retryFailedDistributions(raceId);
      return result.success;
    } catch (error) {

      return false;
    }
  }

  /**
   * Legacy distribution method - now uses enhanced service
   */
  private async legacyDistributeRaceData(raceId: string): Promise<boolean> {
    try {
      // Get race event details
      const { data: raceEvent, error: raceError } = await supabase
        .from('race_events')
        .select('*')
        .eq('id', raceId)
        .single();

      if (raceError || !raceEvent) {

        return false;
      }

      // Get registered sailors
      const { data: registrations, error: regError } = await supabase
        .from('race_registrations')
        .select(`
          user_id,
          users (
            id,
            full_name,
            email,
            push_token
          )
        `)
        .eq('race_id', raceId)
        .eq('status', 'confirmed');

      if (regError) {

        return false;
      }

      // Create race data packages for each sailor
      const raceDataPackage = {
        race_id: raceId,
        race_name: raceEvent.name,
        race_course: raceEvent.race_course,
        start_date: raceEvent.start_date,
        wind_conditions: raceEvent.wind_conditions,
        instructions: raceEvent.race_course.instructions,
        safety_notes: raceEvent.race_course.safety_notes,
        distributed_at: new Date().toISOString(),
      };

      // Store race data for each sailor
      const dataInserts = registrations.map(reg => ({
        user_id: reg.user_id,
        race_id: raceId,
        race_data: raceDataPackage,
        status: 'delivered',
      }));

      const { error: insertError } = await supabase
        .from('sailor_race_data')
        .insert(dataInserts);

      if (insertError) {

        return false;
      }

      // Send push notifications to sailors
      await this.sendRaceDataNotifications(registrations, raceEvent);

      return true;
    } catch (error) {

      return false;
    }
  }

  /**
   * Send push notifications to sailors about new race data
   */
  private async sendRaceDataNotifications(
    registrations: any[],
    raceEvent: RaceEvent
  ): Promise<void> {
    try {
      // This would integrate with your push notification service
      const notifications = registrations
        .filter(reg => reg.users?.push_token)
        .map(reg => ({
          to: reg.users.push_token,
          title: '🌊 Race Data Ready',
          body: `${raceEvent.name} course and strategy data is now available`,
          data: {
            type: 'race_data',
            race_id: raceEvent.id,
            race_name: raceEvent.name,
          },
        }));

      // Send notifications (implementation depends on your push service)
    } catch (error) {

    }
  }

  /**
   * Get race registrations for an event
   */
  async getRaceRegistrations(raceId: string): Promise<RaceRegistration[]> {
    try {
      const { data, error } = await supabase
        .from('race_registrations')
        .select(`
          *,
          users (
            id,
            full_name,
            email
          )
        `)
        .eq('race_id', raceId)
        .order('registration_date', { ascending: true });

      if (error) {

        return [];
      }

      return data as RaceRegistration[];
    } catch (error) {

      return [];
    }
  }

  /**
   * Check if user has admin permissions for club
   */
  async hasClubAdminAccess(userId: string, clubId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('club_members')
        .select('role')
        .eq('user_id', userId)
        .eq('club_id', clubId)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        return false;
      }

      return hasAdminAccess(data.role);
    } catch (error) {

      return false;
    }
  }

  /**
   * Get club dashboard statistics
   */
  async getClubDashboardStats(clubId: string): Promise<{
    total_members: number;
    active_events: number;
    upcoming_races: number;
    total_registrations: number;
  }> {
    try {
      const [membersResult, eventsResult, racesResult, registrationsResult] = await Promise.all([
        supabase
          .from('club_members')
          .select('id', { count: 'exact' })
          .eq('club_id', clubId)
          .eq('is_active', true),

        supabase
          .from('race_events')
          .select('id', { count: 'exact' })
          .eq('club_id', clubId)
          .in('status', ['published', 'registration_open']),

        supabase
          .from('race_events')
          .select('id', { count: 'exact' })
          .eq('club_id', clubId)
          .gte('start_date', new Date().toISOString()),

        supabase
          .from('race_registrations')
          .select('id', { count: 'exact' })
          .eq('race_events.club_id', clubId)
          .eq('status', 'confirmed')
      ]);

      return {
        total_members: membersResult.count || 0,
        active_events: eventsResult.count || 0,
        upcoming_races: racesResult.count || 0,
        total_registrations: registrationsResult.count || 0,
      };
    } catch (error) {

      return {
        total_members: 0,
        active_events: 0,
        upcoming_races: 0,
        total_registrations: 0,
      };
    }
  }
}

// Export singleton instance
export const clubService = ClubService.getInstance();

export default clubService;
