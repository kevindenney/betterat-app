// @ts-nocheck

/**
 * ClubMemberService
 *
 * Complete member management system for sailing clubs including:
 * - Member CRUD operations
 * - Membership request approval workflow
 * - Payment tracking
 * - Activity logging
 * - Bulk operations (CSV import, group emails)
 */

import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform, Share } from 'react-native';
import { createLogger } from '@/lib/utils/logger';
import { ClubRole, getRoleAliases, normalizeClubRole } from '@/types/club';

export interface ClubMember {
  id: string;
  club_id: string;
  user_id: string;
  membership_type: 'full' | 'social' | 'junior' | 'senior' | 'family' | 'honorary' | 'crew' | 'guest';
  status: 'pending' | 'active' | 'inactive' | 'suspended' | 'expired' | 'rejected';
  role: ClubRole;
  member_number?: string;
  sail_number?: string;
  boat_name?: string;
  boat_class?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  joined_date: string;
  expiry_date?: string;
  last_renewed_date?: string;
  membership_fee?: number;
  payment_status: 'unpaid' | 'paid' | 'partial' | 'waived' | 'overdue';
  last_payment_date?: string;
  last_payment_amount?: number;
  bio?: string;
  skills?: string[];
  certifications?: string[];
  interests?: string[];
  email_notifications: boolean;
  sms_notifications: boolean;
  newsletter_subscription: boolean;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  admin_notes?: string;
  total_events_participated: number;
  total_races_completed: number;
  total_volunteer_hours: number;
  last_activity_date?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  user?: {
    id: string;
    email?: string;
    full_name?: string;
    avatar_url?: string;
  };
}

export interface MembershipRequest {
  id: string;
  club_id: string;
  user_id: string;
  requested_membership_type: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  application_message?: string;
  sail_number?: string;
  boat_information?: any;
  references?: string[];
  reviewed_by?: string;
  reviewed_at?: string;
  decision_notes?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  user?: {
    id: string;
    email?: string;
    full_name?: string;
    avatar_url?: string;
  };
}

export interface MemberPayment {
  id: string;
  member_id: string;
  club_id: string;
  payment_type: 'membership_fee' | 'renewal' | 'event_fee' | 'late_fee' | 'refund' | 'other';
  amount: number;
  currency: string;
  payment_method?: string;
  stripe_payment_intent_id?: string;
  transaction_reference?: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  period_start?: string;
  period_end?: string;
  notes?: string;
  recorded_by?: string;
  created_at: string;
}

export interface MemberActivity {
  id: string;
  member_id: string;
  club_id: string;
  activity_type: 'event_participation' | 'race_completion' | 'volunteer_hours' | 'committee_meeting' | 'training_session' | 'boat_maintenance' | 'other';
  description: string;
  event_id?: string;
  hours?: number;
  points?: number;
  activity_date: string;
  recorded_by?: string;
  created_at: string;
}

export interface ClubMemberStats {
  total_members: number;
  active_members: number;
  pending_requests: number;
  expired_memberships: number;
  new_this_month: number;
  membership_revenue: number;
}

export interface MemberFilters {
  membership_type?: string[];
  status?: string[];
  role?: ClubRole[];
  payment_status?: string[];
  search?: string; // Search by name, email, sail number
}

const logger = createLogger('ClubMemberService');
class ClubMemberService {
  /**
   * Get all members for a club with optional filters
   */
  async getClubMembers(clubId: string, filters?: MemberFilters): Promise<ClubMember[]> {
    let query = supabase
      .from('club_members')
      .select(`
        *,
        user:users(id, email, full_name, avatar_url)
      `)
      .eq('club_id', clubId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters?.membership_type && filters.membership_type.length > 0) {
      query = query.in('membership_type', filters.membership_type);
    }

    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }

    if (filters?.role && filters.role.length > 0) {
      const rawRoles = Array.from(
        new Set(filters.role.flatMap((role) => getRoleAliases(role)))
      );
      query = query.in('role', rawRoles);
    }

    if (filters?.payment_status && filters.payment_status.length > 0) {
      query = query.in('payment_status', filters.payment_status);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching club members:', error);
      throw error;
    }

    // Client-side search filter (name, email, sail number)
    let results = data || [];
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      results = results.filter((member) => {
        const name = member.user?.full_name?.toLowerCase() || '';
        const email = member.user?.email?.toLowerCase() || '';
        const sailNumber = member.sail_number?.toLowerCase() || '';
        return (
          name.includes(searchLower) ||
          email.includes(searchLower) ||
          sailNumber.includes(searchLower)
        );
      });
    }

    return results.map((member) => ({
      ...member,
      role: normalizeClubRole(member.role),
    }));
  }

  /**
   * Get a single member by ID
   */
  async getMember(memberId: string): Promise<ClubMember | null> {
    const { data, error } = await supabase
      .from('club_members')
      .select(`
        *,
        user:users(id, email, full_name, avatar_url)
      `)
      .eq('id', memberId)
      .single();

    if (error) {
      logger.error('Error fetching member:', error);
      return null;
    }

    return data;
  }

  /**
   * Get club member statistics
   */
  async getClubMemberStats(clubId: string): Promise<ClubMemberStats> {
    const { data, error } = await supabase.rpc('get_club_member_stats', {
      club_uuid: clubId,
    });

    if (error) {
      logger.error('Error fetching member stats:', error);
      throw error;
    }

    return data[0] || {
      total_members: 0,
      active_members: 0,
      pending_requests: 0,
      expired_memberships: 0,
      new_this_month: 0,
      membership_revenue: 0,
    };
  }

  /**
   * Update member details
   */
  async updateMember(memberId: string, updates: Partial<ClubMember>): Promise<ClubMember> {
    const { data, error } = await supabase
      .from('club_members')
      .update(updates)
      .eq('id', memberId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating member:', error);
      throw error;
    }

    return data;
  }

  /**
   * Delete/remove a member
   */
  async deleteMember(memberId: string): Promise<void> {
    const { data, error } = await supabase
      .from('club_members')
      .delete()
      .eq('id', memberId)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('Error deleting member:', error);
      throw error;
    }
    if (!data) throw new Error('Club member not found.');
  }

  // ============================================================================
  // MEMBERSHIP REQUESTS / APPROVAL WORKFLOW
  // ============================================================================

  /**
   * Get pending membership requests for a club
   */
  async getPendingRequests(clubId: string): Promise<MembershipRequest[]> {
    const { data, error } = await supabase
      .from('membership_requests')
      .select(`
        *,
        user:users(id, email, full_name, avatar_url)
      `)
      .eq('club_id', clubId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Error fetching pending requests:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get all membership requests (including processed)
   */
  async getAllRequests(clubId: string): Promise<MembershipRequest[]> {
    const { data, error } = await supabase
      .from('membership_requests')
      .select(`
        *,
        user:users(id, email, full_name, avatar_url)
      `)
      .eq('club_id', clubId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching requests:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Approve a membership request
   */
  async approveRequest(
    requestId: string,
    approverId: string,
    role: ClubRole = 'member'
  ): Promise<string> {
    const { data, error } = await supabase.rpc('approve_membership_request', {
      request_uuid: requestId,
      approver_uuid: approverId,
      assigned_role: role,
    });

    if (error) {
      logger.error('Error approving request:', error);
      throw error;
    }

    // TODO: Send welcome email
    await this.sendWelcomeEmail(data);

    return data; // Returns new member ID
  }

  /**
   * Reject a membership request
   */
  async rejectRequest(
    requestId: string,
    reviewerId: string,
    reason: string
  ): Promise<void> {
    const { error } = await supabase.rpc('reject_membership_request', {
      request_uuid: requestId,
      reviewer_uuid: reviewerId,
      reason,
    });

    if (error) {
      logger.error('Error rejecting request:', error);
      throw error;
    }

    // TODO: Send rejection email
  }

  /**
   * Send welcome email to new member
   */
  private async sendWelcomeEmail(memberId: string): Promise<void> {
    // TODO: Implement email service integration
    logger.debug('Sending welcome email to member:', memberId);
    // This would integrate with SendGrid, EmailJS, or similar service
  }

  // ============================================================================
  // PAYMENT TRACKING
  // ============================================================================

  /**
   * Get payment history for a member
   */
  async getMemberPayments(memberId: string): Promise<MemberPayment[]> {
    const { data, error } = await supabase
      .from('member_payment_history')
      .select('*')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching payment history:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Record a payment
   */
  async recordPayment(payment: Partial<MemberPayment>): Promise<MemberPayment> {
    const { data, error } = await supabase
      .from('member_payment_history')
      .insert(payment)
      .select()
      .single();

    if (error) {
      logger.error('Error recording payment:', error);
      throw error;
    }

    // Update member payment status
    if (payment.member_id) {
      await supabase
        .from('club_members')
        .update({
          payment_status: 'paid',
          last_payment_date: new Date().toISOString().split('T')[0],
          last_payment_amount: payment.amount,
        })
        .eq('id', payment.member_id);
    }

    return data;
  }

  // ============================================================================
  // ACTIVITY TRACKING
  // ============================================================================

  /**
   * Get activity log for a member
   */
  async getMemberActivity(memberId: string): Promise<MemberActivity[]> {
    const { data, error } = await supabase
      .from('member_activity_log')
      .select('*')
      .eq('member_id', memberId)
      .order('activity_date', { ascending: false })
      .limit(50);

    if (error) {
      logger.error('Error fetching member activity:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Log member activity
   */
  async logActivity(activity: Partial<MemberActivity>): Promise<MemberActivity> {
    const { data, error } = await supabase
      .from('member_activity_log')
      .insert(activity)
      .select()
      .single();

    if (error) {
      logger.error('Error logging activity:', error);
      throw error;
    }

    return data;
  }

  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================

  /**
   * Export members to CSV
   */
  async exportMembersToCSV(clubId: string): Promise<string> {
    const members = await this.getClubMembers(clubId);

    const headers = [
      'Name',
      'Email',
      'Membership Type',
      'Status',
      'Role',
      'Sail Number',
      'Boat Class',
      'Joined Date',
      'Expiry Date',
      'Payment Status',
    ].join(',');

    const rows = members.map((member) =>
      [
        member.user?.full_name || '',
        member.user?.email || '',
        member.membership_type,
        member.status,
        member.role,
        member.sail_number || '',
        member.boat_class || '',
        member.joined_date,
        member.expiry_date || '',
        member.payment_status,
      ].join(',')
    );

    const csv = [headers, ...rows].join('\n');
    return csv;
  }

  /**
   * Share exported CSV file
   */
  async shareExportedMembers(clubId: string, clubName: string): Promise<void> {
    try {
      const csv = await this.exportMembersToCSV(clubId);
      const fileName = `${clubName.replace(/\s+/g, '_')}_members_${
        new Date().toISOString().split('T')[0]
      }.csv`;

      if (Platform.OS === 'web') {
        // Web fallback: download the CSV file
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        // Native: Save to file system and share
        const fileUri = FileSystem.documentDirectory + fileName;
        await FileSystem.writeAsStringAsync(fileUri, csv, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        await Share.share({
          url: fileUri,
          title: `${clubName} Member List`,
        });
      }
    } catch (error) {
      logger.error('Error sharing exported members:', error);
      throw error;
    }
  }

  /**
   * Import members from CSV
   * CSV format: name,email,membership_type,sail_number,boat_class
   */
  async importMembersFromCSV(clubId: string, csvContent: string): Promise<{
    success: number;
    errors: { row: number; error: string }[];
  }> {
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',');

    const results = {
      success: 0,
      errors: [] as { row: number; error: string }[],
    };

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(',');
        const row: any = {};

        headers.forEach((header, index) => {
          row[header.trim().toLowerCase().replace(/\s+/g, '_')] = values[index]?.trim();
        });

        // Create or find user
        // This is a simplified version - in production you'd want to:
        // 1. Check if user exists by email
        // 2. Invite them if they don't exist
        // 3. Create membership record

        // For now, we'll skip users that don't exist
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('email', row.email)
          .single();

        if (!userData) {
          results.errors.push({
            row: i + 1,
            error: `User with email ${row.email} not found`,
          });
          continue;
        }

        // Create membership
        await supabase.from('club_members').insert({
          club_id: clubId,
          user_id: userData.id,
          membership_type: row.membership_type || 'full',
          status: 'active',
          role: 'member',
          sail_number: row.sail_number,
          boat_class: row.boat_class,
          joined_date: new Date().toISOString().split('T')[0],
        });

        results.success++;
      } catch (error) {
        results.errors.push({
          row: i + 1,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Send group email to members
   */
  async sendGroupEmail(
    clubId: string,
    filters: MemberFilters,
    subject: string,
    message: string
  ): Promise<{ sent: number; failed: number }> {
    const members = await this.getClubMembers(clubId, filters);
    const emailableMembers = members.filter(
      (m) => m.email_notifications && m.user?.email
    );

    // TODO: Integrate with email service (SendGrid, etc.)
    logger.debug('Sending email to', emailableMembers.length, 'members');
    logger.debug('Subject:', subject);
    logger.debug('Message:', message);

    // For now, simulate sending
    return {
      sent: emailableMembers.length,
      failed: 0,
    };
  }
}

export const clubMemberService = new ClubMemberService();
