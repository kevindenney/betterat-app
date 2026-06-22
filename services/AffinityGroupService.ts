import { supabase } from '@/services/supabase';
import type { AffinityGroupKind } from '@/hooks/useUserAffinityGroups';

/**
 * Self-serve join/leave for affinity groups (class-fleets, cohorts,
 * crew pods, practice groups).
 *
 * Groups are open-join: a viewer adds their own `active` `member` row and
 * is immediately in. There is no request/approve flow today (no
 * join-policy column, no admin roster UI) — the RLS policies in
 * `20260617200000_affinity_group_members_self_join_leave.sql` permit only
 * self, only role='member', only status='active'. Leader/coach roster
 * control of others stays a separate (future) admin policy.
 *
 * The (group_id, user_id) primary key means a re-join after a soft
 * 'inactive' must be an UPDATE, not a fresh INSERT — leave() hard-deletes
 * the row, so the common re-join path is a clean INSERT, but we still
 * handle a pre-existing row defensively.
 */

interface GroupMembershipArgs {
  groupId: string;
  userId: string;
}

export interface CreateSelfServeGroupArgs {
  name: string;
  kind: Extract<AffinityGroupKind, 'crew_pod' | 'practice_group'>;
  description?: string | null;
  interestSlug?: string | null;
}

export interface CreatedAffinityGroup {
  id: string;
  name: string;
}

function isUniqueViolation(error: unknown): boolean {
  // PostgrestError is a plain object, not an Error instance — read code
  // directly. 23505 = unique_violation (membership row already exists).
  return Boolean(error) && (error as { code?: string }).code === '23505';
}

export class AffinityGroupService {
  /**
   * Create a peer-run group and join the creator immediately. Official
   * institutional cohorts still live in betterat_org_cohorts and are created
   * by org admins; this is only for lightweight study/practice groups.
   */
  static async createSelfServeGroup({
    name,
    kind,
    description,
    interestSlug,
  }: CreateSelfServeGroupArgs): Promise<CreatedAffinityGroup> {
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      throw new Error('Give the group a name of at least 2 characters.');
    }

    const { data, error } = await supabase.functions.invoke('create-affinity-group', {
      body: {
        name: trimmedName,
        kind,
        description: description?.trim() || null,
        interestSlug: interestSlug || null,
      },
    });

    if (error) throw error;
    if (data?.error) throw new Error(String(data.error));
    if (!data?.id) throw new Error('Could not create group.');

    return { id: data.id, name: data.name };
  }

  /**
   * Join a group as an active member. Idempotent: an existing active row
   * is a no-op; a soft-inactive row is reactivated via UPDATE.
   */
  static async join({ groupId, userId }: GroupMembershipArgs): Promise<void> {
    const { data: existing } = await supabase
      .from('affinity_group_members')
      .select('status')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      const current = (existing as { status?: string }).status ?? 'active';
      if (current === 'active') return;
      const { error } = await supabase
        .from('affinity_group_members')
        .update({ status: 'active', role: 'member' })
        .eq('group_id', groupId)
        .eq('user_id', userId);
      if (error) throw error;
      return;
    }

    const { error } = await supabase.from('affinity_group_members').insert({
      group_id: groupId,
      user_id: userId,
      role: 'member',
      status: 'active',
    });
    if (error) {
      // Lost a race — the row appeared between our read and insert.
      if (isUniqueViolation(error)) return;
      throw error;
    }
  }

  /**
   * Leave a group: delete the viewer's own membership row. The DELETE RLS
   * policy restricts this to `user_id = auth.uid()`. We `.select()` so we
   * can tell a real removal apart from a no-op (already gone, or blocked
   * by RLS — both return no error but zero rows) and surface a clear
   * failure rather than a false success.
   */
  static async leave({ groupId, userId }: GroupMembershipArgs): Promise<void> {
    const { data, error } = await supabase
      .from('affinity_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .select('user_id');
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error('You are no longer a member of this group.');
    }
  }
}
