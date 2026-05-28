-- invite_fleet_member: lets fleet owners/captains create an
-- "invited" fleet_members row for another user. fleet_members RLS
-- otherwise restricts INSERT to the caller's own user_id (so users
-- can only join themselves) — invites need a SECURITY DEFINER bypass.
--
-- Invitee accepts by updating their own row status='invited' →
-- 'active' (the existing self-update policy already permits this);
-- declines by deleting their own row (existing self-delete policy).
--
-- Applied to dev project via Supabase MCP.

CREATE OR REPLACE FUNCTION public.invite_fleet_member(
  p_fleet_id uuid,
  p_user_id  uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller   uuid := auth.uid();
  v_existing uuid;
  v_new_id   uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  -- Caller must be an active owner/captain of the fleet.
  IF NOT EXISTS (
    SELECT 1
    FROM fleet_members fm
    WHERE fm.fleet_id = p_fleet_id
      AND fm.user_id  = v_caller
      AND fm.status   = 'active'
      AND fm.role IN ('owner', 'captain')
  ) THEN
    RAISE EXCEPTION 'only fleet owners or captains can invite members';
  END IF;

  -- Already a member (any status) — return their row id, don't
  -- double-insert. The caller can interpret as "no-op, already
  -- known" without a separate idempotency check.
  SELECT id INTO v_existing
  FROM fleet_members
  WHERE fleet_id = p_fleet_id
    AND user_id  = p_user_id
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  INSERT INTO fleet_members (fleet_id, user_id, role, status, invited_by)
  VALUES (p_fleet_id, p_user_id, 'member', 'invited', v_caller)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_fleet_member(uuid, uuid) TO authenticated;
