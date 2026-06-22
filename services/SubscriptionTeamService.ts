/**
 * Subscription Team Service
 *
 * Handles subscription-level team management for Team plan subscribers.
 * Allows team owners to invite members, manage seats, and share subscription benefits.
 */

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import type {
  SubscriptionTeam,
  SubscriptionTeamWithMembers,
  SubscriptionTeamInvite,
  InviteResult,
  TeamSeatUsage,
  SubscriptionTeamMemberWithProfile,
} from '@/types/subscriptionTeam';

const logger = createLogger('SubscriptionTeamService');

export class SubscriptionTeamService {
  /**
   * Get the user's subscription team (either as owner or member)
   */
  static async getTeam(userId: string): Promise<SubscriptionTeam | null> {
    try {
      // First check if user owns a team
      const { data: ownedTeam } = await supabase
        .from('subscription_teams')
        .select('*')
        .eq('owner_id', userId)
        .single();

      if (ownedTeam) {
        return ownedTeam;
      }

      // Check if user is a member of a team
      const { data: membership } = await supabase
        .from('subscription_team_members')
        .select('team_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (membership) {
        const { data: team } = await supabase
          .from('subscription_teams')
          .select('*')
          .eq('id', membership.team_id)
          .single();

        return team;
      }

      return null;
    } catch (error) {
      logger.error('Failed to get team:', error);
      return null;
    }
  }

  /**
   * Get team with all members
   */
  static async getTeamWithMembers(teamId: string): Promise<SubscriptionTeamWithMembers | null> {
    try {
      const { data: team, error: teamError } = await supabase
        .from('subscription_teams')
        .select('*')
        .eq('id', teamId)
        .single();

      if (teamError || !team) {
        return null;
      }

      const { data: members, error: membersError } = await supabase
        .from('subscription_team_members')
        .select(`
          *,
          profile:profiles!subscription_team_members_user_id_fkey (
            full_name,
            avatar_url
          )
        `)
        .eq('team_id', teamId)
        .order('role', { ascending: true })
        .order('joined_at', { ascending: true });

      if (membersError) {
        logger.error('Failed to get team members:', membersError);
        return { ...team, members: [] };
      }

      return { ...team, members: members || [] };
    } catch (error) {
      logger.error('Failed to get team with members:', error);
      return null;
    }
  }

  /**
   * Get team members for a team
   */
  static async getTeamMembers(teamId: string): Promise<SubscriptionTeamMemberWithProfile[]> {
    try {
      const { data, error } = await supabase
        .from('subscription_team_members')
        .select(`
          *,
          profile:profiles!subscription_team_members_user_id_fkey (
            full_name,
            avatar_url
          )
        `)
        .eq('team_id', teamId)
        .order('role', { ascending: true })
        .order('joined_at', { ascending: true });

      if (error) {
        logger.error('Failed to get team members:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Failed to get team members:', error);
      return [];
    }
  }

  /**
   * Get seat usage for a team
   */
  static async getSeatUsage(teamId: string): Promise<TeamSeatUsage> {
    try {
      const { data: team, error: teamError } = await supabase
        .from('subscription_teams')
        .select('max_seats')
        .eq('id', teamId)
        .single();

      if (teamError || !team) {
        return { used: 0, max: 5, available: 5 };
      }

      const { count } = await supabase
        .from('subscription_team_members')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .eq('status', 'active');

      const used = count || 0;
      const max = team.max_seats;

      return {
        used,
        max,
        available: Math.max(0, max - used),
      };
    } catch (error) {
      logger.error('Failed to get seat usage:', error);
      return { used: 0, max: 5, available: 5 };
    }
  }

  /**
   * Invite a member by email
   */
  static async inviteByEmail(teamId: string, email: string): Promise<InviteResult> {
    try {
      // Check seat availability first
      const seatUsage = await this.getSeatUsage(teamId);
      const pendingCount = await this.getPendingInviteCount(teamId);

      if (seatUsage.used + pendingCount >= seatUsage.max) {
        return { success: false, error: 'Team is at maximum capacity' };
      }

      // Check if already invited or a member
      const { data: existing } = await supabase
        .from('subscription_team_members')
        .select('id, status')
        .eq('team_id', teamId)
        .eq('email', email.toLowerCase())
        .single();

      if (existing) {
        if (existing.status === 'active') {
          return { success: false, error: 'This person is already a team member' };
        } else {
          return { success: false, error: 'An invite has already been sent to this email' };
        }
      }

      // Create the invite
      const { error } = await supabase
        .from('subscription_team_members')
        .insert({
          team_id: teamId,
          email: email.toLowerCase(),
          role: 'member',
          status: 'pending',
          invited_at: new Date().toISOString(),
        });

      if (error) {
        logger.error('Failed to create invite:', error);
        return { success: false, error: 'Failed to send invite' };
      }

      // Trigger invite email via edge function
      try {
        await supabase.functions.invoke('send-team-invite', {
          body: { teamId, email: email.toLowerCase() },
        });
      } catch (emailError) {
        logger.error('Failed to send invite email:', emailError);
        // Don't fail the invite if email fails
      }

      return { success: true };
    } catch (error) {
      logger.error('Failed to invite member:', error);
      return { success: false, error: 'Failed to send invite' };
    }
  }

  /**
   * Generate or regenerate invite code for a team
   */
  static async generateInviteCode(teamId: string): Promise<string | null> {
    try {
      // Generate a new unique code
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const { data, error } = await supabase
        .from('subscription_teams')
        .update({ invite_code: code, updated_at: new Date().toISOString() })
        .eq('id', teamId)
        .select('id')
        .maybeSingle();

      if (error) {
        logger.error('Failed to generate invite code:', error);
        return null;
      }
      if (!data) {
        logger.error('Team not found while generating invite code');
        return null;
      }

      return code;
    } catch (error) {
      logger.error('Failed to generate invite code:', error);
      return null;
    }
  }

  /**
   * Get invite details by invite code
   */
  static async getInviteDetails(inviteCode: string): Promise<SubscriptionTeamInvite | null> {
    try {
      const { data: team, error } = await supabase
        .from('subscription_teams')
        .select(`
          id,
          name,
          max_seats,
          invite_code,
          owner:profiles!subscription_teams_owner_id_fkey (
            full_name,
            email:users!profiles_id_fkey (email)
          )
        `)
        .eq('invite_code', inviteCode)
        .single();

      if (error || !team) {
        return null;
      }

      // Get current seat count
      const { count } = await supabase
        .from('subscription_team_members')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', team.id)
        .eq('status', 'active');

      return {
        team_id: team.id,
        team_name: team.name,
        owner_name: (team.owner as any)?.full_name || 'Team Owner',
        owner_email: (team.owner as any)?.email?.email || '',
        invite_code: inviteCode,
        max_seats: team.max_seats,
        current_seats: count || 0,
      };
    } catch (error) {
      logger.error('Failed to get invite details:', error);
      return null;
    }
  }

  /**
   * Accept an invite using invite code
   */
  static async acceptInvite(inviteCode: string, userId: string): Promise<InviteResult> {
    try {
      const { data, error } = await supabase.rpc('accept_team_invite', {
        p_invite_code: inviteCode,
        p_user_id: userId,
      });

      if (error) {
        logger.error('Failed to accept invite:', error);
        return { success: false, error: 'Failed to join team' };
      }

      return data as InviteResult;
    } catch (error) {
      logger.error('Failed to accept invite:', error);
      return { success: false, error: 'Failed to join team' };
    }
  }

  /**
   * Remove a member from the team
   */
  static async removeMember(teamId: string, memberId: string): Promise<boolean> {
    try {
      // Get the member to check their role
      const { data: member, error: fetchError } = await supabase
        .from('subscription_team_members')
        .select('role, user_id')
        .eq('id', memberId)
        .eq('team_id', teamId)
        .single();

      if (fetchError || !member) {
        logger.error('Member not found:', fetchError);
        return false;
      }

      // Cannot remove the owner
      if (member.role === 'owner') {
        logger.error('Cannot remove team owner');
        return false;
      }

      // Remove the member
      const { data: deletedMember, error: deleteError } = await supabase
        .from('subscription_team_members')
        .delete()
        .eq('id', memberId)
        .eq('team_id', teamId)
        .select('id')
        .maybeSingle();

      if (deleteError) {
        logger.error('Failed to remove member:', deleteError);
        return false;
      }
      if (!deletedMember) {
        logger.error('Member not found while removing from team');
        return false;
      }

      // Update the removed user's profile and subscription
      if (member.user_id) {
        await supabase
          .from('profiles')
          .update({ subscription_team_id: null })
          .eq('id', member.user_id);

        // Reset their subscription to free
        await supabase
          .from('users')
          .update({
            subscription_tier: 'free',
            subscription_status: 'inactive',
          })
          .eq('id', member.user_id);
      }

      return true;
    } catch (error) {
      logger.error('Failed to remove member:', error);
      return false;
    }
  }

  /**
   * Cancel a pending invite
   */
  static async cancelInvite(teamId: string, memberId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('subscription_team_members')
        .delete()
        .eq('id', memberId)
        .eq('team_id', teamId)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();

      if (error) {
        logger.error('Failed to cancel invite:', error);
        return false;
      }
      if (!data) {
        logger.error('Pending invite not found while cancelling');
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Failed to cancel invite:', error);
      return false;
    }
  }

  /**
   * Update team name
   */
  static async updateTeamName(teamId: string, name: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('subscription_teams')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', teamId)
        .select('id')
        .maybeSingle();

      if (error) {
        logger.error('Failed to update team name:', error);
        return false;
      }
      if (!data) {
        logger.error('Team not found while updating name');
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Failed to update team name:', error);
      return false;
    }
  }

  /**
   * Get count of pending invites
   */
  private static async getPendingInviteCount(teamId: string): Promise<number> {
    const { count } = await supabase
      .from('subscription_team_members')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('status', 'pending');

    return count || 0;
  }

  /**
   * Check if a user is the owner of a team
   */
  static async isTeamOwner(userId: string, teamId: string): Promise<boolean> {
    const { data } = await supabase
      .from('subscription_teams')
      .select('id')
      .eq('id', teamId)
      .eq('owner_id', userId)
      .single();

    return !!data;
  }

  /**
   * Leave a team (for non-owners)
   */
  static async leaveTeam(userId: string): Promise<boolean> {
    try {
      // Get the user's membership
      const { data: member, error: fetchError } = await supabase
        .from('subscription_team_members')
        .select('id, role, team_id')
        .eq('user_id', userId)
        .single();

      if (fetchError || !member) {
        return false;
      }

      // Owners cannot leave their own team
      if (member.role === 'owner') {
        return false;
      }

      // Remove membership
      const { data: deletedMember, error: deleteError } = await supabase
        .from('subscription_team_members')
        .delete()
        .eq('id', member.id)
        .eq('user_id', userId)
        .select('id')
        .maybeSingle();

      if (deleteError) {
        return false;
      }
      if (!deletedMember) {
        return false;
      }

      // Update profile
      await supabase
        .from('profiles')
        .update({ subscription_team_id: null })
        .eq('id', userId);

      // Reset subscription
      await supabase
        .from('users')
        .update({
          subscription_tier: 'free',
          subscription_status: 'inactive',
        })
        .eq('id', userId);

      return true;
    } catch (error) {
      logger.error('Failed to leave team:', error);
      return false;
    }
  }
}

export default SubscriptionTeamService;
