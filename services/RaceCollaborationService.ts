/**
 * RaceCollaborationService
 *
 * Service for managing race card collaboration:
 * - Inviting crew members to races
 * - Managing collaborator access levels
 * - Real-time chat between collaborators
 * - Subscription to changes
 *
 * Follows the TeamRaceEntryService.ts pattern.
 */

import { supabase } from '@/services/supabase';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { realtimeService } from '@/services/RealtimeService';
import { createLogger } from '@/lib/utils/logger';
import { isMissingIdColumn } from '@/lib/utils/supabaseSchemaFallback';
import { isUuid } from '@/utils/uuid';
import {
  RaceCollaborator,
  RaceMessage,
  RaceCollaboratorRow,
  RaceMessageRow,
  AccessLevel,
  MessageType,
  JoinRaceResult,
  CreateInviteResult,
  rowToRaceCollaborator,
  rowToRaceMessage,
} from '@/types/raceCollaboration';

const logger = createLogger('RaceCollaborationService');

/**
 * Service for managing race collaboration
 */
class RaceCollaborationServiceClass {
  private collaboratorsIdColumn: 'regatta_id' | 'race_id' = 'regatta_id';
  private messagesIdColumn: 'regatta_id' | 'race_id' = 'regatta_id';

  // =========================================================================
  // COLLABORATOR CRUD
  // =========================================================================

  /**
   * Create an invite for a race (owner only)
   * Uses RPC function to handle invite code generation
   */
  async createInvite(
    regattaId: string,
    accessLevel: AccessLevel = 'view',
    displayName?: string,
    role?: string
  ): Promise<{ collaboratorId: string; inviteCode: string }> {
    const { data, error } = await supabase.rpc('create_race_collaborator_invite', {
      p_regatta_id: regattaId,
      p_access_level: accessLevel,
      p_display_name: displayName || null,
      p_role: role || null,
    });

    if (error) {
      logger.error('Failed to create invite:', error);
      throw error;
    }

    const result = data as CreateInviteResult;
    if (!result.success) {
      throw new Error(result.error || 'Failed to create invite');
    }

    logger.info('Created invite', { regattaId, inviteCode: result.invite_code });
    return {
      collaboratorId: result.collaborator_id!,
      inviteCode: result.invite_code!,
    };
  }

  /**
   * Join a race via invite code
   */
  async joinByInviteCode(
    inviteCode: string,
    displayName?: string,
    role?: string
  ): Promise<{ regattaId: string; collaboratorId: string }> {
    const { data, error } = await supabase.rpc('join_race_by_invite_code', {
      p_invite_code: inviteCode.toUpperCase(),
      p_display_name: displayName || null,
      p_role: role || null,
    });

    if (error) {
      logger.error('Failed to join race:', error);
      throw error;
    }

    const result = data as JoinRaceResult;
    if (!result.success) {
      throw new Error(result.error || 'Failed to join race');
    }

    logger.info('Joined race', { inviteCode, regattaId: result.regatta_id });
    return {
      regattaId: result.regatta_id!,
      collaboratorId: result.collaborator_id!,
    };
  }

  /**
   * Get all collaborators for a race
   * Fetches basic collaborator data, then enriches with profile info
   */
  async getCollaborators(regattaId: string): Promise<RaceCollaborator[]> {
    // Skip query if regattaId is not a valid UUID (e.g., demo-race)
    if (!isUuid(regattaId)) {
      logger.debug('Skipping getCollaborators for non-UUID regattaId:', regattaId);
      return [];
    }

    // First, get the basic collaborator data
    let result = await supabase
      .from('race_collaborators')
      .select('*')
      .eq(this.collaboratorsIdColumn, regattaId)
      .order('created_at', { ascending: true });

    if (
      result.error &&
      this.collaboratorsIdColumn === 'regatta_id' &&
      isMissingIdColumn(result.error, 'race_collaborators', 'regatta_id')
    ) {
      this.collaboratorsIdColumn = 'race_id';
      result = await supabase
        .from('race_collaborators')
        .select('*')
        .eq('race_id', regattaId)
        .order('created_at', { ascending: true });
    }

    const collaborators = result.data;
    const error = result.error;

    if (error) {
      logger.error('Failed to get collaborators:', error);
      throw error;
    }

    if (!collaborators || collaborators.length === 0) {
      return [];
    }

    // Get unique user IDs that have values
    const userIds = collaborators
      .map((c) => c.user_id)
      .filter((id): id is string => !!id);

    // Fetch profile data for those users if we have any
    let profilesMap: Record<string, any> = {};
    let sailorProfilesMap: Record<string, any> = {};

    if (userIds.length > 0) {
      const [profilesResult, sailorProfilesResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, avatar_url, email')
          .in('id', userIds),
        supabase
          .from('sailor_profiles')
          .select('user_id, avatar_emoji, avatar_color')
          .in('user_id', userIds),
      ]);

      if (profilesResult.data) {
        profilesMap = Object.fromEntries(
          profilesResult.data.map((p) => [p.id, p])
        );
      }
      if (sailorProfilesResult.data) {
        sailorProfilesMap = Object.fromEntries(
          sailorProfilesResult.data.map((p) => [p.user_id, p])
        );
      }
    }

    // Combine collaborator data with profile info
    return collaborators.map((row: any) => {
      const profile = profilesMap[row.user_id];
      const sailorProfile = sailorProfilesMap[row.user_id];

      return {
        ...rowToRaceCollaborator(row as RaceCollaboratorRow),
        profile: profile || sailorProfile
          ? {
              fullName: profile?.full_name,
              avatarEmoji: sailorProfile?.avatar_emoji,
              avatarColor: sailorProfile?.avatar_color,
              email: profile?.email,
            }
          : undefined,
      };
    });
  }

  /**
   * Get a single collaborator by ID
   */
  async getCollaborator(collaboratorId: string): Promise<RaceCollaborator | null> {
    const { data, error } = await supabase
      .from('race_collaborators')
      .select('*')
      .eq('id', collaboratorId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      logger.error('Failed to get collaborator:', error);
      throw error;
    }

    // Fetch profile data if user_id exists
    let profile = undefined;
    if (data.user_id) {
      const [profileResult, sailorProfileResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, avatar_url, email')
          .eq('id', data.user_id)
          .single(),
        supabase
          .from('sailor_profiles')
          .select('user_id, avatar_emoji, avatar_color')
          .eq('user_id', data.user_id)
          .single(),
      ]);

      const p = profileResult.data;
      const sp = sailorProfileResult.data;
      if (p || sp) {
        profile = {
          fullName: p?.full_name,
          avatarEmoji: sp?.avatar_emoji,
          avatarColor: sp?.avatar_color,
          email: p?.email,
        };
      }
    }

    return {
      ...rowToRaceCollaborator(data as RaceCollaboratorRow),
      profile,
    };
  }

  /**
   * Update collaborator access level (owner only)
   */
  async updateAccessLevel(collaboratorId: string, accessLevel: AccessLevel): Promise<void> {
    const { data, error } = await supabase
      .from('race_collaborators')
      .update({ access_level: accessLevel })
      .eq('id', collaboratorId)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('Failed to update access level:', error);
      throw error;
    }
    if (!data) throw new Error('Race collaborator not found.');

    logger.info('Updated access level', { collaboratorId, accessLevel });
  }

  /**
   * Update collaborator display name or role
   */
  async updateCollaborator(
    collaboratorId: string,
    updates: { displayName?: string; role?: string }
  ): Promise<void> {
    const { data, error } = await supabase
      .from('race_collaborators')
      .update({
        display_name: updates.displayName,
        role: updates.role,
      })
      .eq('id', collaboratorId)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('Failed to update collaborator:', error);
      throw error;
    }
    if (!data) throw new Error('Race collaborator not found.');
  }

  /**
   * Remove a collaborator (owner or self)
   */
  async removeCollaborator(collaboratorId: string): Promise<void> {
    const { data, error } = await supabase
      .from('race_collaborators')
      .delete()
      .eq('id', collaboratorId)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('Failed to remove collaborator:', error);
      throw error;
    }
    if (!data) throw new Error('Race collaborator not found.');

    logger.info('Removed collaborator', { collaboratorId });
  }

  /**
   * Accept a pending invite (changes status from 'pending' to 'accepted')
   */
  async acceptInvite(collaboratorId: string): Promise<void> {
    const { data, error } = await supabase
      .from('race_collaborators')
      .update({
        status: 'accepted',
        joined_at: new Date().toISOString(),
      })
      .eq('id', collaboratorId)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('Failed to accept invite:', error);
      throw error;
    }
    if (!data) throw new Error('Race collaborator not found.');

    logger.info('Accepted invite', { collaboratorId });
  }

  /**
   * Decline a pending invite (changes status from 'pending' to 'declined')
   */
  async declineInvite(collaboratorId: string): Promise<void> {
    const { data, error } = await supabase
      .from('race_collaborators')
      .update({
        status: 'declined',
      })
      .eq('id', collaboratorId)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('Failed to decline invite:', error);
      throw error;
    }
    if (!data) throw new Error('Race collaborator not found.');

    logger.info('Declined invite', { collaboratorId });
  }

  /**
   * Request to join a race (from Social Sailing timeline)
   * Creates a pending collaborator entry that the race owner can approve/decline
   */
  async requestToJoin(
    regattaId: string,
    userId: string,
    options?: { displayName?: string; role?: string; message?: string }
  ): Promise<{ collaboratorId: string }> {
    logger.info('Requesting to join race:', { regattaId, userId });

    // Check if user is already a collaborator
    let existingResult = await supabase
      .from('race_collaborators')
      .select('id, status')
      .eq(this.collaboratorsIdColumn, regattaId)
      .eq('user_id', userId)
      .single();

    if (
      existingResult.error &&
      this.collaboratorsIdColumn === 'regatta_id' &&
      isMissingIdColumn(existingResult.error, 'race_collaborators', 'regatta_id')
    ) {
      this.collaboratorsIdColumn = 'race_id';
      existingResult = await supabase
        .from('race_collaborators')
        .select('id, status')
        .eq('race_id', regattaId)
        .eq('user_id', userId)
        .single();
    }

    const existing = existingResult.data;

    if (existing) {
      if (existing.status === 'accepted') {
        throw new Error('You are already a member of this race');
      }
      if (existing.status === 'pending') {
        throw new Error('Your request is already pending');
      }
      if (existing.status === 'declined') {
        // Update the existing declined request to pending
        const { error: updateError } = await supabase
          .from('race_collaborators')
          .update({
            status: 'pending',
            role: options?.role || 'Requested',
          })
          .eq('id', existing.id);

        if (updateError) {
          logger.error('Failed to update join request:', updateError);
          throw updateError;
        }

        return { collaboratorId: existing.id };
      }
    }

    // Create new collaborator with pending status
    let insertResult = await supabase
      .from('race_collaborators')
      .insert({
        [this.collaboratorsIdColumn]: regattaId,
        user_id: userId,
        display_name: options?.displayName || null,
        access_level: 'view', // Will be updated when approved
        role: options?.role || 'Requested',
        status: 'pending',
      })
      .select('id')
      .single();

    if (
      insertResult.error &&
      this.collaboratorsIdColumn === 'regatta_id' &&
      isMissingIdColumn(insertResult.error, 'race_collaborators', 'regatta_id')
    ) {
      this.collaboratorsIdColumn = 'race_id';
      insertResult = await supabase
        .from('race_collaborators')
        .insert({
          race_id: regattaId,
          user_id: userId,
          display_name: options?.displayName || null,
          access_level: 'view',
          role: options?.role || 'Requested',
          status: 'pending',
        })
        .select('id')
        .single();
    }

    const newCollab = insertResult.data;
    const insertError = insertResult.error;

    if (insertError) {
      logger.error('Failed to create join request:', insertError);
      throw insertError;
    }

    if (!newCollab) {
      throw new Error('Insert succeeded but returned no data');
    }
    logger.info('Created join request', { regattaId, userId, collaboratorId: newCollab.id });
    return { collaboratorId: newCollab.id };
  }

  /**
   * Approve a join request (race owner only)
   * Changes status from 'pending' to 'accepted' and grants edit access
   */
  async approveJoinRequest(collaboratorId: string): Promise<void> {
    const { error } = await supabase
      .from('race_collaborators')
      .update({
        status: 'accepted',
        access_level: 'full',
        joined_at: new Date().toISOString(),
      })
      .eq('id', collaboratorId);

    if (error) {
      logger.error('Failed to approve join request:', error);
      throw error;
    }

    logger.info('Approved join request', { collaboratorId });
  }

  /**
   * Add a crew member as a collaborator with edit access.
   * Used when crew is assigned to race positions in SailingTab.
   * Uses upsert to handle existing collaborators - updates their role and access.
   * Status is set to 'accepted' immediately (no approval needed for crew).
   */
  async addCrewAsCollaborator(
    regattaId: string,
    userId: string,
    role: string // Position: "Helmsman", "Tactician", etc.
  ): Promise<{ collaboratorId: string; isNew: boolean }> {
    const { data: currentUser } = await supabase.auth.getUser();
    if (!currentUser?.user) {
      throw new Error('Not authenticated');
    }

    // Check if user is already a collaborator
    let existingResult = await supabase
      .from('race_collaborators')
      .select('id')
      .eq(this.collaboratorsIdColumn, regattaId)
      .eq('user_id', userId)
      .single();

    if (
      existingResult.error &&
      this.collaboratorsIdColumn === 'regatta_id' &&
      isMissingIdColumn(existingResult.error, 'race_collaborators', 'regatta_id')
    ) {
      this.collaboratorsIdColumn = 'race_id';
      existingResult = await supabase
        .from('race_collaborators')
        .select('id')
        .eq('race_id', regattaId)
        .eq('user_id', userId)
        .single();
    }

    const existing = existingResult.data;

    if (existing) {
      // Update existing collaborator with new role and full access
      const { error: updateError } = await supabase
        .from('race_collaborators')
        .update({
          access_level: 'full',
          role: role,
          status: 'accepted',
          joined_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateError) {
        logger.error('Failed to update crew collaborator:', updateError);
        throw updateError;
      }

      logger.info('Updated crew collaborator', { regattaId, userId, role });
      return { collaboratorId: existing.id, isNew: false };
    }

    // Create new collaborator with full access and accepted status
    let insertResult = await supabase
      .from('race_collaborators')
      .insert({
        [this.collaboratorsIdColumn]: regattaId,
        user_id: userId,
        invited_by: currentUser.user.id,
        access_level: 'full',
        role: role,
        status: 'accepted',
        joined_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (
      insertResult.error &&
      this.collaboratorsIdColumn === 'regatta_id' &&
      isMissingIdColumn(insertResult.error, 'race_collaborators', 'regatta_id')
    ) {
      this.collaboratorsIdColumn = 'race_id';
      insertResult = await supabase
        .from('race_collaborators')
        .insert({
          race_id: regattaId,
          user_id: userId,
          invited_by: currentUser.user.id,
          access_level: 'full',
          role: role,
          status: 'accepted',
          joined_at: new Date().toISOString(),
        })
        .select('id')
        .single();
    }

    const newCollab = insertResult.data;
    const insertError = insertResult.error;

    if (insertError) {
      logger.error('Failed to add crew collaborator:', insertError);
      throw insertError;
    }

    if (!newCollab) {
      throw new Error('Insert succeeded but returned no data');
    }
    logger.info('Added crew as collaborator', { regattaId, userId, role });
    return { collaboratorId: newCollab.id, isNew: true };
  }

  /**
   * Remove a crew member's collaborator access.
   * Used when crew is removed from race positions.
   */
  async removeCrewCollaborator(
    regattaId: string,
    userId: string
  ): Promise<void> {
    let result = await supabase
      .from('race_collaborators')
      .delete()
      .eq(this.collaboratorsIdColumn, regattaId)
      .eq('user_id', userId);

    if (
      result.error &&
      this.collaboratorsIdColumn === 'regatta_id' &&
      isMissingIdColumn(result.error, 'race_collaborators', 'regatta_id')
    ) {
      this.collaboratorsIdColumn = 'race_id';
      result = await supabase
        .from('race_collaborators')
        .delete()
        .eq('race_id', regattaId)
        .eq('user_id', userId);
    }

    const error = result.error;

    if (error) {
      logger.error('Failed to remove crew collaborator:', error);
      throw error;
    }

    logger.info('Removed crew collaborator', { regattaId, userId });
  }

  /**
   * Directly invite a specific user to a race
   * Creates a pending invite that appears in their timeline
   */
  async inviteUser(
    regattaId: string,
    targetUserId: string,
    accessLevel: AccessLevel = 'view'
  ): Promise<{ collaboratorId: string; inviteCode: string }> {
    const { data, error } = await supabase.rpc('create_direct_invite', {
      p_regatta_id: regattaId,
      p_target_user_id: targetUserId,
      p_access_level: accessLevel,
    });

    if (error) {
      logger.error('Failed to invite user:', error);
      throw error;
    }

    const result = data as { success: boolean; error?: string; collaborator_id?: string; invite_code?: string };
    if (!result.success) {
      throw new Error(result.error || 'Failed to invite user');
    }

    logger.info('Invited user to race', { regattaId, targetUserId, collaboratorId: result.collaborator_id });
    return {
      collaboratorId: result.collaborator_id!,
      inviteCode: result.invite_code!,
    };
  }

  /**
   * Check if current user has access to a race
   */
  async checkAccess(regattaId: string): Promise<{
    hasAccess: boolean;
    accessLevel?: AccessLevel;
    isOwner: boolean;
    collaboratorId?: string;
  }> {
    // Skip query if regattaId is not a valid UUID (e.g., demo-race)
    if (!isUuid(regattaId)) {
      logger.debug('checkAccess: Skipping for non-UUID regattaId:', regattaId);
      return { hasAccess: false, isOwner: false };
    }

    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) {
      logger.debug('checkAccess: No authenticated user');
      return { hasAccess: false, isOwner: false };
    }

    logger.debug('checkAccess: Checking access for user', { userId: user.user.id, regattaId });

    // Check if user is owner
    const { data: regatta, error: regattaError } = await supabase
      .from('regattas')
      .select('created_by')
      .eq('id', regattaId)
      .single();

    if (regattaError) {
      logger.warn('checkAccess: Failed to fetch regatta', regattaError);
    }

    logger.debug('checkAccess: Regatta result', {
      regattaCreatedBy: regatta?.created_by,
      userId: user.user.id,
      match: regatta?.created_by === user.user.id
    });

    if (regatta?.created_by === user.user.id) {
      logger.debug('checkAccess: User is owner');
      return { hasAccess: true, accessLevel: 'full', isOwner: true };
    }

    // Check if user is collaborator
    const { data: collaborator, error: collabError } = await supabase
      .from('race_collaborators')
      .select('id, access_level, status')
      .eq(this.collaboratorsIdColumn, regattaId)
      .eq('user_id', user.user.id)
      .single();

    let resolvedCollaborator = collaborator;
    let resolvedCollabError = collabError;

    if (
      resolvedCollabError &&
      this.collaboratorsIdColumn === 'regatta_id' &&
      isMissingIdColumn(resolvedCollabError, 'race_collaborators', 'regatta_id')
    ) {
      this.collaboratorsIdColumn = 'race_id';
      const fallback = await supabase
        .from('race_collaborators')
        .select('id, access_level, status')
        .eq('race_id', regattaId)
        .eq('user_id', user.user.id)
        .single();
      resolvedCollaborator = fallback.data;
      resolvedCollabError = fallback.error;
    }

    if (resolvedCollabError && resolvedCollabError.code !== 'PGRST116') {
      logger.warn('checkAccess: Failed to fetch collaborator', collabError);
    }

    if (resolvedCollaborator && resolvedCollaborator.status === 'accepted') {
      logger.debug('checkAccess: User is collaborator', { accessLevel: resolvedCollaborator.access_level });
      return {
        hasAccess: true,
        accessLevel: resolvedCollaborator.access_level as AccessLevel,
        isOwner: false,
        collaboratorId: resolvedCollaborator.id,
      };
    }

    logger.debug('checkAccess: User has no access');
    return { hasAccess: false, isOwner: false };
  }

  // =========================================================================
  // MESSAGING
  // =========================================================================

  /**
   * Get messages for a race
   */
  async getMessages(regattaId: string, limit: number = 100): Promise<RaceMessage[]> {
    // Skip query if regattaId is not a valid UUID (e.g., demo-race)
    if (!isUuid(regattaId)) {
      logger.debug('Skipping getMessages for non-UUID regattaId:', regattaId);
      return [];
    }

    let result = await supabase
      .from('race_messages')
      .select('*')
      .eq(this.messagesIdColumn, regattaId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (
      result.error &&
      this.messagesIdColumn === 'regatta_id' &&
      isMissingIdColumn(result.error, 'race_messages', 'regatta_id')
    ) {
      this.messagesIdColumn = 'race_id';
      result = await supabase
        .from('race_messages')
        .select('*')
        .eq('race_id', regattaId)
        .order('created_at', { ascending: true })
        .limit(limit);
    }

    const messages = result.data;
    const error = result.error;

    if (error) {
      logger.error('Failed to get messages:', error);
      throw error;
    }

    if (!messages || messages.length === 0) {
      return [];
    }

    // Get unique user IDs
    const userIds = [...new Set(messages.map((m) => m.user_id))];

    // Fetch profile data
    let profilesMap: Record<string, any> = {};
    let sailorProfilesMap: Record<string, any> = {};

    if (userIds.length > 0) {
      const [profilesResult, sailorProfilesResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds),
        supabase
          .from('sailor_profiles')
          .select('user_id, avatar_emoji, avatar_color')
          .in('user_id', userIds),
      ]);

      if (profilesResult.data) {
        profilesMap = Object.fromEntries(
          profilesResult.data.map((p) => [p.id, p])
        );
      }
      if (sailorProfilesResult.data) {
        sailorProfilesMap = Object.fromEntries(
          sailorProfilesResult.data.map((p) => [p.user_id, p])
        );
      }
    }

    return messages.map((row: any) => {
      const profile = profilesMap[row.user_id];
      const sailorProfile = sailorProfilesMap[row.user_id];

      return {
        ...rowToRaceMessage(row as RaceMessageRow),
        profile: profile || sailorProfile
          ? {
              fullName: profile?.full_name,
              avatarEmoji: sailorProfile?.avatar_emoji,
              avatarColor: sailorProfile?.avatar_color,
            }
          : undefined,
      };
    });
  }

  /**
   * Send a message
   */
  async sendMessage(
    regattaId: string,
    message: string,
    messageType: MessageType = 'text'
  ): Promise<RaceMessage> {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) {
      throw new Error('Not authenticated');
    }

    let result = await supabase
      .from('race_messages')
      .insert({
        [this.messagesIdColumn]: regattaId,
        user_id: user.user.id,
        message,
        message_type: messageType,
      })
      .select()
      .single();

    if (
      result.error &&
      this.messagesIdColumn === 'regatta_id' &&
      isMissingIdColumn(result.error, 'race_messages', 'regatta_id')
    ) {
      this.messagesIdColumn = 'race_id';
      result = await supabase
        .from('race_messages')
        .insert({
          race_id: regattaId,
          user_id: user.user.id,
          message,
          message_type: messageType,
        })
        .select()
        .single();
    }

    const data = result.data;
    const error = result.error;

    if (error) {
      logger.error('Failed to send message:', error);
      throw error;
    }

    logger.info('Sent message', { regattaId, messageType });
    return rowToRaceMessage(data as RaceMessageRow);
  }

  /**
   * Delete a message (own messages only)
   */
  async deleteMessage(messageId: string): Promise<void> {
    const { error } = await supabase
      .from('race_messages')
      .delete()
      .eq('id', messageId);

    if (error) {
      logger.error('Failed to delete message:', error);
      throw error;
    }
  }

  // =========================================================================
  // REALTIME SUBSCRIPTIONS
  // =========================================================================

  /**
   * Subscribe to collaborator changes for real-time updates
   * Returns unsubscribe function
   */
  subscribeToCollaborators(
    regattaId: string,
    callback: (collaborators: RaceCollaborator[]) => void
  ): () => void {
    // Skip subscription if regattaId is not a valid UUID (e.g., demo-race)
    if (!isUuid(regattaId)) {
      logger.debug('Skipping subscribeToCollaborators for non-UUID regattaId:', regattaId);
      return () => {}; // No-op unsubscribe
    }

    const channelName = `race-collaborators:${regattaId}`;
    const handler = async (payload: RealtimePostgresChangesPayload<Record<string, any>>) => {
      const payloadRaceId =
        (payload as any)?.new?.regatta_id ||
        (payload as any)?.new?.race_id ||
        (payload as any)?.old?.regatta_id ||
        (payload as any)?.old?.race_id;
      if (payloadRaceId !== regattaId) return;
      // Refetch all collaborators on any change
      const collaborators = await this.getCollaborators(regattaId);
      callback(collaborators);
    };

    realtimeService.subscribe(
      channelName,
      {
        event: '*',
        schema: 'public',
        table: 'race_collaborators',
        filter: `regatta_id=eq.${regattaId}`,
      },
      handler
    );

    return () => {
      void realtimeService.unsubscribe(channelName, handler);
    };
  }

  /**
   * Subscribe to message changes for real-time chat
   * Returns unsubscribe function
   */
  subscribeToMessages(
    regattaId: string,
    callback: (messages: RaceMessage[]) => void
  ): () => void {
    // Skip subscription if regattaId is not a valid UUID (e.g., demo-race)
    if (!isUuid(regattaId)) {
      logger.debug('Skipping subscribeToMessages for non-UUID regattaId:', regattaId);
      return () => {}; // No-op unsubscribe
    }

    const channelName = `race-messages:${regattaId}`;
    const handler = async (payload: RealtimePostgresChangesPayload<Record<string, any>>) => {
      const payloadRaceId =
        (payload as any)?.new?.regatta_id ||
        (payload as any)?.new?.race_id ||
        (payload as any)?.old?.regatta_id ||
        (payload as any)?.old?.race_id;
      if (payloadRaceId !== regattaId) return;
      // Refetch all messages on any change
      const messages = await this.getMessages(regattaId);
      callback(messages);
    };

    realtimeService.subscribe(
      channelName,
      {
        event: '*',
        schema: 'public',
        table: 'race_messages',
        filter: `regatta_id=eq.${regattaId}`,
      },
      handler
    );

    return () => {
      void realtimeService.unsubscribe(channelName, handler);
    };
  }
}

// Export singleton instance
export const RaceCollaborationService = new RaceCollaborationServiceClass();

// Export type for dependency injection
export type RaceCollaborationServiceType = typeof RaceCollaborationService;
