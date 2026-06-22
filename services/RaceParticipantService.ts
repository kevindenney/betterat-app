/**
 * Race Participant Service
 * Manages race participants and fleet coordination
 * Enables multi-user connectivity for races
 */

import { supabase } from './supabase';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('RaceParticipantService');

export type ParticipantStatus = 'registered' | 'confirmed' | 'tentative' | 'sailed' | 'withdrawn';
export type ParticipantVisibility = 'public' | 'fleet' | 'private';

export interface RaceParticipant {
  id: string;
  regattaId: string;
  userId: string;
  fleetId?: string;
  status: ParticipantStatus;
  boatName?: string;
  sailNumber?: string;
  visibility: ParticipantVisibility;
  registeredAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface ParticipantWithProfile extends RaceParticipant {
  profile?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

class RaceParticipantService {
  /**
   * Register user for a race
   */
  async registerForRace(params: {
    userId: string;
    regattaId: string;
    fleetId?: string;
    boatName?: string;
    sailNumber?: string;
    visibility?: ParticipantVisibility;
  }): Promise<RaceParticipant | null> {
    try {
      const { data, error } = await supabase
        .from('race_participants')
        .insert({
          user_id: params.userId,
          regatta_id: params.regattaId,
          fleet_id: params.fleetId,
          boat_name: params.boatName,
          sail_number: params.sailNumber,
          status: 'registered',
          visibility: params.visibility || 'public',
        })
        .select()
        .single();

      if (error) {
        logger.error('Error registering for race:', error);
        throw error;
      }

      return this.mapParticipant(data);
    } catch (error) {
      logger.error('Exception in registerForRace:', error);
      return null;
    }
  }

  /**
   * Update participant status
   */
  async updateParticipantStatus(
    participantId: string,
    status: ParticipantStatus
  ): Promise<RaceParticipant | null> {
    try {
      const { data, error } = await supabase
        .from('race_participants')
        .update({ status })
        .eq('id', participantId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating participant status:', error);
        throw error;
      }

      return this.mapParticipant(data);
    } catch (error) {
      logger.error('Exception in updateParticipantStatus:', error);
      return null;
    }
  }

  /**
   * Update participant details
   */
  async updateParticipant(
    participantId: string,
    updates: {
      boatName?: string;
      sailNumber?: string;
      visibility?: ParticipantVisibility;
      fleetId?: string;
    }
  ): Promise<RaceParticipant | null> {
    try {
      const dbUpdates: any = {};

      if (updates.boatName !== undefined) dbUpdates.boat_name = updates.boatName;
      if (updates.sailNumber !== undefined) dbUpdates.sail_number = updates.sailNumber;
      if (updates.visibility !== undefined) dbUpdates.visibility = updates.visibility;
      if (updates.fleetId !== undefined) dbUpdates.fleet_id = updates.fleetId;

      const { data, error } = await supabase
        .from('race_participants')
        .update(dbUpdates)
        .eq('id', participantId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating participant:', error);
        throw error;
      }

      return this.mapParticipant(data);
    } catch (error) {
      logger.error('Exception in updateParticipant:', error);
      return null;
    }
  }

  /**
   * Withdraw from race
   */
  async withdrawFromRace(participantId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('race_participants')
        .update({ status: 'withdrawn' })
        .eq('id', participantId)
        .select('id')
        .maybeSingle();

      if (error) {
        logger.error('Error withdrawing from race:', error);
        throw error;
      }
      if (!data) throw new Error('Race participant not found.');

      return true;
    } catch (error) {
      logger.error('Exception in withdrawFromRace:', error);
      return false;
    }
  }

  /**
   * Get all participants for a race
   */
  async getRaceParticipants(
    regattaId: string,
    options?: {
      fleetId?: string;
      includePrivate?: boolean;
      status?: ParticipantStatus[];
    }
  ): Promise<ParticipantWithProfile[]> {
    try {
      let query = supabase
        .from('race_participants')
        .select(
          `
          *,
          user:user_id (*)
        `
        )
        .eq('regatta_id', regattaId);

      // Filter by fleet if specified
      if (options?.fleetId) {
        query = query.eq('fleet_id', options.fleetId);
      }

      // Filter by status if specified
      if (options?.status && options.status.length > 0) {
        query = query.in('status', options.status);
      }

      // Filter by visibility
      if (!options?.includePrivate) {
        query = query.in('visibility', ['public', 'fleet']);
      }

      const { data, error } = await query.order('registered_at', { ascending: true });

      if (error) {
        logger.error('Error fetching race participants:', error);
        throw error;
      }

      return (data || []).map((item) => ({
        ...this.mapParticipant(item),
        profile: item.user
          ? {
              id: item.user.id,
              name: item.user.full_name || item.user.display_name || item.user.id,
              avatar:
                item.user.avatar_url ||
                item.user.profile_image_url ||
                item.user.photo_url ||
                item.user.avatar ||
                undefined,
            }
          : undefined,
      }));
    } catch (error) {
      logger.error('Exception in getRaceParticipants:', error);
      return [];
    }
  }

  /**
   * Get fleet participants for a race
   */
  async getFleetParticipants(regattaId: string, fleetId: string): Promise<ParticipantWithProfile[]> {
    return this.getRaceParticipants(regattaId, {
      fleetId,
      includePrivate: false,
    });
  }

  /**
   * Get race competitors (excluding current user)
   * Used for showing "who else is racing"
   */
  async getRaceCompetitors(
    regattaId: string,
    currentUserId: string,
    isFleetMember: boolean = false
  ): Promise<ParticipantWithProfile[]> {
    try {
      const participants = await this.getRaceParticipants(regattaId, {
        includePrivate: false,
        status: ['registered', 'confirmed', 'tentative'], // Exclude withdrawn
      });

      // Filter out current user and apply visibility rules
      return participants.filter(p => {
        // Don't show current user
        if (p.userId === currentUserId) return false;

        // Apply visibility rules
        if (p.visibility === 'public') return true;
        if (p.visibility === 'fleet' && isFleetMember) return true;

        return false;
      });
    } catch (error) {
      logger.error('Exception in getRaceCompetitors:', error);
      return [];
    }
  }

  /**
   * Get participant count for a race
   */
  async getParticipantCount(
    regattaId: string,
    options?: {
      fleetId?: string;
      status?: ParticipantStatus[];
    }
  ): Promise<number> {
    try {
      let query = supabase
        .from('race_participants')
        .select('*', { count: 'exact', head: true })
        .eq('regatta_id', regattaId);

      if (options?.fleetId) {
        query = query.eq('fleet_id', options.fleetId);
      }

      if (options?.status && options.status.length > 0) {
        query = query.in('status', options.status);
      }

      const { count, error } = await query;

      if (error) {
        logger.error('Error counting participants:', error);
        throw error;
      }

      return count || 0;
    } catch (error) {
      logger.error('Exception in getParticipantCount:', error);
      return 0;
    }
  }

  /**
   * Check if user is registered for a race
   */
  async isUserRegistered(userId: string, regattaId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('race_participants')
        .select('id')
        .eq('user_id', userId)
        .eq('regatta_id', regattaId)
        .neq('status', 'withdrawn')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        logger.error('Error checking registration:', error);
        throw error;
      }

      return !!data;
    } catch (error) {
      logger.error('Exception in isUserRegistered:', error);
      return false;
    }
  }

  /**
   * Get user's participation record for a race
   */
  async getUserParticipation(userId: string, regattaId: string): Promise<RaceParticipant | null> {
    try {
      const { data, error } = await supabase
        .from('race_participants')
        .select('*')
        .eq('user_id', userId)
        .eq('regatta_id', regattaId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        logger.error('Error fetching user participation:', error);
        throw error;
      }

      return data ? this.mapParticipant(data) : null;
    } catch (error) {
      logger.error('Exception in getUserParticipation:', error);
      return null;
    }
  }

  /**
   * Get race statistics
   */
  async getRaceStats(regattaId: string): Promise<{
    totalParticipants: number;
    confirmedParticipants: number;
    fleetParticipants: Record<string, number>;
  }> {
    try {
      const participants = await this.getRaceParticipants(regattaId, { includePrivate: false });

      const stats = {
        totalParticipants: participants.length,
        confirmedParticipants: participants.filter((p) => p.status === 'confirmed').length,
        fleetParticipants: {} as Record<string, number>,
      };

      // Count by fleet
      participants.forEach((p) => {
        if (p.fleetId) {
          stats.fleetParticipants[p.fleetId] = (stats.fleetParticipants[p.fleetId] || 0) + 1;
        }
      });

      return stats;
    } catch (error) {
      logger.error('Exception in getRaceStats:', error);
      return {
        totalParticipants: 0,
        confirmedParticipants: 0,
        fleetParticipants: {},
      };
    }
  }

  /**
   * Helper method to map database row to RaceParticipant
   */
  private mapParticipant(data: any): RaceParticipant {
    return {
      id: data.id,
      regattaId: data.regatta_id,
      userId: data.user_id,
      fleetId: data.fleet_id,
      status: data.status as ParticipantStatus,
      boatName: data.boat_name,
      sailNumber: data.sail_number,
      visibility: data.visibility as ParticipantVisibility,
      registeredAt: data.registered_at || data.created_at,
      updatedAt: data.updated_at,
      metadata: data.metadata,
    };
  }
}

export const raceParticipantService = new RaceParticipantService();
