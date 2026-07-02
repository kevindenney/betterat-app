/**
 * Crew Management Service
 * Manages crew members, invites, and team collaboration
 */

import { supabase } from './supabase';
import MutationQueueService from './MutationQueueService';
import { createLogger } from '@/lib/utils/logger';

export type CrewRole = 'helmsman' | 'tactician' | 'trimmer' | 'bowman' | 'pit' | 'grinder' | 'other';
export type CrewAccessLevel = 'view' | 'edit' | 'full';
export type CrewStatus = 'active' | 'pending' | 'inactive';
export type AvailabilityStatus = 'available' | 'unavailable' | 'tentative';

export interface CrewCertification {
  name: string;
  issuer: string;
  number?: string;
  issuedDate?: string;
  expiryDate?: string;
  verified: boolean;
}

export interface CrewMember {
  id: string;
  sailorId: string;
  classId: string;
  userId?: string;
  email: string;
  name: string;
  role: CrewRole;
  accessLevel: CrewAccessLevel;
  status: CrewStatus;
  isPrimary: boolean;
  certifications: CrewCertification[];
  inviteToken?: string;
  inviteSentAt?: string;
  inviteAcceptedAt?: string;
  notes?: string;
  performanceNotes: { date: string; race: string; note: string }[];
  createdAt: string;
  updatedAt: string;
  queuedForSync?: boolean;
  offlineOperation?: string;
}

export interface CrewAvailability {
  id: string;
  crewMemberId: string;
  startDate: string;
  endDate: string;
  status: AvailabilityStatus;
  reason?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  queuedForSync?: boolean;
  offlineOperation?: string;
}

export interface CrewMemberWithAvailability extends CrewMember {
  currentAvailability?: AvailabilityStatus;
  nextUnavailable?: { startDate: string; endDate: string; reason?: string };
}

export interface CrewInvite {
  email: string;
  name: string;
  role: CrewRole;
  accessLevel?: CrewAccessLevel;
  notes?: string;
}

export interface CrewRaceParticipation {
  id: string;
  crewMemberId: string;
  regattaId: string;
  raceNumber: number;
  position: string;
  performanceRating?: number;
  notes?: string;
  finishPosition?: number;
  pointsScored?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CrewRaceStats {
  totalRaces: number;
  avgFinish?: number;
  avgPerformanceRating?: number;
  positionsSailed: string[];
  bestFinish?: number;
  totalPoints?: number;
}

export interface RaceCrewAssignment {
  id: string;
  raceId: string;
  crewMemberId: string;
  assignedAt: string;
  assignedBy?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrewMemberWithAssignment extends CrewMember {
  isAssigned: boolean;
  assignmentId?: string;
  assignmentNotes?: string;
}

export interface CrewManifestEntry {
  sailNumber: string;
  boatName?: string;
  skipperName?: string;
  skipperUserId?: string;
  assignedCrew: CrewMember[];
  crewCount: number;
  minCrewRequired?: number;
  isCompliant: boolean;
  registrationStatus?: string;
}

const logger = createLogger('crewManagementService');
const CREW_COLLECTION = 'crew_members';
const CREW_AVAILABILITY_COLLECTION = 'crew_availability';

const normalizeDateInput = (value?: string): string | null => {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.includes('T') ? value.split('T')[0] : value;
  }

  return parsed.toISOString().split('T')[0];
};

const isDateWithinRange = (targetDate: Date, start?: string | null, end?: string | null) => {
  if (!start) {
    return true;
  }

  const startDate = new Date(start);
  if (!Number.isNaN(startDate.getTime()) && startDate > targetDate) {
    return false;
  }

  if (end) {
    const endDate = new Date(end);
    if (!Number.isNaN(endDate.getTime()) && endDate < targetDate) {
      return false;
    }
  }

  return true;
};
class CrewManagementService {
  /**
   * Get all crew members for a sailor's class
   */
  async getCrewForClass(sailorId: string, classId: string): Promise<CrewMember[]> {
    const { data, error } = await supabase
      .from('crew_members')
      .select('*')
      .eq('sailor_id', sailorId)
      .eq('class_id', classId)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Error fetching crew members:', error);
      throw error;
    }

    return this.mapCrewMembers(data || []);
  }

  /**
   * Get all crew members across all sailor's classes
   */
  async getAllCrew(sailorId: string): Promise<CrewMember[]> {
    const { data, error } = await supabase
      .from('crew_members')
      .select('*')
      .eq('sailor_id', sailorId)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Error fetching all crew members:', error);
      throw error;
    }

    return this.mapCrewMembers(data || []);
  }

  /**
   * Add a crew member directly without sending an invite (active status, email optional)
   */
  async addCrewMemberDirect(
    sailorId: string,
    classId: string,
    member: {
      name: string;
      email?: string;
      role: CrewRole;
      accessLevel?: CrewAccessLevel;
      notes?: string;
    }
  ): Promise<CrewMember> {
    const { data, error } = await supabase
      .from('crew_members')
      .insert({
        sailor_id: sailorId,
        class_id: classId,
        email: member.email ? member.email.toLowerCase() : `${Date.now()}@noemail.local`,
        name: member.name,
        role: member.role,
        access_level: member.accessLevel || 'view',
        status: 'active',
        notes: member.notes,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return this.mapCrewMember(data);
  }

  /**
   * Add a crew member directly with offline queue support
   */
  async addCrewMember(
    sailorId: string,
    classId: string,
    member: {
      name: string;
      email?: string;
      role: CrewRole;
      accessLevel?: CrewAccessLevel;
      notes?: string;
    }
  ): Promise<CrewMember> {
    try {
      return await this.addCrewMemberDirect(sailorId, classId, member);
    } catch (error: any) {
      logger.warn('Error adding crew member, queueing for offline sync', error);

      const tempId = `local_crew_${Date.now()}`;
      const nowIso = new Date().toISOString();
      const queuedMember: CrewMember = {
        id: tempId,
        sailorId,
        classId,
        email: member.email ? member.email.toLowerCase() : `${Date.now()}@noemail.local`,
        name: member.name,
        role: member.role,
        accessLevel: member.accessLevel || 'view',
        status: 'active',
        isPrimary: false,
        certifications: [],
        inviteToken: undefined,
        inviteSentAt: undefined,
        inviteAcceptedAt: nowIso,
        notes: member.notes,
        performanceNotes: [],
        createdAt: nowIso,
        updatedAt: nowIso,
        queuedForSync: true,
        offlineOperation: 'add',
      };

      await MutationQueueService.enqueueMutation(CREW_COLLECTION, 'upsert', {
        action: 'add',
        sailorId,
        classId,
        member,
      });

      const offlineError: any = new Error('Crew member queued for sync');
      offlineError.queuedForSync = true;
      offlineError.entity = queuedMember;
      offlineError.originalError = error;
      offlineError.operation = 'addCrewMember';
      throw offlineError;
    }
  }

  /**
   * Add a crew member from an existing BetterAt user (with user_id linking)
   */
  async addCrewMemberFromUser(
    sailorId: string,
    classId: string,
    userId: string,
    name: string,
    email: string,
    role: CrewRole
  ): Promise<CrewMember> {
    const { data, error } = await supabase
      .from('crew_members')
      .insert({
        sailor_id: sailorId,
        class_id: classId,
        user_id: userId,
        email: email.toLowerCase(),
        name,
        role,
        access_level: 'view',
        status: 'active',
        invite_accepted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      logger.error('Error adding crew member from user:', error);
      throw error;
    }

    return this.mapCrewMember(data);
  }

  /**
   * Invite a new crew member (direct Supabase call without offline handling)
   */
  async inviteCrewMemberDirect(
    sailorId: string,
    classId: string,
    invite: CrewInvite
  ): Promise<CrewMember> {
    const { data, error } = await supabase
      .from('crew_members')
      .insert({
        sailor_id: sailorId,
        class_id: classId,
        email: invite.email.toLowerCase(),
        name: invite.name,
        role: invite.role,
        access_level: invite.accessLevel || 'view',
        status: 'pending',
        notes: invite.notes,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // TODO: Send email invite with token
    // await this.sendInviteEmail(data);

    return this.mapCrewMember(data);
  }

  /**
   * Invite a new crew member with offline queue support
   */
  async inviteCrewMember(
    sailorId: string,
    classId: string,
    invite: CrewInvite
  ): Promise<CrewMember> {
    try {
      return await this.inviteCrewMemberDirect(sailorId, classId, invite);
    } catch (error: any) {
      logger.warn('Error inviting crew member, queueing for offline sync', error);

      const tempId = `local_crew_${Date.now()}`;
      const nowIso = new Date().toISOString();
      const queuedMember: CrewMember = {
        id: tempId,
        sailorId,
        classId,
        email: invite.email.toLowerCase(),
        name: invite.name,
        role: invite.role,
        accessLevel: invite.accessLevel || 'view',
        status: 'pending',
        isPrimary: false,
        certifications: [],
        inviteToken: undefined,
        inviteSentAt: nowIso,
        inviteAcceptedAt: undefined,
        notes: invite.notes,
        performanceNotes: [],
        createdAt: nowIso,
        updatedAt: nowIso,
        queuedForSync: true,
        offlineOperation: 'invite',
      };

      await MutationQueueService.enqueueMutation(CREW_COLLECTION, 'upsert', {
        action: 'invite',
        sailorId,
        classId,
        invite,
      });

      const offlineError: any = new Error('Crew invite queued for sync');
      offlineError.queuedForSync = true;
      offlineError.entity = queuedMember;
      offlineError.originalError = error;
      offlineError.operation = 'inviteCrewMember';
      throw offlineError;
    }
  }

  /**
   * Update crew member details
   */
  async updateCrewMember(
    crewMemberId: string,
    updates: Partial<{
      name: string;
      role: CrewRole;
      accessLevel: CrewAccessLevel;
      status: CrewStatus;
      notes: string;
    }>
  ): Promise<CrewMember> {
    try {
      return await this.updateCrewMemberDirect(crewMemberId, updates);
    } catch (error: any) {
      logger.warn('Error updating crew member, queueing for offline sync', error);

      await MutationQueueService.enqueueMutation(CREW_COLLECTION, 'upsert', {
        action: 'update',
        crewMemberId,
        updates,
      });

      const offlineError: any = new Error('Crew update queued for sync');
      offlineError.queuedForSync = true;
      offlineError.entity = {
        id: crewMemberId,
        updates,
        queuedForSync: true,
        offlineOperation: 'update',
      };
      offlineError.originalError = error;
      offlineError.operation = 'updateCrewMember';
      throw offlineError;
    }
  }

  async updateCrewMemberDirect(
    crewMemberId: string,
    updates: Partial<{
      name: string;
      role: CrewRole;
      accessLevel: CrewAccessLevel;
      status: CrewStatus;
      notes: string;
    }>
  ): Promise<CrewMember> {
    const dbUpdates: any = {};
    
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.role !== undefined) dbUpdates.role = updates.role;
    if (updates.accessLevel !== undefined) dbUpdates.access_level = updates.accessLevel;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

    const { data, error } = await supabase
      .from('crew_members')
      .update(dbUpdates)
      .eq('id', crewMemberId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating crew member:', error);
      throw error;
    }

    return this.mapCrewMember(data);
  }

  /**
   * Remove crew member
   */
  async removeCrewMember(crewMemberId: string): Promise<void> {
    try {
      await this.removeCrewMemberDirect(crewMemberId);
    } catch (error: any) {
      logger.warn('Error removing crew member, queueing for offline sync', error);

      await MutationQueueService.enqueueMutation(CREW_COLLECTION, 'delete', {
        action: 'remove',
        crewMemberId,
      });

      const offlineError: any = new Error('Crew removal queued for sync');
      offlineError.queuedForSync = true;
      offlineError.entity = { id: crewMemberId };
      offlineError.originalError = error;
      offlineError.operation = 'removeCrewMember';
      throw offlineError;
    }
  }

  async removeCrewMemberDirect(crewMemberId: string): Promise<void> {
    const { error } = await supabase
      .from('crew_members')
      .delete()
      .eq('id', crewMemberId);

    if (error) {
      logger.error('Error removing crew member:', error);
      throw error;
    }
  }

  /**
   * Accept crew invitation (called by invited user)
   */
  async acceptInvite(inviteToken: string, userId: string): Promise<CrewMember> {
    // Find the invite
    const { data: inviteData, error: findError } = await supabase
      .from('crew_members')
      .select('*')
      .eq('invite_token', inviteToken)
      .eq('status', 'pending')
      .single();

    if (findError || !inviteData) {
      throw new Error('Invalid or expired invite');
    }

    // Update with user ID and activate
    const { data, error } = await supabase
      .from('crew_members')
      .update({
        user_id: userId,
        status: 'active',
        invite_accepted_at: new Date().toISOString(),
      })
      .eq('id', inviteData.id)
      .select()
      .single();

    if (error) {
      logger.error('Error accepting invite:', error);
      throw error;
    }

    return this.mapCrewMember(data);
  }

  /**
   * Resend crew invitation
   */
  async resendInvite(crewMemberId: string): Promise<void> {
    const { error } = await supabase
      .from('crew_members')
      .update({
        invite_sent_at: new Date().toISOString(),
      })
      .eq('id', crewMemberId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) {
      logger.error('Error resending invite:', error);
      throw error;
    }

    // TODO: Send email invite
    // await this.sendInviteEmail(data);
  }

  /**
   * Add performance note for crew member
   */
  async addPerformanceNote(
    crewMemberId: string,
    note: { date: string; race: string; note: string }
  ): Promise<void> {
    // Get current notes
    const { data: current, error: fetchError } = await supabase
      .from('crew_members')
      .select('performance_notes')
      .eq('id', crewMemberId)
      .single();

    if (fetchError) {
      logger.error('Error fetching current notes:', fetchError);
      throw fetchError;
    }

    const currentNotes = current?.performance_notes || [];
    const updatedNotes = [...currentNotes, note];

    // Update with new note
    const { error: updateError } = await supabase
      .from('crew_members')
      .update({ performance_notes: updatedNotes })
      .eq('id', crewMemberId);

    if (updateError) {
      logger.error('Error adding performance note:', updateError);
      throw updateError;
    }
  }

  /**
   * Get crew statistics for a sailor
   */
  async getCrewStats(sailorId: string): Promise<{
    totalCrew: number;
    activeCrew: number;
    pendingInvites: number;
    crewByRole: Record<CrewRole, number>;
  }> {
    const crew = await this.getAllCrew(sailorId);

    const stats = {
      totalCrew: crew.length,
      activeCrew: crew.filter(c => c.status === 'active').length,
      pendingInvites: crew.filter(c => c.status === 'pending').length,
      crewByRole: {} as Record<CrewRole, number>,
    };

    // Count by role
    crew.forEach(member => {
      stats.crewByRole[member.role] = (stats.crewByRole[member.role] || 0) + 1;
    });

    return stats;
  }

  /**
   * Check if crew is assigned for a race
   */
  async checkCrewAssignment(sailorId: string, classId: string): Promise<boolean> {
    const crew = await this.getCrewForClass(sailorId, classId);
    const activeCrew = crew.filter(c => c.status === 'active');
    
    // Consider crew assigned if there's at least one active crew member
    return activeCrew.length > 0;
  }

  // Helper methods
  private mapCrewMember(data: any): CrewMember {
    return {
      id: data.id,
      sailorId: data.sailor_id,
      classId: data.class_id,
      userId: data.user_id,
      email: data.email,
      name: data.name,
      role: data.role,
      accessLevel: data.access_level,
      status: data.status,
      isPrimary: data.is_primary || false,
      certifications: data.certifications || [],
      inviteToken: data.invite_token,
      inviteSentAt: data.invite_sent_at,
      inviteAcceptedAt: data.invite_accepted_at,
      notes: data.notes,
      performanceNotes: data.performance_notes || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  private mapCrewMembers(data: any[]): CrewMember[] {
    return data.map(item => this.mapCrewMember(item));
  }

  /**
   * Send invite email (placeholder for future implementation)
   */
  private async sendInviteEmail(crewMember: any): Promise<void> {
    // TODO: Implement email sending via Supabase Edge Function or third-party service
    logger.debug(`Would send invite email to ${crewMember.email} with token ${crewMember.invite_token}`);
  }

  // ==========================================
  // PRIMARY CREW METHODS
  // ==========================================

  /**
   * Set a crew member as primary crew
   */
  async setPrimaryCrew(crewMemberId: string, isPrimary: boolean): Promise<void> {
    const { error } = await supabase.rpc('set_primary_crew', {
      p_crew_member_id: crewMemberId,
      p_is_primary: isPrimary,
    });

    if (error) {
      logger.error('Error setting primary crew:', error);
      throw error;
    }
  }

  /**
   * Get primary crew for a class
   */
  async getPrimaryCrew(sailorId: string, classId: string): Promise<CrewMember[]> {
    const { data, error } = await supabase
      .from('crew_members')
      .select('*')
      .eq('sailor_id', sailorId)
      .eq('class_id', classId)
      .eq('is_primary', true)
      .eq('status', 'active');

    if (error) {
      logger.error('Error fetching primary crew:', error);
      throw error;
    }

    return this.mapCrewMembers(data || []);
  }

  // ==========================================
  // CERTIFICATION METHODS
  // ==========================================

  /**
   * Add certification to crew member
   */
  async addCertification(
    crewMemberId: string,
    certification: CrewCertification
  ): Promise<void> {
    // Get current certifications
    const { data: current, error: fetchError } = await supabase
      .from('crew_members')
      .select('certifications')
      .eq('id', crewMemberId)
      .single();

    if (fetchError) {
      logger.error('Error fetching current certifications:', fetchError);
      throw fetchError;
    }

    const currentCerts = current?.certifications || [];
    const updatedCerts = [...currentCerts, certification];

    // Update with new certification
    const { error: updateError } = await supabase
      .from('crew_members')
      .update({ certifications: updatedCerts })
      .eq('id', crewMemberId);

    if (updateError) {
      logger.error('Error adding certification:', updateError);
      throw updateError;
    }
  }

  /**
   * Update certification for crew member
   */
  async updateCertification(
    crewMemberId: string,
    certificationIndex: number,
    certification: CrewCertification
  ): Promise<void> {
    // Get current certifications
    const { data: current, error: fetchError } = await supabase
      .from('crew_members')
      .select('certifications')
      .eq('id', crewMemberId)
      .single();

    if (fetchError) {
      logger.error('Error fetching current certifications:', fetchError);
      throw fetchError;
    }

    const currentCerts = current?.certifications || [];
    currentCerts[certificationIndex] = certification;

    // Update with modified certification
    const { error: updateError } = await supabase
      .from('crew_members')
      .update({ certifications: currentCerts })
      .eq('id', crewMemberId);

    if (updateError) {
      logger.error('Error updating certification:', updateError);
      throw updateError;
    }
  }

  /**
   * Remove certification from crew member
   */
  async removeCertification(
    crewMemberId: string,
    certificationIndex: number
  ): Promise<void> {
    // Get current certifications
    const { data: current, error: fetchError } = await supabase
      .from('crew_members')
      .select('certifications')
      .eq('id', crewMemberId)
      .single();

    if (fetchError) {
      logger.error('Error fetching current certifications:', fetchError);
      throw fetchError;
    }

    const currentCerts = current?.certifications || [];
    currentCerts.splice(certificationIndex, 1);

    // Update with certification removed
    const { error: updateError } = await supabase
      .from('crew_members')
      .update({ certifications: currentCerts })
      .eq('id', crewMemberId);

    if (updateError) {
      logger.error('Error removing certification:', updateError);
      throw updateError;
    }
  }

  // ==========================================
  // RACE PARTICIPATION METHODS
  // ==========================================

  /**
   * Add race participation record
   */
  async addRaceParticipation(
    crewMemberId: string,
    participation: {
      regattaId: string;
      raceNumber: number;
      position: string;
      performanceRating?: number;
      notes?: string;
      finishPosition?: number;
      pointsScored?: number;
    }
  ): Promise<CrewRaceParticipation> {
    const { data, error } = await supabase
      .from('crew_race_participation')
      .insert({
        crew_member_id: crewMemberId,
        regatta_id: participation.regattaId,
        race_number: participation.raceNumber,
        position: participation.position,
        performance_rating: participation.performanceRating,
        notes: participation.notes,
        finish_position: participation.finishPosition,
        points_scored: participation.pointsScored,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error adding race participation:', error);
      throw error;
    }

    return this.mapRaceParticipation(data);
  }

  /**
   * Get race participation history for crew member
   */
  async getCrewRaceHistory(crewMemberId: string): Promise<CrewRaceParticipation[]> {
    const { data, error } = await supabase
      .from('crew_race_participation')
      .select('*')
      .eq('crew_member_id', crewMemberId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching race history:', error);
      throw error;
    }

    return (data || []).map(this.mapRaceParticipation);
  }

  /**
   * Get race statistics for crew member
   */
  async getCrewRaceStats(crewMemberId: string): Promise<CrewRaceStats> {
    const { data, error } = await supabase.rpc('get_crew_race_stats', {
      p_crew_member_id: crewMemberId,
    });

    if (error) {
      logger.error('Error fetching crew race stats:', error);
      throw error;
    }

    const stats = data?.[0] || {};

    return {
      totalRaces: stats.total_races || 0,
      avgFinish: stats.avg_finish || undefined,
      avgPerformanceRating: stats.avg_performance_rating || undefined,
      positionsSailed: stats.positions_sailed || [],
      bestFinish: stats.best_finish || undefined,
      totalPoints: stats.total_points || undefined,
    };
  }

  /**
   * Update race participation
   */
  async updateRaceParticipation(
    participationId: string,
    updates: Partial<{
      position: string;
      performanceRating: number;
      notes: string;
      finishPosition: number;
      pointsScored: number;
    }>
  ): Promise<CrewRaceParticipation> {
    const dbUpdates: any = {};

    if (updates.position !== undefined) dbUpdates.position = updates.position;
    if (updates.performanceRating !== undefined) dbUpdates.performance_rating = updates.performanceRating;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.finishPosition !== undefined) dbUpdates.finish_position = updates.finishPosition;
    if (updates.pointsScored !== undefined) dbUpdates.points_scored = updates.pointsScored;

    const { data, error } = await supabase
      .from('crew_race_participation')
      .update(dbUpdates)
      .eq('id', participationId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating race participation:', error);
      throw error;
    }

    return this.mapRaceParticipation(data);
  }

  // ==========================================
  // AVAILABILITY METHODS
  // ==========================================

  /**
   * Get crew availability for a specific date range
   */
  async getCrewAvailability(
    crewMemberId: string,
    startDate?: string,
    endDate?: string
  ): Promise<CrewAvailability[]> {
    let query = supabase
      .from('crew_availability')
      .select('*')
      .eq('crew_member_id', crewMemberId);

    if (startDate) {
      query = query.gte('end_date', startDate);
    }
    if (endDate) {
      query = query.lte('start_date', endDate);
    }

    const { data, error } = await query.order('start_date', { ascending: true });

    if (error) {
      logger.error('Error fetching crew availability:', error);
      throw error;
    }

    return (data || []).map(this.mapAvailability);
  }

  /**
   * Set crew availability for a date range
   */
  async setCrewAvailability(
    crewMemberId: string,
    availability: {
      startDate: string;
      endDate: string;
      status: AvailabilityStatus;
      reason?: string;
      notes?: string;
    }
  ): Promise<CrewAvailability> {
    try {
      return await this.setCrewAvailabilityDirect(crewMemberId, availability);
    } catch (error: any) {
      logger.warn('Error setting crew availability, queueing for offline sync', error);

      await MutationQueueService.enqueueMutation(CREW_AVAILABILITY_COLLECTION, 'upsert', {
        action: 'create',
        crewMemberId,
        availability,
      });

      const nowIso = new Date().toISOString();
      const fallback: CrewAvailability = {
        id: `local_availability_${Date.now()}`,
        crewMemberId,
        startDate: availability.startDate,
        endDate: availability.endDate,
        status: availability.status,
        reason: availability.reason,
        notes: availability.notes,
        createdAt: nowIso,
        updatedAt: nowIso,
        queuedForSync: true,
        offlineOperation: 'create',
      };

      const offlineError: any = new Error('Crew availability queued for sync');
      offlineError.queuedForSync = true;
      offlineError.entity = fallback;
      offlineError.originalError = error;
      offlineError.operation = 'setCrewAvailability';
      throw offlineError;
    }
  }

  async setCrewAvailabilityDirect(
    crewMemberId: string,
    availability: {
      startDate: string;
      endDate: string;
      status: AvailabilityStatus;
      reason?: string;
      notes?: string;
    }
  ): Promise<CrewAvailability> {
    const { data, error } = await supabase
      .from('crew_availability')
      .insert({
        crew_member_id: crewMemberId,
        start_date: availability.startDate,
        end_date: availability.endDate,
        status: availability.status,
        reason: availability.reason,
        notes: availability.notes,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error setting crew availability:', error);
      throw error;
    }

    return this.mapAvailability(data);
  }

  /**
   * Update crew availability
   */
  async updateCrewAvailability(
    availabilityId: string,
    updates: Partial<{
      startDate: string;
      endDate: string;
      status: AvailabilityStatus;
      reason: string;
      notes: string;
    }>
  ): Promise<CrewAvailability> {
    try {
      return await this.updateCrewAvailabilityDirect(availabilityId, updates);
    } catch (error: any) {
      logger.warn('Error updating crew availability, queueing for offline sync', error);

      await MutationQueueService.enqueueMutation(CREW_AVAILABILITY_COLLECTION, 'upsert', {
        action: 'update',
        availabilityId,
        updates,
      });

      const offlineError: any = new Error('Crew availability update queued for sync');
      offlineError.queuedForSync = true;
      offlineError.entity = {
        id: availabilityId,
        updates,
        queuedForSync: true,
        offlineOperation: 'update',
      };
      offlineError.originalError = error;
      offlineError.operation = 'updateCrewAvailability';
      throw offlineError;
    }
  }

  async updateCrewAvailabilityDirect(
    availabilityId: string,
    updates: Partial<{
      startDate: string;
      endDate: string;
      status: AvailabilityStatus;
      reason: string;
      notes: string;
    }>
  ): Promise<CrewAvailability> {
    const dbUpdates: any = {};

    if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
    if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.reason !== undefined) dbUpdates.reason = updates.reason;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

    const { data, error } = await supabase
      .from('crew_availability')
      .update(dbUpdates)
      .eq('id', availabilityId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating crew availability:', error);
      throw error;
    }

    return this.mapAvailability(data);
  }

  /**
   * Delete crew availability
   */
  async deleteCrewAvailability(availabilityId: string): Promise<void> {
    try {
      await this.deleteCrewAvailabilityDirect(availabilityId);
    } catch (error: any) {
      logger.warn('Error deleting crew availability, queueing for offline sync', error);

      await MutationQueueService.enqueueMutation(CREW_AVAILABILITY_COLLECTION, 'delete', {
        action: 'delete',
        availabilityId,
      });

      const offlineError: any = new Error('Crew availability deletion queued for sync');
      offlineError.queuedForSync = true;
      offlineError.entity = { id: availabilityId };
      offlineError.originalError = error;
      offlineError.operation = 'deleteCrewAvailability';
      throw offlineError;
    }
  }

  async deleteCrewAvailabilityDirect(availabilityId: string): Promise<void> {
    const { error } = await supabase
      .from('crew_availability')
      .delete()
      .eq('id', availabilityId);

    if (error) {
      logger.error('Error deleting crew availability:', error);
      throw error;
    }
  }

  /**
   * Check crew availability for a specific date
   */
  async checkCrewAvailabilityForDate(
    crewMemberId: string,
    date: string
  ): Promise<AvailabilityStatus> {
    const normalizedDate = normalizeDateInput(date);

    if (!normalizedDate) {
      logger.warn('Invalid date provided to checkCrewAvailabilityForDate, defaulting to available', {
        date,
      });
      return 'available';
    }

    try {
      const { data, error } = await supabase
        .from('crew_availability')
        .select('status, start_date, end_date')
        .eq('crew_member_id', crewMemberId)
        .lte('start_date', normalizedDate)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        // If table doesn't exist (PGRST205), silently default to available
        if (error.code === 'PGRST205' || error.code === '42P01') {
          logger.debug('crew_availability table not found, defaulting to available');
          return 'available';
        }
        throw error;
      }

      if (!data) {
        return 'available';
      }

      const targetDate = new Date(normalizedDate);
      if (Number.isNaN(targetDate.getTime())) {
        return (data.status as AvailabilityStatus) || 'available';
      }

      if (!isDateWithinRange(targetDate, data.start_date, data.end_date)) {
        return 'available';
      }

      return (data.status as AvailabilityStatus) || 'available';
    } catch (error: any) {
      // If table doesn't exist, silently default to available
      if (error?.code === 'PGRST205' || error?.code === '42P01') {
        logger.debug('crew_availability table not found, defaulting to available');
        return 'available';
      }
      logger.error('Error checking crew availability:', error);
      return 'available'; // Default to available on error
    }
  }

  /**
   * Get crew members with availability for a date
   */
  async getCrewWithAvailability(
    sailorId: string,
    classId: string,
    date: string
  ): Promise<CrewMemberWithAvailability[]> {
    const crew = await this.getCrewForClass(sailorId, classId);

    const crewWithAvailability = await Promise.all(
      crew.map(async (member) => {
        const currentAvailability = await this.checkCrewAvailabilityForDate(member.id, date);

        // Get next unavailable period
        const { data: nextUnavailable, error: nextUnavailableError } = await supabase
          .from('crew_availability')
          .select('start_date, end_date, reason')
          .eq('crew_member_id', member.id)
          .eq('status', 'unavailable')
          .gte('start_date', date)
          .order('start_date', { ascending: true })
          .limit(1)
          .maybeSingle();

        // Ignore table not found errors
        if (nextUnavailableError &&
            nextUnavailableError.code !== 'PGRST116' &&
            nextUnavailableError.code !== 'PGRST205' &&
            nextUnavailableError.code !== '42P01') {
          logger.error('Error loading next unavailable period:', nextUnavailableError);
        }

        return {
          ...member,
          currentAvailability,
          nextUnavailable: nextUnavailable
            ? {
                startDate: nextUnavailable.start_date,
                endDate: nextUnavailable.end_date,
                reason: nextUnavailable.reason,
              }
            : undefined,
        } as CrewMemberWithAvailability;
      })
    );

    return crewWithAvailability;
  }

  /**
   * Get availability summary for all crew
   */
  async getCrewAvailabilitySummary(
    sailorId: string,
    startDate: string,
    endDate: string
  ): Promise<
    {
      crewMemberId: string;
      crewName: string;
      crewRole: string;
      availableDays: number;
      unavailableDays: number;
      tentativeDays: number;
    }[]
  > {
    const { data, error } = await supabase.rpc('get_crew_availability_summary', {
      p_sailor_id: sailorId,
      p_start_date: startDate,
      p_end_date: endDate,
    });

    if (error) {
      logger.error('Error fetching crew availability summary:', error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      crewMemberId: row.crew_member_id,
      crewName: row.crew_name,
      crewRole: row.crew_role,
      availableDays: row.available_days,
      unavailableDays: row.unavailable_days,
      tentativeDays: row.tentative_days,
    }));
  }

  // Helper methods for availability
  private mapAvailability(data: any): CrewAvailability {
    return {
      id: data.id,
      crewMemberId: data.crew_member_id,
      startDate: data.start_date,
      endDate: data.end_date,
      status: data.status,
      reason: data.reason,
      notes: data.notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  // Helper methods for race participation
  private mapRaceParticipation(data: any): CrewRaceParticipation {
    return {
      id: data.id,
      crewMemberId: data.crew_member_id,
      regattaId: data.regatta_id,
      raceNumber: data.race_number,
      position: data.position,
      performanceRating: data.performance_rating,
      notes: data.notes,
      finishPosition: data.finish_position,
      pointsScored: data.points_scored,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  // ==========================================
  // RACE CREW ASSIGNMENT METHODS
  // ==========================================

  /**
   * Get crew members assigned to a specific race
   */
  async getAssignedCrewForRace(raceId: string): Promise<CrewMember[]> {
    const { data, error } = await supabase
      .from('race_crew_assignments')
      .select(`
        crew_member_id,
        crew_members (*)
      `)
      .eq('race_id', raceId);

    if (error) {
      logger.error('Error fetching assigned crew for race:', error);
      throw error;
    }

    return (data || []).map((assignment: any) => this.mapCrewMember(assignment.crew_members));
  }

  /**
   * Get crew for a class with assignment status for a specific race
   */
  async getCrewWithAssignmentStatus(
    sailorId: string,
    classId: string | null,
    raceId: string
  ): Promise<CrewMemberWithAssignment[]> {
    // If we don't have a class ID (some regattas don't set it), fall back to all crew
    const crew = classId
      ? await this.getCrewForClass(sailorId, classId)
      : await this.getAllCrew(sailorId);

    // Get assignments for this race
    const { data: assignments, error } = await supabase
      .from('race_crew_assignments')
      .select('*')
      .eq('race_id', raceId);

    if (error) {
      logger.error('Error fetching race crew assignments:', error);
      throw error;
    }

    const assignmentMap = new Map(
      (assignments || []).map((a: any) => [
        a.crew_member_id,
        { id: a.id, notes: a.notes }
      ])
    );

    return crew.map((member) => {
      const assignment = assignmentMap.get(member.id);
      return {
        ...member,
        isAssigned: !!assignment,
        assignmentId: assignment?.id,
        assignmentNotes: assignment?.notes,
      };
    });
  }

  /**
   * Assign a crew member to a race
   */
  async assignCrewToRace(
    raceId: string,
    crewMemberId: string,
    notes?: string
  ): Promise<RaceCrewAssignment> {
    const { data, error } = await supabase
      .from('race_crew_assignments')
      .insert({
        race_id: raceId,
        crew_member_id: crewMemberId,
        assigned_by: (await supabase.auth.getUser()).data.user?.id,
        notes,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error assigning crew to race:', error);
      throw error;
    }

    return this.mapRaceCrewAssignment(data);
  }

  /**
   * Unassign a crew member from a race
   */
  async unassignCrewFromRace(assignmentId: string): Promise<void> {
    const { error } = await supabase
      .from('race_crew_assignments')
      .delete()
      .eq('id', assignmentId);

    if (error) {
      logger.error('Error unassigning crew from race:', error);
      throw error;
    }
  }

  /**
   * Assign multiple crew members to a race at once
   */
  async assignMultipleCrewToRace(
    raceId: string,
    crewMemberIds: string[],
    notes?: string
  ): Promise<RaceCrewAssignment[]> {
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const { data, error } = await supabase
      .from('race_crew_assignments')
      .insert(
        crewMemberIds.map((crewMemberId) => ({
          race_id: raceId,
          crew_member_id: crewMemberId,
          assigned_by: userId,
          notes,
        }))
      )
      .select();

    if (error) {
      logger.error('Error assigning multiple crew to race:', error);
      throw error;
    }

    return (data || []).map(this.mapRaceCrewAssignment);
  }

  /**
   * Clear all crew assignments for a race
   */
  async clearRaceCrewAssignments(raceId: string): Promise<void> {
    const { error } = await supabase
      .from('race_crew_assignments')
      .delete()
      .eq('race_id', raceId);

    if (error) {
      logger.error('Error clearing race crew assignments:', error);
      throw error;
    }
  }

  /**
   * Update crew assignment notes
   */
  async updateRaceCrewAssignment(
    assignmentId: string,
    updates: { notes?: string }
  ): Promise<RaceCrewAssignment> {
    const { data, error } = await supabase
      .from('race_crew_assignments')
      .update({
        notes: updates.notes,
      })
      .eq('id', assignmentId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating race crew assignment:', error);
      throw error;
    }

    return this.mapRaceCrewAssignment(data);
  }

  // Helper method for race crew assignments
  private mapRaceCrewAssignment(data: any): RaceCrewAssignment {
    return {
      id: data.id,
      raceId: data.race_id,
      crewMemberId: data.crew_member_id,
      assignedAt: data.assigned_at,
      assignedBy: data.assigned_by,
      notes: data.notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  // ==========================================
  // RACE OFFICER CREW MANIFEST METHODS
  // ==========================================

  /**
   * Get crew manifest for a race (race officer view)
   * Shows all boats registered for the race with their assigned crew
   */
  async getRaceCrewManifest(raceId: string): Promise<CrewManifestEntry[]> {
    try {
      // Get all participants for this race with their crew assignments
      const { data: participants, error: participantsError } = await supabase
        .from('race_participants')
        .select(`
          id,
          sail_number,
          boat_name,
          user_id,
          status,
          sailor_profiles!inner(
            id,
            name,
            user_id
          )
        `)
        .eq('regatta_id', raceId);

      if (participantsError) {
        logger.error('Error fetching race participants:', participantsError);
        throw participantsError;
      }

      if (!participants || participants.length === 0) {
        return [];
      }

      // Get all crew assignments for this race
      const { data: assignments, error: assignmentsError } = await supabase
        .from('race_crew_assignments')
        .select(`
          id,
          crew_member_id,
          notes,
          crew_members(
            id,
            name,
            role,
            certifications,
            status
          )
        `)
        .eq('race_id', raceId);

      if (assignmentsError) {
        logger.error('Error fetching crew assignments:', assignmentsError);
        // Don't throw - just return participants without crew data
      }

      // Build manifest entries
      const manifest: CrewManifestEntry[] = participants.map((participant: any) => {
        const sailorProfile = participant.sailor_profiles;
        const skipperUserId = participant.user_id;

        // Find crew assignments for this participant's user
        const participantCrew = (assignments || [])
          .filter((assignment: any) => {
            // Match crew assignments by checking if crew member's sailor_id matches participant's user_id
            const crewMember = assignment.crew_members;
            return crewMember && crewMember.sailor_id === skipperUserId;
          })
          .map((assignment: any) => this.mapCrewMember(assignment.crew_members))
          .filter((crew: CrewMember) => crew.status === 'active');

        const crewCount = participantCrew.length;
        const minCrewRequired = 3; // Default, could be class-specific
        const isCompliant = crewCount >= minCrewRequired;

        return {
          sailNumber: participant.sail_number || 'N/A',
          boatName: participant.boat_name,
          skipperName: sailorProfile?.name || 'Unknown',
          skipperUserId,
          assignedCrew: participantCrew,
          crewCount,
          minCrewRequired,
          isCompliant,
          registrationStatus: participant.status,
        };
      });

      // Sort by compliance status (non-compliant first) then by sail number
      return manifest.sort((a, b) => {
        if (a.isCompliant !== b.isCompliant) {
          return a.isCompliant ? 1 : -1; // Non-compliant first
        }
        return a.sailNumber.localeCompare(b.sailNumber);
      });
    } catch (error) {
      logger.error('Error getting race crew manifest:', error);
      throw error;
    }
  }

  /**
   * Get crew manifest summary stats for race officer dashboard
   */
  async getRaceCrewManifestSummary(raceId: string): Promise<{
    totalBoats: number;
    boatsWithFullCrew: number;
    boatsWithNoCrew: number;
    totalCrewAssigned: number;
    complianceRate: number;
  }> {
    const manifest = await this.getRaceCrewManifest(raceId);

    const totalBoats = manifest.length;
    const boatsWithFullCrew = manifest.filter((entry) => entry.isCompliant).length;
    const boatsWithNoCrew = manifest.filter((entry) => entry.crewCount === 0).length;
    const totalCrewAssigned = manifest.reduce((sum, entry) => sum + entry.crewCount, 0);
    const complianceRate = totalBoats > 0 ? (boatsWithFullCrew / totalBoats) * 100 : 0;

    return {
      totalBoats,
      boatsWithFullCrew,
      boatsWithNoCrew,
      totalCrewAssigned,
      complianceRate,
    };
  }
}

export const crewManagementService = new CrewManagementService();

export function initializeCrewMutationHandlers() {
  MutationQueueService.registerHandler(CREW_COLLECTION, {
    upsert: async (payload: any) => {
      switch (payload?.action) {
        case 'invite':
          await crewManagementService.inviteCrewMemberDirect(
            payload.sailorId,
            payload.classId,
            payload.invite
          );
          break;
        case 'add':
          await crewManagementService.addCrewMemberDirect(
            payload.sailorId,
            payload.classId,
            payload.member
          );
          break;
        case 'update':
          await crewManagementService.updateCrewMemberDirect(
            payload.crewMemberId,
            payload.updates || {}
          );
          break;
        default:
          logger.warn('Unhandled crew upsert action', payload?.action);
      }
    },
    delete: async (payload: any) => {
      if (payload?.action === 'remove' && payload.crewMemberId) {
        await crewManagementService.removeCrewMemberDirect(payload.crewMemberId);
      } else {
        logger.warn('Unhandled crew delete action', payload?.action);
      }
    },
  });

  MutationQueueService.registerHandler(CREW_AVAILABILITY_COLLECTION, {
    upsert: async (payload: any) => {
      switch (payload?.action) {
        case 'create':
          await crewManagementService.setCrewAvailabilityDirect(
            payload.crewMemberId,
            payload.availability
          );
          break;
        case 'update':
          await crewManagementService.updateCrewAvailabilityDirect(
            payload.availabilityId,
            payload.updates || {}
          );
          break;
        default:
          logger.warn('Unhandled crew availability upsert action', payload?.action);
      }
    },
    delete: async (payload: any) => {
      if (payload?.action === 'delete' && payload.availabilityId) {
        await crewManagementService.deleteCrewAvailabilityDirect(payload.availabilityId);
      } else {
        logger.warn('Unhandled crew availability delete action', payload?.action);
      }
    },
  });
}
