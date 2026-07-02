-- add_affinity_group_member: lets a member of a self-serve peer group add
-- another person directly as an active member. affinity_group_members RLS
-- otherwise restricts INSERT to the caller's own row (self-join only — see
-- 20260617200000), so bringing someone else in needs a SECURITY DEFINER
-- bypass.
--
-- Peer model (matches the "I want to work this plan through with 5 people"
-- ask): any active member can bring someone in, like adding to a group
-- chat. There is no owner/leader gate because self-serve groups have no
-- created_by column and the creator joins as a plain 'member'.
--
-- Scope is limited to self-serve kinds (crew_pod / practice_group).
-- Official institutional groupings (class_fleet / cohort) stay
-- roster-managed by org admins on the Studio surfaces.
--
-- Idempotent: re-adding an existing member (or reactivating a soft-left
-- one) is a no-op upsert, so the caller can add the same set twice safely.

CREATE OR REPLACE FUNCTION public.add_affinity_group_member(
  p_group_id uuid,
  p_user_id  uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_kind   text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT kind INTO v_kind
  FROM affinity_groups
  WHERE id = p_group_id AND is_active = true;

  IF v_kind IS NULL THEN
    RAISE EXCEPTION 'group not found';
  END IF;

  IF v_kind NOT IN ('crew_pod', 'practice_group') THEN
    RAISE EXCEPTION 'this group does not support adding members here';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM affinity_group_members
    WHERE group_id = p_group_id
      AND user_id  = v_caller
      AND status   = 'active'
  ) THEN
    RAISE EXCEPTION 'only members can add people to this group';
  END IF;

  INSERT INTO affinity_group_members (group_id, user_id, role, status)
  VALUES (p_group_id, p_user_id, 'member', 'active')
  ON CONFLICT (group_id, user_id)
  DO UPDATE SET status = 'active';
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_affinity_group_member(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.add_affinity_group_member IS
  'Active member of a self-serve peer group adds another user as an active member. SECURITY DEFINER bypass over the self-only INSERT policy. Self-serve kinds only.';
