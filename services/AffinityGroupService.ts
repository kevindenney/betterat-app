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
  description?: string | null;
  interestSlug?: string | null;
}

// Self-serve groups are a single neutral primitive ("Group"). The kind
// column still exists for legacy institutional groupings (class_fleet /
// cohort), but everything a user creates is one kind so there's no
// meaningless picker — see the A1 collapse decision.
const SELF_SERVE_GROUP_KIND: Extract<AffinityGroupKind, 'practice_group'> = 'practice_group';

export interface CreatedAffinityGroup {
  id: string;
  name: string;
}

export interface AffinityGroupAffiliation {
  /** Ionicons name for the chip's leading glyph (e.g. 'anchor'). */
  icon?: string | null;
  label: string;
}

export interface AffinityGroupRosterEntry {
  userId: string;
  name: string;
  avatarColor: string | null;
  role: 'member' | 'leader' | 'coach';
}

interface RosterRow {
  user_id: string;
  full_name: string | null;
  avatar_color: string | null;
  role: string;
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
        kind: SELF_SERVE_GROUP_KIND,
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
   * Add another person to a self-serve group as an active member. Routes
   * through the `add_affinity_group_member` SECURITY DEFINER RPC because
   * the self-only INSERT policy blocks inserting someone else's row. The
   * caller must already be an active member of the group. Idempotent.
   */
  static async addMember({ groupId, userId }: GroupMembershipArgs): Promise<void> {
    const { error } = await supabase.rpc('add_affinity_group_member', {
      p_group_id: groupId,
      p_user_id: userId,
    });
    if (error) throw error;
  }

  /**
   * Attach a plan (timeline_blueprint) the caller owns to a self-serve group.
   * The `attach_affinity_group_blueprint` RPC publishes the plan (so members
   * can pull its steps) and seeds every existing active member with the
   * anchors + first step. Caller must own the plan and be an active member.
   */
  static async attachBlueprint({
    groupId,
    blueprintId,
  }: {
    groupId: string;
    blueprintId: string;
  }): Promise<void> {
    const { error } = await supabase.rpc('attach_affinity_group_blueprint', {
      p_group_id: groupId,
      p_blueprint_id: blueprintId,
    });
    if (error) throw error;
  }

  /**
   * Seed the viewer from the group's attached plan (subscribe + auto-adopt
   * anchors and the first step). The add-member RPC already seeds people added
   * by others, but a self-join inserts the membership row directly, so this is
   * called after join() to give the self-joiner the same starting steps. No-op
   * when the group has no plan attached.
   */
  static async seedFromBlueprint({ groupId, userId }: GroupMembershipArgs): Promise<void> {
    const { error } = await supabase.rpc('seed_group_member_from_blueprint', {
      p_group_id: groupId,
      p_user_id: userId,
    });
    if (error) throw error;
  }

  /**
   * Member-gated roster with display name + avatar tint for the avatar stack.
   * Routes through the `affinity_group_roster` SECURITY DEFINER RPC because the
   * members-read RLS gates non-members out and a direct users-table join isn't
   * grant-able client-side. Returns [] for non-members.
   */
  static async getRoster(groupId: string): Promise<AffinityGroupRosterEntry[]> {
    const { data, error } = await supabase.rpc('affinity_group_roster', {
      p_group_id: groupId,
    });
    if (error) throw error;
    return ((data as RosterRow[] | null) ?? []).map((r) => ({
      userId: r.user_id,
      name: r.full_name?.trim() || 'Member',
      avatarColor: r.avatar_color,
      role: (r.role as AffinityGroupRosterEntry['role']) ?? 'member',
    }));
  }

  /**
   * Set the dated goal anchor and/or affiliation tags. Any active member can
   * edit (peer model). Undefined fields are left unchanged server-side, so
   * callers can patch the goal and the tags independently.
   */
  static async setMeta({
    groupId,
    goalAt,
    goalLabel,
    affiliations,
    whatsappUrl,
  }: {
    groupId: string;
    goalAt?: string | null;
    goalLabel?: string | null;
    affiliations?: AffinityGroupAffiliation[];
    /** undefined = leave unchanged; '' = clear; a value = set the link. */
    whatsappUrl?: string;
  }): Promise<void> {
    const { error } = await supabase.rpc('set_affinity_group_meta', {
      p_group_id: groupId,
      p_goal_at: goalAt ?? null,
      p_goal_label: goalLabel ?? null,
      p_affiliations: affiliations ?? null,
      p_whatsapp_invite_url: whatsappUrl ?? null,
    });
    if (error) throw error;
  }

  /**
   * Append a step to the group's shared prep plan. Routes through the
   * `add_affinity_group_plan_step` SECURITY DEFINER RPC because the step is
   * owned by the plan's author (so every member can read it via the
   * co-subscriber policy) and a non-author member can't write timeline_steps /
   * blueprint_steps directly. Any active member can add. Returns the new step id.
   */
  static async addPlanStep({
    groupId,
    title,
    description,
  }: {
    groupId: string;
    title: string;
    description?: string | null;
  }): Promise<string> {
    const { data, error } = await supabase.rpc('add_affinity_group_plan_step', {
      p_group_id: groupId,
      p_title: title.trim(),
      p_description: description?.trim() || null,
    });
    if (error) throw error;
    const stepId = typeof data === 'string' ? data : null;
    if (!stepId) throw new Error('Could not add the step.');
    return stepId;
  }

  /**
   * Edit a step on the group's shared prep plan. Routes through the member-gated
   * `update_affinity_group_plan_step` RPC (the step is owned by the blueprint
   * author, so a non-author member can't UPDATE timeline_steps directly). Any
   * active member can edit (peer model).
   */
  static async updatePlanStep({
    groupId,
    stepId,
    title,
    description,
  }: {
    groupId: string;
    stepId: string;
    title: string;
    description?: string | null;
  }): Promise<void> {
    const { error } = await supabase.rpc('update_affinity_group_plan_step', {
      p_group_id: groupId,
      p_step_id: stepId,
      p_title: title.trim(),
      p_description: description?.trim() || null,
    });
    if (error) throw error;
  }

  /**
   * Remove a step from the group's shared prep plan. Routes through the
   * member-gated `remove_affinity_group_plan_step` RPC, which verifies the step
   * belongs to this group's blueprint before deleting the owned step. Any active
   * member can remove (peer model).
   */
  static async removePlanStep({
    groupId,
    stepId,
  }: {
    groupId: string;
    stepId: string;
  }): Promise<void> {
    const { error } = await supabase.rpc('remove_affinity_group_plan_step', {
      p_group_id: groupId,
      p_step_id: stepId,
    });
    if (error) throw error;
  }

  /**
   * Return the group's invite token, generating one on first call. The link is
   * private + unlisted — sharing it IS the access grant (no open-join queue).
   */
  static async ensureInviteToken(groupId: string): Promise<string> {
    const { data, error } = await supabase.rpc('ensure_affinity_group_invite_token', {
      p_group_id: groupId,
    });
    if (error) throw error;
    const token = typeof data === 'string' ? data : null;
    if (!token) throw new Error('Could not create an invite link.');
    return token;
  }

  /**
   * Redeem an invite token: join the caller as an active member and return the
   * group id so the join route can redirect. Idempotent for existing members.
   */
  static async joinByToken(token: string): Promise<string> {
    const { data, error } = await supabase.rpc('join_affinity_group_by_token', {
      p_token: token,
    });
    if (error) throw error;
    const groupId = typeof data === 'string' ? data : null;
    if (!groupId) throw new Error('This invite link is invalid or expired.');
    return groupId;
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
