import { supabase } from '@/services/supabase';
import type { OrgJoinMode } from '@/services/YachtClubClaimService';
import { resolveOrgMembershipStatus } from '@/hooks/orgMembershipStatus';

/**
 * Self-serve organization join, branched by the org's `join_mode`.
 *
 *   open_join        → insert an active membership; the viewer is in.
 *   request_to_join  → insert (or re-request) a pending membership;
 *                      an admin approves it later.
 *   invite_only      → not self-serve; callers should not invoke join.
 *
 * The RLS policies that permit these writes live in
 * `20260308072808_org_join_modes_learn_search.sql` (open_join active
 * insert, request_to_join pending insert) and
 * `20260308144000_org_memberships_rerequest_policy.sql` (rejected →
 * pending re-request). `membership_status` only accepts
 * pending|active|rejected, so we never write `inactive`.
 */

export type JoinResult = 'active' | 'pending';

interface JoinArgs {
  orgId: string;
  userId: string;
  joinMode: OrgJoinMode;
}

function isUniqueViolation(error: unknown): boolean {
  // PostgrestError is a plain object, not an Error instance — read code
  // directly. 23505 = unique_violation (membership row already exists).
  return Boolean(error) && (error as { code?: string }).code === '23505';
}

function joinResultFromStatus(status?: string): JoinResult | null {
  if (status === 'active') return 'active';
  if (status === 'pending') return 'pending';
  return null;
}

export class OrgJoinService {
  static async join({ orgId, userId, joinMode }: JoinArgs): Promise<JoinResult> {
    if (joinMode === 'invite_only') {
      throw new Error('This organization is invite-only.');
    }

    const targetStatus: JoinResult = joinMode === 'open_join' ? 'active' : 'pending';

    // A previously rejected request must be re-opened via UPDATE (the
    // re-request RLS policy), not a fresh INSERT — the unique
    // (organization_id, user_id) row already exists.
    const { data: existing } = await supabase
      .from('organization_memberships')
      .select('id, membership_status, status')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      const row = existing as { membership_status?: string; status?: string };
      const current = resolveOrgMembershipStatus(row);
      if (current === 'active' || current === targetStatus) {
        return current === 'active' ? 'active' : targetStatus;
      }
      const { data: updated, error } = await supabase
        .from('organization_memberships')
        .update({ status: targetStatus, membership_status: targetStatus })
        .eq('organization_id', orgId)
        .eq('user_id', userId)
        .select('status,membership_status')
        .maybeSingle();
      if (error) throw error;
      if (!updated) {
        throw new Error('Could not update your organization membership.');
      }
      return targetStatus;
    }

    const { error } = await supabase.from('organization_memberships').insert({
      organization_id: orgId,
      user_id: userId,
      role: 'member',
      status: targetStatus,
      membership_status: targetStatus,
    });
    if (error) {
      // Lost a race — the row appeared between our read and insert.
      // Re-read and return the actual membership state.
      if (isUniqueViolation(error)) {
        const { data: raced, error: racedError } = await supabase
          .from('organization_memberships')
          .select('status,membership_status')
          .eq('organization_id', orgId)
          .eq('user_id', userId)
          .maybeSingle();
        if (racedError) throw racedError;
        const racedStatus = joinResultFromStatus(
          resolveOrgMembershipStatus((raced as { membership_status?: string; status?: string } | null) ?? {}),
        );
        if (racedStatus) return racedStatus;
        throw new Error('Could not confirm your organization membership.');
      }
      throw error;
    }
    return targetStatus;
  }

  /**
   * Self-serve "leave organization": delete the viewer's own membership
   * row. The DELETE RLS policy (organization_memberships_delete_own_v1)
   * restricts this to `user_id = auth.uid()`. We `.select()` so we can
   * tell an actual removal apart from a no-op (already gone, or blocked
   * by RLS — both return no error but zero rows) and surface a clear
   * failure rather than a false success.
   *
   * Sole-owner orphan protection lives in the UI (the Leave control is
   * hidden for owners); this method is role-agnostic.
   */
  static async leave({ orgId, userId }: { orgId: string; userId: string }): Promise<void> {
    const { data, error } = await supabase
      .from('organization_memberships')
      .delete()
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .select('user_id');
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error('You are no longer a member of this organization.');
    }
  }
}
