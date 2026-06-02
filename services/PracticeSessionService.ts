/**
 * PracticeSessionService
 *
 * Service for managing practice sessions.
 * Enables:
 * - Creating scheduled and logged practice sessions
 * - Generating invite codes for crew
 * - Joining sessions via invite code
 * - Managing focus areas and drills
 * - Completing sessions with reflection
 */

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import {
  PracticeSession,
  PracticeSessionRow,
  PracticeSessionMember,
  PracticeSessionMemberRow,
  PracticeFocusArea,
  PracticeFocusAreaRow,
  PracticeSessionDrill,
  PracticeSessionDrillRow,
  SkillArea,
  PracticeMemberRole,
  RSVPStatus,
  CreatePracticeSessionInput,
  UpdatePracticeSessionInput,
  JoinPracticeInput,
  SessionReflectionInput,
  LogPracticeInput,
  rowToPracticeSession,
  rowToPracticeSessionMember,
  rowToPracticeFocusArea,
  rowToPracticeSessionDrill,
} from '@/types/practice';

const logger = createLogger('PracticeSessionService');

/**
 * Service for managing practice sessions
 */
class PracticeSessionServiceClass {
  // =========================================================================
  // SESSION CRUD
  // =========================================================================

  /**
   * Create a new practice session
   * Automatically adds creator as first member (organizer)
   */
  async createSession(input: CreatePracticeSessionInput): Promise<PracticeSession> {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) {
      throw new Error('Not authenticated');
    }

    // Get sailor_id from sailor_profiles if exists
    const { data: sailorProfile } = await supabase
      .from('sailor_profiles')
      .select('id')
      .eq('user_id', user.user.id)
      .maybeSingle();

    const { data, error } = await supabase
      .from('practice_sessions')
      .insert({
        created_by: user.user.id,
        sailor_id: sailorProfile?.id || null,
        session_type: input.sessionType,
        status: input.sessionType === 'logged' ? 'completed' : 'planned',
        scheduled_date: input.scheduledDate || null,
        scheduled_start_time: input.scheduledStartTime || null,
        duration_minutes: input.durationMinutes || null,
        venue_id: input.venueId || null,
        venue_name: input.venueName || null,
        title: input.title || null,
        notes: input.notes || null,
        ai_suggested: input.aiSuggested || false,
        ai_suggestion_context: input.aiSuggestionContext || null,
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create practice session:', error);
      throw error;
    }

    const session = rowToPracticeSession(data as PracticeSessionRow);
    logger.info('Created practice session', { sessionId: session.id });

    // Add focus areas if provided
    if (input.focusAreaIds && input.focusAreaIds.length > 0) {
      await this.addFocusAreas(
        session.id,
        input.focusAreaIds.map((skillArea, index) => ({
          skillArea,
          priority: index + 1,
          aiSuggested: input.aiSuggested || false,
        }))
      );
    }

    // Add drills if provided
    if (input.drillIds && input.drillIds.length > 0) {
      await this.addDrills(session.id, input.drillIds);
    }

    return session;
  }

  /**
   * Log an ad-hoc practice session (already completed)
   */
  async logPractice(input: LogPracticeInput): Promise<PracticeSession> {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) {
      throw new Error('Not authenticated');
    }

    // Get sailor_id
    const { data: sailorProfile } = await supabase
      .from('sailor_profiles')
      .select('id')
      .eq('user_id', user.user.id)
      .maybeSingle();

    const { data, error } = await supabase
      .from('practice_sessions')
      .insert({
        created_by: user.user.id,
        sailor_id: sailorProfile?.id || null,
        session_type: 'logged',
        status: 'completed',
        scheduled_date: input.date,
        scheduled_start_time: input.time || null,
        duration_minutes: input.durationMinutes,
        actual_duration_minutes: input.durationMinutes,
        venue_name: input.venueName || null,
        notes: input.description || null,
        reflection_notes: input.notes || null,
        overall_rating: input.overallRating,
        wind_speed_min: input.windSpeedMin || null,
        wind_speed_max: input.windSpeedMax || null,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to log practice:', error);
      throw error;
    }

    const session = rowToPracticeSession(data as PracticeSessionRow);
    logger.info('Logged practice session', { sessionId: session.id });

    // Add focus areas
    if (input.focusAreas && input.focusAreas.length > 0) {
      await this.addFocusAreas(
        session.id,
        input.focusAreas.map((skillArea, index) => ({
          skillArea,
          priority: index + 1,
          aiSuggested: false,
          postSessionRating: input.overallRating, // Use overall rating
        }))
      );
    }

    return session;
  }

  /**
   * Get a session by ID with all related data
   */
  async getSession(sessionId: string): Promise<PracticeSession | null> {
    logger.info('[PracticeSessionService] getSession called with sessionId:', sessionId);

    const { data, error } = await supabase
      .from('practice_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    logger.info('[PracticeSessionService] getSession result:', { hasData: !!data, errorCode: error?.code, errorMsg: error?.message });

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      logger.error('Failed to get practice session:', error);
      throw error;
    }

    const session = rowToPracticeSession(data as PracticeSessionRow);

    // Load related data
    const [members, focusAreas, drills] = await Promise.all([
      this.getSessionMembers(sessionId),
      this.getSessionFocusAreas(sessionId),
      this.getSessionDrills(sessionId),
    ]);

    return {
      ...session,
      members,
      focusAreas,
      drills,
    };
  }

  /**
   * Get upcoming sessions for current user
   */
  async getUpcomingSessions(limit: number = 10): Promise<PracticeSession[]> {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return [];

    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('practice_sessions')
      .select('*')
      .eq('created_by', user.user.id)
      .in('status', ['planned', 'in_progress'])
      .gte('scheduled_date', today)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_start_time', { ascending: true })
      .limit(limit);

    if (error) {
      logger.error('Failed to get upcoming sessions:', error);
      throw error;
    }

    return (data || []).map((row) => rowToPracticeSession(row as PracticeSessionRow));
  }

  /**
   * Get past sessions for current user (practice log)
   */
  async getPastSessions(limit: number = 20): Promise<PracticeSession[]> {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return [];

    const { data, error } = await supabase
      .from('practice_sessions')
      .select('*')
      .eq('created_by', user.user.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false, nullsFirst: false })
      .order('scheduled_date', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to get past sessions:', error);
      throw error;
    }

    return (data || []).map((row) => rowToPracticeSession(row as PracticeSessionRow));
  }

  /**
   * Update session details
   */
  async updateSession(sessionId: string, updates: UpdatePracticeSessionInput): Promise<void> {
    const dbUpdates: Record<string, unknown> = {};

    if (updates.scheduledDate !== undefined) dbUpdates.scheduled_date = updates.scheduledDate;
    if (updates.scheduledStartTime !== undefined)
      dbUpdates.scheduled_start_time = updates.scheduledStartTime;
    if (updates.durationMinutes !== undefined) dbUpdates.duration_minutes = updates.durationMinutes;
    if (updates.actualDurationMinutes !== undefined)
      dbUpdates.actual_duration_minutes = updates.actualDurationMinutes;
    if (updates.venueId !== undefined) dbUpdates.venue_id = updates.venueId;
    if (updates.venueName !== undefined) dbUpdates.venue_name = updates.venueName;
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.reflectionNotes !== undefined) dbUpdates.reflection_notes = updates.reflectionNotes;
    if (updates.overallRating !== undefined) dbUpdates.overall_rating = updates.overallRating;
    if (updates.windSpeedMin !== undefined) dbUpdates.wind_speed_min = updates.windSpeedMin;
    if (updates.windSpeedMax !== undefined) dbUpdates.wind_speed_max = updates.windSpeedMax;
    if (updates.windDirection !== undefined) dbUpdates.wind_direction = updates.windDirection;

    const { error } = await supabase
      .from('practice_sessions')
      .update(dbUpdates)
      .eq('id', sessionId);

    if (error) {
      logger.error('Failed to update practice session:', error);
      throw error;
    }

    logger.info('Updated practice session', { sessionId });
  }

  /**
   * Complete a session with reflection
   */
  async completeSession(sessionId: string, reflection: SessionReflectionInput): Promise<void> {
    // Update main session
    const { error: sessionError } = await supabase
      .from('practice_sessions')
      .update({
        status: 'completed',
        actual_duration_minutes: reflection.actualDurationMinutes,
        overall_rating: reflection.overallRating,
        reflection_notes: reflection.reflectionNotes || null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (sessionError) {
      logger.error('Failed to complete session:', sessionError);
      throw sessionError;
    }

    // Update focus area + drill ratings concurrently (independent rows)
    await Promise.all([
      ...Object.entries(reflection.focusAreaRatings ?? {}).map(([focusAreaId, rating]) =>
        supabase
          .from('practice_session_focus_areas')
          .update({ post_session_rating: rating })
          .eq('id', focusAreaId)
      ),
      ...Object.entries(reflection.drillRatings ?? {}).map(([drillId, data]) =>
        supabase
          .from('practice_session_drills')
          .update({
            rating: data.rating,
            notes: data.notes || null,
            completed: data.completed ?? true,
          })
          .eq('id', drillId)
      ),
    ]);

    logger.info('Completed practice session', { sessionId });
  }

  /**
   * Start a session (change status to in_progress)
   */
  async startSession(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('practice_sessions')
      .update({ status: 'in_progress' })
      .eq('id', sessionId);

    if (error) {
      logger.error('Failed to start session:', error);
      throw error;
    }

    logger.info('Started practice session', { sessionId });
  }

  /**
   * Cancel a session
   */
  async cancelSession(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('practice_sessions')
      .update({ status: 'cancelled' })
      .eq('id', sessionId);

    if (error) {
      logger.error('Failed to cancel session:', error);
      throw error;
    }

    logger.info('Cancelled practice session', { sessionId });
  }

  /**
   * Delete a session (creator only)
   */
  async deleteSession(sessionId: string): Promise<void> {
    const { error } = await supabase.from('practice_sessions').delete().eq('id', sessionId);

    if (error) {
      logger.error('Failed to delete practice session:', error);
      throw error;
    }

    logger.info('Deleted practice session', { sessionId });
  }

  // =========================================================================
  // INVITE CODE
  // =========================================================================

  /**
   * Generate an invite code for a session
   */
  async generateInviteCode(sessionId: string): Promise<string> {
    const { data, error } = await supabase.rpc('set_practice_invite_code', {
      session_id: sessionId,
    });

    if (error) {
      logger.error('Failed to generate invite code:', error);
      throw error;
    }

    logger.info('Generated practice invite code', { sessionId, code: data });
    return data as string;
  }

  /**
   * Clear invite code (revoke invites)
   */
  async clearInviteCode(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('practice_sessions')
      .update({ invite_code: null })
      .eq('id', sessionId);

    if (error) {
      logger.error('Failed to clear invite code:', error);
      throw error;
    }

    logger.info('Cleared practice invite code', { sessionId });
  }

  /**
   * Get session by invite code
   */
  async getSessionByInviteCode(inviteCode: string): Promise<PracticeSession | null> {
    const { data, error } = await supabase
      .from('practice_sessions')
      .select('*')
      .eq('invite_code', inviteCode.toUpperCase())
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      logger.error('Failed to get session by invite code:', error);
      throw error;
    }

    return rowToPracticeSession(data as PracticeSessionRow);
  }

  // =========================================================================
  // MEMBERS
  // =========================================================================

  /**
   * Get all members of a session
   */
  async getSessionMembers(sessionId: string): Promise<PracticeSessionMember[]> {
    // First get members
    const { data, error } = await supabase
      .from('practice_session_members')
      .select('*')
      .eq('session_id', sessionId)
      .order('joined_at', { ascending: true });

    if (error) {
      logger.error('Failed to get session members:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Then fetch profiles for all user IDs
    const userIds = data.map((m) => m.user_id).filter(Boolean);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, email')
      .in('id', userIds);

    const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

    return data.map((row: any) => ({
      ...rowToPracticeSessionMember(row as PracticeSessionMemberRow),
      profile: profileMap.has(row.user_id)
        ? {
            fullName: profileMap.get(row.user_id)!.full_name,
            avatarUrl: profileMap.get(row.user_id)!.avatar_url,
            email: profileMap.get(row.user_id)!.email,
          }
        : undefined,
    }));
  }

  /**
   * Join a session via invite code
   */
  async joinSession(input: JoinPracticeInput): Promise<PracticeSessionMember> {
    const { inviteCode, displayName, role } = input;

    const { data, error } = await supabase.rpc('join_practice_by_invite', {
      p_invite_code: inviteCode.toUpperCase(),
      p_display_name: displayName || null,
      p_role: role || 'crew',
    });

    if (error) {
      logger.error('Failed to join practice session:', error);
      throw error;
    }

    // Fetch the created member record
    const { data: memberData, error: memberError } = await supabase
      .from('practice_session_members')
      .select('*')
      .eq('id', data)
      .single();

    if (memberError) {
      logger.error('Failed to fetch joined member:', memberError);
      throw memberError;
    }

    logger.info('Joined practice session', { memberId: data, inviteCode });
    return rowToPracticeSessionMember(memberData as PracticeSessionMemberRow);
  }

  /**
   * Leave a session (remove self)
   */
  async leaveSession(sessionId: string): Promise<void> {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) {
      throw new Error('Not authenticated');
    }

    const { error } = await supabase
      .from('practice_session_members')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', user.user.id);

    if (error) {
      logger.error('Failed to leave session:', error);
      throw error;
    }

    logger.info('Left practice session', { sessionId });
  }

  /**
   * Update RSVP status
   */
  async updateRsvp(sessionId: string, status: RSVPStatus): Promise<void> {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) {
      throw new Error('Not authenticated');
    }

    const { error } = await supabase
      .from('practice_session_members')
      .update({ rsvp_status: status })
      .eq('session_id', sessionId)
      .eq('user_id', user.user.id);

    if (error) {
      logger.error('Failed to update RSVP:', error);
      throw error;
    }

    logger.info('Updated RSVP', { sessionId, status });
  }

  /**
   * Update member info
   */
  async updateMember(
    memberId: string,
    updates: { displayName?: string; role?: PracticeMemberRole }
  ): Promise<void> {
    const { error } = await supabase
      .from('practice_session_members')
      .update({
        display_name: updates.displayName,
        role: updates.role,
      })
      .eq('id', memberId);

    if (error) {
      logger.error('Failed to update member:', error);
      throw error;
    }
  }

  /**
   * Mark member as attended
   */
  async markAttendance(memberId: string, attended: boolean): Promise<void> {
    const { error } = await supabase
      .from('practice_session_members')
      .update({ attended })
      .eq('id', memberId);

    if (error) {
      logger.error('Failed to mark attendance:', error);
      throw error;
    }
  }

  /**
   * Remove a member (session creator only)
   */
  async removeMember(memberId: string): Promise<void> {
    const { error } = await supabase.from('practice_session_members').delete().eq('id', memberId);

    if (error) {
      logger.error('Failed to remove member:', error);
      throw error;
    }

    logger.info('Removed practice member', { memberId });
  }

  // =========================================================================
  // FOCUS AREAS
  // =========================================================================

  /**
   * Get focus areas for a session
   */
  async getSessionFocusAreas(sessionId: string): Promise<PracticeFocusArea[]> {
    const { data, error } = await supabase
      .from('practice_session_focus_areas')
      .select('*')
      .eq('session_id', sessionId)
      .order('priority', { ascending: true });

    if (error) {
      logger.error('Failed to get session focus areas:', error);
      throw error;
    }

    return (data || []).map((row) => rowToPracticeFocusArea(row as PracticeFocusAreaRow));
  }

  /**
   * Add focus areas to a session
   */
  async addFocusAreas(
    sessionId: string,
    areas: {
      skillArea: SkillArea;
      priority: number;
      aiSuggested?: boolean;
      suggestionReason?: string;
      postSessionRating?: number;
    }[]
  ): Promise<void> {
    const rows = areas.map((area) => ({
      session_id: sessionId,
      skill_area: area.skillArea,
      priority: area.priority,
      ai_suggested: area.aiSuggested || false,
      suggestion_reason: area.suggestionReason || null,
      post_session_rating: area.postSessionRating || null,
    }));

    const { error } = await supabase.from('practice_session_focus_areas').insert(rows);

    if (error) {
      logger.error('Failed to add focus areas:', error);
      throw error;
    }
  }

  /**
   * Update focus area rating after practice
   */
  async updateFocusAreaRating(
    focusAreaId: string,
    rating: number,
    notes?: string
  ): Promise<void> {
    const { error } = await supabase
      .from('practice_session_focus_areas')
      .update({
        post_session_rating: rating,
        improvement_notes: notes || null,
      })
      .eq('id', focusAreaId);

    if (error) {
      logger.error('Failed to update focus area rating:', error);
      throw error;
    }
  }

  /**
   * Remove a focus area
   */
  async removeFocusArea(focusAreaId: string): Promise<void> {
    const { error } = await supabase
      .from('practice_session_focus_areas')
      .delete()
      .eq('id', focusAreaId);

    if (error) {
      logger.error('Failed to remove focus area:', error);
      throw error;
    }
  }

  // =========================================================================
  // DRILLS
  // =========================================================================

  /**
   * Get drills for a session
   */
  async getSessionDrills(sessionId: string): Promise<PracticeSessionDrill[]> {
    const { data, error } = await supabase
      .from('practice_session_drills')
      .select(
        `
        *,
        drill:drill_id(*)
      `
      )
      .eq('session_id', sessionId)
      .order('order_index', { ascending: true });

    if (error) {
      logger.error('Failed to get session drills:', error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      ...rowToPracticeSessionDrill(row as PracticeSessionDrillRow),
      drill: row.drill || undefined,
    }));
  }

  /**
   * Add drills to a session
   * Accepts either simple string[] of drill IDs or rich objects with additional fields
   */
  async addDrills(
    sessionId: string,
    drills: string[] | {
      drillId: string;
      orderIndex?: number;
      plannedDurationMinutes?: number;
      repetitions?: number;
    }[]
  ): Promise<void> {
    // Get current max order index
    const { data: existing } = await supabase
      .from('practice_session_drills')
      .select('order_index')
      .eq('session_id', sessionId)
      .order('order_index', { ascending: false })
      .limit(1);

    const startIndex = (existing?.[0]?.order_index || -1) + 1;

    // Normalize input to handle both string[] and object[]
    const rows = drills.map((drill, index) => {
      const isString = typeof drill === 'string';
      const drillId = isString ? drill : drill.drillId;
      const orderIndex = isString ? startIndex + index : (drill.orderIndex ?? startIndex + index);
      const plannedDuration = isString ? null : drill.plannedDurationMinutes;
      const repetitions = isString ? null : drill.repetitions;

      return {
        session_id: sessionId,
        drill_id: drillId,
        order_index: orderIndex,
        planned_duration_minutes: plannedDuration,
        repetitions: repetitions,
      };
    });

    const { error } = await supabase.from('practice_session_drills').insert(rows);

    if (error) {
      logger.error('Failed to add drills:', error);
      throw error;
    }
  }

  /**
   * Update drill execution
   */
  async updateDrillExecution(
    sessionDrillId: string,
    updates: {
      completed?: boolean;
      rating?: number;
      notes?: string;
      actualDurationMinutes?: number;
      repetitions?: number;
      skipped?: boolean;
      skipReason?: string;
    }
  ): Promise<void> {
    const dbUpdates: Record<string, unknown> = {};

    if (updates.completed !== undefined) dbUpdates.completed = updates.completed;
    if (updates.rating !== undefined) dbUpdates.rating = updates.rating;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.actualDurationMinutes !== undefined)
      dbUpdates.actual_duration_minutes = updates.actualDurationMinutes;
    if (updates.repetitions !== undefined) dbUpdates.repetitions = updates.repetitions;
    if (updates.skipped !== undefined) dbUpdates.skipped = updates.skipped;
    if (updates.skipReason !== undefined) dbUpdates.skip_reason = updates.skipReason;

    const { error } = await supabase
      .from('practice_session_drills')
      .update(dbUpdates)
      .eq('id', sessionDrillId);

    if (error) {
      logger.error('Failed to update drill execution:', error);
      throw error;
    }
  }

  /**
   * Reorder drills in a session
   */
  async reorderDrills(sessionId: string, drillOrder: string[]): Promise<void> {
    // Update each drill's order_index
    const updates = drillOrder.map((drillId, index) =>
      supabase
        .from('practice_session_drills')
        .update({ order_index: index })
        .eq('id', drillId)
        .eq('session_id', sessionId)
    );

    await Promise.all(updates);
    logger.info('Reordered drills', { sessionId });
  }

  /**
   * Remove a drill from session
   */
  async removeDrill(sessionDrillId: string): Promise<void> {
    const { error } = await supabase
      .from('practice_session_drills')
      .delete()
      .eq('id', sessionDrillId);

    if (error) {
      logger.error('Failed to remove drill:', error);
      throw error;
    }
  }

  // =========================================================================
  // REALTIME
  // =========================================================================

  /**
   * Subscribe to member changes for real-time updates
   */
  subscribeToMemberChanges(
    sessionId: string,
    callback: (members: PracticeSessionMember[]) => void
  ): () => void {
    const channel = supabase
      .channel(`practice-members-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'practice_session_members',
          filter: `session_id=eq.${sessionId}`,
        },
        async () => {
          // Refetch all members on any change
          const members = await this.getSessionMembers(sessionId);
          callback(members);
        }
      )
      .subscribe();

    // Return unsubscribe function
    return () => {
      supabase.removeChannel(channel);
    };
  }
}

// Export singleton instance
export const PracticeSessionService = new PracticeSessionServiceClass();

// Backwards compatibility alias
export const practiceSessionService = PracticeSessionService;
