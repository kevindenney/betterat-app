-- Fleet management: roster read, role changes, member removal, and
-- email-based invites for people not yet on BetterAt.
--
-- All of these need to read/write fleet_members rows that don't belong
-- to the caller, so they're SECURITY DEFINER with explicit owner/captain
-- gating (fleet_members RLS otherwise restricts writes to the caller's
-- own row). Mirrors the existing invite_fleet_member RPC.
--
-- Applied to dev project via Supabase MCP.

-- ==========================================
-- fleet_invites — pending invites by email (no account yet)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.fleet_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_id    uuid NOT NULL REFERENCES public.fleets(id) ON DELETE CASCADE,
  email       text NOT NULL,
  role        text NOT NULL DEFAULT 'member'
                CHECK (role IN ('member', 'captain', 'coach', 'support')),
  invited_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status      text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'revoked')),
  token       uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE (fleet_id, email)
);

CREATE INDEX IF NOT EXISTS idx_fleet_invites_fleet_id ON public.fleet_invites(fleet_id);
CREATE INDEX IF NOT EXISTS idx_fleet_invites_email ON public.fleet_invites(lower(email));

ALTER TABLE public.fleet_invites ENABLE ROW LEVEL SECURITY;

-- Owners/captains can read their fleet's pending invites. Writes go
-- exclusively through the SECURITY DEFINER functions below.
DROP POLICY IF EXISTS "Fleet leaders can view invites" ON public.fleet_invites;
CREATE POLICY "Fleet leaders can view invites"
  ON public.fleet_invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.fleet_members fm
      WHERE fm.fleet_id = fleet_invites.fleet_id
        AND fm.user_id = (SELECT auth.uid())
        AND fm.status = 'active'
        AND fm.role IN ('owner', 'captain')
    )
  );

-- ==========================================
-- get_fleet_roster — members + pending email invites, hydrated
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_fleet_roster(p_fleet_id uuid)
RETURNS TABLE (
  row_id          uuid,
  member_user_id  uuid,
  member_email    text,
  display_name    text,
  avatar_url      text,
  member_role     text,
  member_status   text,
  joined_at       timestamptz,
  invited_by      uuid,
  is_email_invite boolean
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

  IF NOT EXISTS (
    SELECT 1 FROM fleet_members fm
    WHERE fm.fleet_id = p_fleet_id AND fm.user_id = v_caller
  ) THEN
    RAISE EXCEPTION 'not a member of this fleet';
  END IF;

  RETURN QUERY
  SELECT
    fm.id AS row_id,
    fm.user_id AS member_user_id,
    au.email::text AS member_email,
    COALESCE(
      NULLIF(TRIM(p.full_name), ''),
      NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
      au.email::text
    ) AS display_name,
    p.avatar_url AS avatar_url,
    fm.role AS member_role,
    fm.status AS member_status,
    fm.joined_at AS joined_at,
    fm.invited_by AS invited_by,
    false AS is_email_invite
  FROM fleet_members fm
  LEFT JOIN profiles p ON p.id = fm.user_id
  LEFT JOIN auth.users au ON au.id = fm.user_id
  WHERE fm.fleet_id = p_fleet_id

  UNION ALL

  SELECT
    fi.id AS row_id,
    NULL::uuid AS member_user_id,
    fi.email AS member_email,
    fi.email AS display_name,
    NULL::text AS avatar_url,
    fi.role AS member_role,
    'pending'::text AS member_status,
    fi.created_at AS joined_at,
    fi.invited_by AS invited_by,
    true AS is_email_invite
  FROM fleet_invites fi
  WHERE fi.fleet_id = p_fleet_id AND fi.status = 'pending'

  ORDER BY 7 ASC, 8 DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_fleet_roster(uuid) TO authenticated;

-- ==========================================
-- set_fleet_member_role — owner-only promote/demote
-- ==========================================
CREATE OR REPLACE FUNCTION public.set_fleet_member_role(
  p_fleet_id uuid,
  p_user_id  uuid,
  p_role     text
)
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

  IF p_role NOT IN ('member', 'captain', 'coach', 'support', 'owner') THEN
    RAISE EXCEPTION 'invalid role: %', p_role;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM fleet_members fm
    WHERE fm.fleet_id = p_fleet_id
      AND fm.user_id = v_caller
      AND fm.status = 'active'
      AND fm.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'only the fleet owner can change roles';
  END IF;

  -- Don't let the sole owner demote themselves into a leaderless fleet.
  IF p_user_id = v_caller AND p_role <> 'owner' THEN
    IF (
      SELECT count(*) FROM fleet_members fm
      WHERE fm.fleet_id = p_fleet_id AND fm.role = 'owner' AND fm.status = 'active'
    ) <= 1 THEN
      RAISE EXCEPTION 'cannot remove the last owner';
    END IF;
  END IF;

  UPDATE fleet_members fm
  SET role = p_role
  WHERE fm.fleet_id = p_fleet_id AND fm.user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'member not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_fleet_member_role(uuid, uuid, text) TO authenticated;

-- ==========================================
-- remove_fleet_member — owner/captain removes a member
-- ==========================================
CREATE OR REPLACE FUNCTION public.remove_fleet_member(
  p_fleet_id uuid,
  p_user_id  uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller      uuid := auth.uid();
  v_caller_role text;
  v_target_role text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT fm.role INTO v_caller_role
  FROM fleet_members fm
  WHERE fm.fleet_id = p_fleet_id AND fm.user_id = v_caller AND fm.status = 'active';

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'captain') THEN
    RAISE EXCEPTION 'only fleet owners or captains can remove members';
  END IF;

  SELECT fm.role INTO v_target_role
  FROM fleet_members fm
  WHERE fm.fleet_id = p_fleet_id AND fm.user_id = p_user_id;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'member not found';
  END IF;

  -- Only an owner can remove another owner.
  IF v_target_role = 'owner' AND v_caller_role <> 'owner' THEN
    RAISE EXCEPTION 'only an owner can remove an owner';
  END IF;

  -- Never strip the last active owner.
  IF v_target_role = 'owner' AND (
    SELECT count(*) FROM fleet_members fm
    WHERE fm.fleet_id = p_fleet_id AND fm.role = 'owner' AND fm.status = 'active'
  ) <= 1 THEN
    RAISE EXCEPTION 'cannot remove the last owner';
  END IF;

  DELETE FROM fleet_members fm
  WHERE fm.fleet_id = p_fleet_id AND fm.user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_fleet_member(uuid, uuid) TO authenticated;

-- ==========================================
-- invite_fleet_member_by_email — invite by email, role-aware
-- ==========================================
CREATE OR REPLACE FUNCTION public.invite_fleet_member_by_email(
  p_fleet_id uuid,
  p_email    text,
  p_role     text DEFAULT 'member'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_email  text := lower(trim(p_email));
  v_user   uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF p_role NOT IN ('member', 'captain', 'coach', 'support') THEN
    RAISE EXCEPTION 'invalid role: %', p_role;
  END IF;

  IF v_email = '' OR v_email IS NULL THEN
    RAISE EXCEPTION 'email required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM fleet_members fm
    WHERE fm.fleet_id = p_fleet_id
      AND fm.user_id = v_caller
      AND fm.status = 'active'
      AND fm.role IN ('owner', 'captain')
  ) THEN
    RAISE EXCEPTION 'only fleet owners or captains can invite members';
  END IF;

  SELECT au.id INTO v_user
  FROM auth.users au
  WHERE lower(au.email) = v_email
  LIMIT 1;

  IF v_user IS NOT NULL THEN
    -- Existing account → create an invited membership directly.
    IF EXISTS (
      SELECT 1 FROM fleet_members fm
      WHERE fm.fleet_id = p_fleet_id AND fm.user_id = v_user
    ) THEN
      RETURN 'already_member';
    END IF;

    INSERT INTO fleet_members (fleet_id, user_id, role, status, invited_by)
    VALUES (p_fleet_id, v_user, p_role, 'invited', v_caller);
    RETURN 'invited_user';
  END IF;

  -- No account yet → pending email invite, claimed on signup.
  INSERT INTO fleet_invites (fleet_id, email, role, invited_by, status)
  VALUES (p_fleet_id, v_email, p_role, v_caller, 'pending')
  ON CONFLICT (fleet_id, email)
  DO UPDATE SET role = EXCLUDED.role, status = 'pending', invited_by = EXCLUDED.invited_by;

  RETURN 'invited_email';
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_fleet_member_by_email(uuid, text, text) TO authenticated;

-- ==========================================
-- claim_fleet_invites — convert pending email invites on signup/sign-in
-- ==========================================
CREATE OR REPLACE FUNCTION public.claim_fleet_invites()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_email  text;
  v_count  integer := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT lower(au.email) INTO v_email FROM auth.users au WHERE au.id = v_caller;
  IF v_email IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO fleet_members (fleet_id, user_id, role, status, invited_by)
  SELECT fi.fleet_id, v_caller, fi.role, 'invited', fi.invited_by
  FROM fleet_invites fi
  WHERE lower(fi.email) = v_email AND fi.status = 'pending'
  ON CONFLICT (fleet_id, user_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE fleet_invites fi
  SET status = 'accepted', accepted_at = now()
  WHERE lower(fi.email) = v_email AND fi.status = 'pending';

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_fleet_invites() TO authenticated;

-- ==========================================
-- revoke_fleet_invite — owner/captain cancels a pending email invite
-- ==========================================
CREATE OR REPLACE FUNCTION public.revoke_fleet_invite(p_invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller   uuid := auth.uid();
  v_fleet_id uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT fi.fleet_id INTO v_fleet_id FROM fleet_invites fi WHERE fi.id = p_invite_id;
  IF v_fleet_id IS NULL THEN
    RAISE EXCEPTION 'invite not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM fleet_members fm
    WHERE fm.fleet_id = v_fleet_id
      AND fm.user_id = v_caller
      AND fm.status = 'active'
      AND fm.role IN ('owner', 'captain')
  ) THEN
    RAISE EXCEPTION 'only fleet owners or captains can revoke invites';
  END IF;

  UPDATE fleet_invites fi SET status = 'revoked' WHERE fi.id = p_invite_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_fleet_invite(uuid) TO authenticated;
