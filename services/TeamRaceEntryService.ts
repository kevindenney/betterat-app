/**
 * TeamRaceEntryService
 *
 * Service for managing shared team race entries.
 * Enables team racing collaboration:
 * - Creating team entries for races
 * - Generating invite codes for teammates
 * - Joining teams via invite code
 * - Managing team checklist state
 */

import { supabase } from '@/services/supabase';
import { realtimeService } from '@/services/RealtimeService';
import { createLogger } from '@/lib/utils/logger';
import {
  TeamRaceEntry,
  TeamRaceEntryMember,
  TeamRaceChecklistState,
  TeamRaceEntryRow,
  TeamRaceEntryMemberRow,
  TeamRaceChecklistRow,
  TeamChecklistCompletion,
  CreateTeamEntryInput,
  JoinTeamInput,
  rowToTeamRaceEntry,
  rowToTeamRaceEntryMember,
  rowToTeamRaceChecklistState,
} from '@/types/teamRacing';

const logger = createLogger('TeamRaceEntryService');

/**
 * Service for managing team race entries and collaboration
 */
class TeamRaceEntryServiceClass {
  // =========================================================================
  // TEAM ENTRY CRUD
  // =========================================================================

  /**
   * Create a new team entry for a race
   * Automatically adds creator as first member and creates checklist
   */
  async createTeamEntry(input: CreateTeamEntryInput): Promise<TeamRaceEntry> {
    const { raceEventId, teamName } = input;

    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) {
      throw new Error('Not authenticated');
    }

    const { data, error } = await supabase
      .from('team_race_entries')
      .insert({
        race_event_id: raceEventId,
        team_name: teamName,
        created_by: user.user.id,
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create team entry:', error);
      throw error;
    }

    logger.info('Created team entry', { teamEntryId: data.id, raceEventId });
    return rowToTeamRaceEntry(data as TeamRaceEntryRow);
  }

  /**
   * Get a team entry by ID
   */
  async getTeamEntry(entryId: string): Promise<TeamRaceEntry | null> {
    const { data, error } = await supabase
      .from('team_race_entries')
      .select('*')
      .eq('id', entryId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      logger.error('Failed to get team entry:', error);
      throw error;
    }

    return rowToTeamRaceEntry(data as TeamRaceEntryRow);
  }

  /**
   * Get team entry for a race (if user is member)
   * Returns the user's team entry for a specific race
   */
  async getTeamEntryForRace(raceEventId: string): Promise<TeamRaceEntry | null> {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return null;

    // First, check if user is a member of any team for this race
    const { data: membershipData, error: membershipError } = await supabase
      .from('team_race_entry_members')
      .select('team_entry_id')
      .eq('user_id', user.user.id);

    if (membershipError) {
      logger.error('Failed to check team membership:', membershipError);
      throw membershipError;
    }

    if (!membershipData || membershipData.length === 0) {
      // User is not a member of any team - this is normal, not an error
      return null;
    }

    // Get team entry IDs the user is a member of
    const teamEntryIds = membershipData.map((m) => m.team_entry_id);

    // Find the team entry for this specific race
    const { data, error } = await supabase
      .from('team_race_entries')
      .select('*')
      .eq('race_event_id', raceEventId)
      .in('id', teamEntryIds)
      .maybeSingle();

    if (error) {
      logger.error('Failed to get team entry for race:', error);
      throw error;
    }

    return data ? rowToTeamRaceEntry(data as TeamRaceEntryRow) : null;
  }

  /**
   * Get team entry by invite code
   */
  async getTeamEntryByInviteCode(inviteCode: string): Promise<TeamRaceEntry | null> {
    const { data, error } = await supabase
      .from('team_race_entries')
      .select('*')
      .eq('invite_code', inviteCode.toUpperCase())
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      logger.error('Failed to get team entry by invite code:', error);
      throw error;
    }

    return rowToTeamRaceEntry(data as TeamRaceEntryRow);
  }

  /**
   * Delete a team entry (creator only)
   */
  async deleteTeamEntry(entryId: string): Promise<void> {
    const { error } = await supabase
      .from('team_race_entries')
      .delete()
      .eq('id', entryId);

    if (error) {
      logger.error('Failed to delete team entry:', error);
      throw error;
    }

    logger.info('Deleted team entry', { entryId });
  }

  // =========================================================================
  // INVITE CODE
  // =========================================================================

  /**
   * Generate an invite code for a team entry
   */
  async generateInviteCode(entryId: string): Promise<string> {
    const { data, error } = await supabase.rpc('set_team_invite_code', {
      entry_id: entryId,
    });

    if (error) {
      logger.error('Failed to generate invite code:', error);
      throw error;
    }

    logger.info('Generated invite code', { entryId, code: data });
    return data as string;
  }

  /**
   * Clear invite code (revoke invites)
   */
  async clearInviteCode(entryId: string): Promise<void> {
    const { error } = await supabase
      .from('team_race_entries')
      .update({ invite_code: null })
      .eq('id', entryId);

    if (error) {
      logger.error('Failed to clear invite code:', error);
      throw error;
    }

    logger.info('Cleared invite code', { entryId });
  }

  // =========================================================================
  // TEAM MEMBERS
  // =========================================================================

  /**
   * Get all members of a team entry
   */
  async getTeamMembers(entryId: string): Promise<TeamRaceEntryMember[]> {
    const { data, error } = await supabase
      .from('team_race_entry_members')
      .select(`
        *,
        profiles:user_id(full_name, avatar_url, email)
      `)
      .eq('team_entry_id', entryId)
      .order('joined_at', { ascending: true });

    if (error) {
      logger.error('Failed to get team members:', error);
      throw error;
    }

    return (data || []).map((row: any) => ({
      ...rowToTeamRaceEntryMember(row as TeamRaceEntryMemberRow),
      profile: row.profiles
        ? {
            fullName: row.profiles.full_name,
            avatarUrl: row.profiles.avatar_url,
            email: row.profiles.email,
          }
        : undefined,
    }));
  }

  /**
   * Join a team via invite code
   */
  async joinTeam(input: JoinTeamInput): Promise<TeamRaceEntryMember> {
    const { inviteCode, displayName, sailNumber, role } = input;

    const { data, error } = await supabase.rpc('join_team_by_invite', {
      p_invite_code: inviteCode.toUpperCase(),
      p_display_name: displayName || null,
      p_sail_number: sailNumber || null,
      p_role: role || null,
    });

    if (error) {
      logger.error('Failed to join team:', error);
      throw error;
    }

    // Fetch the created member record
    const { data: memberData, error: memberError } = await supabase
      .from('team_race_entry_members')
      .select('*')
      .eq('id', data)
      .single();

    if (memberError) {
      logger.error('Failed to fetch joined member:', memberError);
      throw memberError;
    }

    logger.info('Joined team', { memberId: data, inviteCode });
    return rowToTeamRaceEntryMember(memberData as TeamRaceEntryMemberRow);
  }

  /**
   * Leave a team (remove self)
   */
  async leaveTeam(entryId: string): Promise<void> {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) {
      throw new Error('Not authenticated');
    }

    const { error } = await supabase
      .from('team_race_entry_members')
      .delete()
      .eq('team_entry_id', entryId)
      .eq('user_id', user.user.id);

    if (error) {
      logger.error('Failed to leave team:', error);
      throw error;
    }

    logger.info('Left team', { entryId });
  }

  /**
   * Update member info
   */
  async updateMember(
    memberId: string,
    updates: { displayName?: string; sailNumber?: string; role?: 'skipper' | 'crew' }
  ): Promise<void> {
    const { error } = await supabase
      .from('team_race_entry_members')
      .update({
        display_name: updates.displayName,
        sail_number: updates.sailNumber,
        role: updates.role,
      })
      .eq('id', memberId);

    if (error) {
      logger.error('Failed to update member:', error);
      throw error;
    }
  }

  /**
   * Remove a member (team creator only)
   */
  async removeMember(memberId: string): Promise<void> {
    const { error } = await supabase
      .from('team_race_entry_members')
      .delete()
      .eq('id', memberId);

    if (error) {
      logger.error('Failed to remove member:', error);
      throw error;
    }

    logger.info('Removed member', { memberId });
  }

  // =========================================================================
  // CHECKLIST STATE
  // =========================================================================

  /**
   * Get checklist state for a team entry
   */
  async getChecklistState(entryId: string): Promise<TeamRaceChecklistState | null> {
    const { data, error } = await supabase
      .from('team_race_checklists')
      .select('*')
      .eq('team_entry_id', entryId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      logger.error('Failed to get checklist state:', error);
      throw error;
    }

    return rowToTeamRaceChecklistState(data as TeamRaceChecklistRow);
  }

  /**
   * Update a single checklist item
   */
  async updateChecklistItem(
    entryId: string,
    itemId: string,
    completion: TeamChecklistCompletion | null
  ): Promise<void> {
    // Get current state
    const { data: current, error: fetchError } = await supabase
      .from('team_race_checklists')
      .select('checklist_state')
      .eq('team_entry_id', entryId)
      .single();

    if (fetchError) {
      logger.error('Failed to fetch checklist state:', fetchError);
      throw fetchError;
    }

    // Update state
    const currentState = (current?.checklist_state || {}) as Record<
      string,
      TeamChecklistCompletion
    >;

    if (completion) {
      currentState[itemId] = completion;
    } else {
      delete currentState[itemId];
    }

    // Save updated state
    const { error: updateError } = await supabase
      .from('team_race_checklists')
      .update({ checklist_state: currentState })
      .eq('team_entry_id', entryId);

    if (updateError) {
      logger.error('Failed to update checklist state:', updateError);
      throw updateError;
    }

    logger.info('Updated checklist item', { entryId, itemId });
  }

  /**
   * Reset all checklist items
   */
  async resetChecklist(entryId: string): Promise<void> {
    const { error } = await supabase
      .from('team_race_checklists')
      .update({ checklist_state: {} })
      .eq('team_entry_id', entryId);

    if (error) {
      logger.error('Failed to reset checklist:', error);
      throw error;
    }

    logger.info('Reset checklist', { entryId });
  }

  // =========================================================================
  // REALTIME SUBSCRIPTION
  // =========================================================================

  /**
   * Subscribe to checklist changes for real-time sync
   * Returns unsubscribe function
   */
  subscribeToChecklistChanges(
    entryId: string,
    callback: (state: TeamRaceChecklistState) => void
  ): () => void {
    const channelName = `team-checklist:${entryId}`;
    const handleChecklistChange = (payload: { new: unknown }) => {
      if (payload.new) {
        callback(rowToTeamRaceChecklistState(payload.new as TeamRaceChecklistRow));
      }
    };

    realtimeService.subscribe(
      channelName,
      {
        event: '*',
        schema: 'public',
        table: 'team_race_checklists',
        filter: `team_entry_id=eq.${entryId}`,
      },
      handleChecklistChange
    );

    return () => {
      void realtimeService.unsubscribe(channelName, handleChecklistChange);
    };
  }

  /**
   * Subscribe to team member changes
   * Returns unsubscribe function
   */
  subscribeToMemberChanges(
    entryId: string,
    callback: (members: TeamRaceEntryMember[]) => void
  ): () => void {
    const channelName = `team-members:${entryId}`;
    const handleMemberChange = async () => {
      // Refetch all members on any change
      const members = await this.getTeamMembers(entryId);
      callback(members);
    };

    realtimeService.subscribe(
      channelName,
      {
        event: '*',
        schema: 'public',
        table: 'team_race_entry_members',
        filter: `team_entry_id=eq.${entryId}`,
      },
      handleMemberChange
    );

    return () => {
      void realtimeService.unsubscribe(channelName, handleMemberChange);
    };
  }
}

// Export singleton instance
export const teamRaceEntryService = new TeamRaceEntryServiceClass();

// Export type for dependency injection
export type TeamRaceEntryService = typeof teamRaceEntryService;
