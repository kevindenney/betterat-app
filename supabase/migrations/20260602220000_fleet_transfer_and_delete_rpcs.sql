-- Owner-only fleet lifecycle: hand the fleet to another member, or delete it.
--
-- Both need to act beyond the caller's own fleet_members row (transfer
-- rewrites two roles + fleets.created_by; delete drops rows the caller
-- doesn't own), so they're SECURITY DEFINER with explicit owner gating —
-- mirrors set_fleet_member_role / remove_fleet_member.
--
-- created_by gates fleets UPDATE + private-fleet SELECT (see RLS), so a
-- transfer MUST reassign it or the new owner can't edit/view a private
-- fleet and the old owner keeps those rights. fleets has no DELETE policy
-- at all, so delete can only happen through this function.
--
-- All fleets children are ON DELETE CASCADE or SET NULL, so deleting the
-- fleets row cleans up fleet_members/invites/posts/activity/etc. and
-- unlinks blueprints/races without orphaning them.
--
-- Applied to dev project via Supabase MCP.

-- ==========================================
-- transfer_fleet_ownership — owner hands the fleet to an active member
-- ==========================================
CREATE OR REPLACE FUNCTION public.transfer_fleet_ownership(
  p_fleet_id     uuid,
  p_new_owner_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller       uuid := auth.uid();
  v_target_status text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF p_new_owner_id = v_caller THEN
    RAISE EXCEPTION 'you already own this fleet';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM fleet_members fm
    WHERE fm.fleet_id = p_fleet_id
      AND fm.user_id = v_caller
      AND fm.status = 'active'
      AND fm.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'only the fleet owner can transfer ownership';
  END IF;

  SELECT fm.status INTO v_target_status
  FROM fleet_members fm
  WHERE fm.fleet_id = p_fleet_id AND fm.user_id = p_new_owner_id;

  IF v_target_status IS NULL THEN
    RAISE EXCEPTION 'new owner must be a member of this fleet';
  END IF;

  IF v_target_status <> 'active' THEN
    RAISE EXCEPTION 'new owner must be an active member (not a pending invite)';
  END IF;

  -- Promote target, step caller down to captain (keeps admin rights).
  UPDATE fleet_members fm SET role = 'owner'
  WHERE fm.fleet_id = p_fleet_id AND fm.user_id = p_new_owner_id;

  UPDATE fleet_members fm SET role = 'captain'
  WHERE fm.fleet_id = p_fleet_id AND fm.user_id = v_caller;

  -- created_by is the RLS authority for edit + private read.
  UPDATE fleets SET created_by = p_new_owner_id WHERE id = p_fleet_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_fleet_ownership(uuid, uuid) TO authenticated;

-- ==========================================
-- delete_fleet — owner permanently deletes the fleet (cascades children)
-- ==========================================
CREATE OR REPLACE FUNCTION public.delete_fleet(p_fleet_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM fleet_members fm
    WHERE fm.fleet_id = p_fleet_id
      AND fm.user_id = v_caller
      AND fm.status = 'active'
      AND fm.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'only the fleet owner can delete this fleet';
  END IF;

  DELETE FROM fleets WHERE id = p_fleet_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_fleet(uuid) TO authenticated;
