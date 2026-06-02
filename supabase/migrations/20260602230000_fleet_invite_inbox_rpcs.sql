-- Surface fleet invites in the invitee's Inbox + let them accept/decline.
--
-- invite_fleet_member_by_email inserts a fleet_members row with
-- status='invited' for an existing account, but nothing surfaced it to the
-- invitee — they had no way to see or act on it. These RPCs back an Act-panel
-- "Fleet invites" group.
--
-- SECURITY DEFINER because the invitee needs the fleet NAME, and fleets SELECT
-- RLS is creator/public-only — a private fleet they were invited to would read
-- back as NULL under the invoker. The reads/writes are still scoped to the
-- caller's own (status='invited') rows, so this grants nothing beyond "see and
-- answer invites addressed to me".
--
-- Applied to dev project via Supabase MCP.

-- ==========================================
-- get_my_fleet_invites — pending invites addressed to the caller
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_my_fleet_invites()
RETURNS TABLE (
  membership_id uuid,
  invite_fleet_id uuid,
  fleet_name    text,
  member_role   text,
  inviter_id    uuid,
  inviter_name  text,
  invited_at    timestamptz
)
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

  RETURN QUERY
  SELECT
    fm.id AS membership_id,
    fm.fleet_id AS invite_fleet_id,
    f.name::text AS fleet_name,
    fm.role AS member_role,
    fm.invited_by AS inviter_id,
    COALESCE(
      NULLIF(TRIM(p.full_name), ''),
      NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
      au.email::text
    ) AS inviter_name,
    fm.joined_at AS invited_at
  FROM fleet_members fm
  JOIN fleets f ON f.id = fm.fleet_id
  LEFT JOIN profiles p ON p.id = fm.invited_by
  LEFT JOIN auth.users au ON au.id = fm.invited_by
  WHERE fm.user_id = v_caller AND fm.status = 'invited'
  ORDER BY fm.joined_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_fleet_invites() TO authenticated;

-- ==========================================
-- accept_fleet_invite — caller activates their own invited membership
-- ==========================================
CREATE OR REPLACE FUNCTION public.accept_fleet_invite(p_fleet_id uuid)
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

  UPDATE fleet_members
  SET status = 'active'
  WHERE fleet_id = p_fleet_id AND user_id = v_caller AND status = 'invited';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no pending invite for this fleet';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_fleet_invite(uuid) TO authenticated;

-- ==========================================
-- decline_fleet_invite — caller removes their own invited membership
-- ==========================================
CREATE OR REPLACE FUNCTION public.decline_fleet_invite(p_fleet_id uuid)
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

  DELETE FROM fleet_members
  WHERE fleet_id = p_fleet_id AND user_id = v_caller AND status = 'invited';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no pending invite for this fleet';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decline_fleet_invite(uuid) TO authenticated;
