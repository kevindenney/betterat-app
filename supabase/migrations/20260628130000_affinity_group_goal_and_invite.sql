-- Affinity groups grow a dated goal anchor, informational affiliation tags,
-- and an invite-by-link token — the pieces the "4 Peaks Challenge prep" group
-- design needs so a peer crew can plan toward one event without becoming a
-- club/org (no billing, no admin console, no vetting; invite-only by link).
--
--   goal_at      — the single dated event everything converges on (race day,
--                  exam day, marathon day). NULL until set.
--   goal_label   — persona-native noun for that date ("Race day", "Exam day").
--   affiliations — jsonb array of {icon,label} context chips ("Mostly RHKYC",
--                  "Racing with Aberdeen Boat Club"). Tags only — the group is
--                  owned by NO org and inherits nothing from these.
--   invite_token — opaque slug for a private, unlisted join link.
--
-- affinity_groups has no UPDATE policy and its member roster is gated to
-- members by RLS, so every write/read below routes through a member-gated
-- SECURITY DEFINER RPC, matching the existing attach-plan / add-member pattern.

BEGIN;

ALTER TABLE public.affinity_groups
  ADD COLUMN IF NOT EXISTS goal_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS goal_label TEXT,
  ADD COLUMN IF NOT EXISTS affiliations JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS invite_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_affinity_groups_invite_token
  ON public.affinity_groups (invite_token)
  WHERE invite_token IS NOT NULL;

COMMENT ON COLUMN public.affinity_groups.goal_at IS
  'Single dated event the group converges on (race/exam/marathon day). NULL until set.';
COMMENT ON COLUMN public.affinity_groups.goal_label IS
  'Persona-native label for goal_at (Race day / Exam day / Launch day).';
COMMENT ON COLUMN public.affinity_groups.affiliations IS
  'jsonb array of {icon,label} context chips. Informational only — the group is owned by no org.';
COMMENT ON COLUMN public.affinity_groups.invite_token IS
  'Opaque slug for the private, unlisted invite link. NULL until first link is generated.';

-- True when the caller is an active member of the group. Reused as the gate
-- by every RPC below. SECURITY DEFINER so it can read the roster without
-- tripping the members-read RLS recursion.
CREATE OR REPLACE FUNCTION public.is_affinity_group_member(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.affinity_group_members
    WHERE group_id = p_group_id
      AND user_id = (SELECT auth.uid())
      AND status = 'active'
  );
$$;

-- Member-gated metadata write: set the goal anchor + affiliation tags. Any
-- active member can edit (peer model — no owner/leader gate, matching
-- add_affinity_group_member). NULL args leave a field unchanged so callers
-- can patch goal and affiliations independently.
CREATE OR REPLACE FUNCTION public.set_affinity_group_meta(
  p_group_id UUID,
  p_goal_at TIMESTAMPTZ DEFAULT NULL,
  p_goal_label TEXT DEFAULT NULL,
  p_affiliations JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_affinity_group_member(p_group_id) THEN
    RAISE EXCEPTION 'Only members can edit this group';
  END IF;

  UPDATE public.affinity_groups
  SET goal_at = COALESCE(p_goal_at, goal_at),
      goal_label = COALESCE(p_goal_label, goal_label),
      affiliations = COALESCE(p_affiliations, affiliations),
      updated_at = now()
  WHERE id = p_group_id;
END;
$$;

-- Return the group's invite token, generating one on first call. Idempotent:
-- once a token exists it's stable, so the link a member shared stays valid.
CREATE OR REPLACE FUNCTION public.ensure_affinity_group_invite_token(p_group_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
BEGIN
  IF NOT public.is_affinity_group_member(p_group_id) THEN
    RAISE EXCEPTION 'Only members can create an invite link';
  END IF;

  SELECT invite_token INTO v_token FROM public.affinity_groups WHERE id = p_group_id;
  IF v_token IS NOT NULL THEN
    RETURN v_token;
  END IF;

  -- URL-safe slug from a fresh uuid (32 hex chars) — gen_random_uuid() is core
  -- (already the table default), avoiding a pgcrypto dependency for
  -- gen_random_bytes. Loop on the tiny chance of a collision.
  LOOP
    v_token := replace(gen_random_uuid()::text, '-', '');
    BEGIN
      UPDATE public.affinity_groups SET invite_token = v_token, updated_at = now()
      WHERE id = p_group_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- regenerate
    END;
  END LOOP;

  RETURN v_token;
END;
$$;

-- Join via invite link: resolve the token, add the caller as an active member,
-- return the group id so the route can redirect. Idempotent — a re-click by an
-- existing member is a no-op that still returns the id. This is the ONLY way a
-- non-member gets in (no open-join queue), so the link IS the access control.
CREATE OR REPLACE FUNCTION public.join_affinity_group_by_token(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id UUID;
  v_uid UUID := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to join';
  END IF;

  SELECT id INTO v_group_id
  FROM public.affinity_groups
  WHERE invite_token = p_token AND is_active = true;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'This invite link is invalid or expired';
  END IF;

  INSERT INTO public.affinity_group_members (group_id, user_id, role, status)
  VALUES (v_group_id, v_uid, 'member', 'active')
  ON CONFLICT (group_id, user_id)
  DO UPDATE SET status = 'active', role = 'member';

  RETURN v_group_id;
END;
$$;

-- Member-gated roster with display name + avatar tint for the avatar stack.
-- Mirrors the two-table hydrate pattern (users for name/email, sailor_profiles
-- for the color) but does the join server-side so a member can read peers'
-- names without a broad users-table read grant.
CREATE OR REPLACE FUNCTION public.affinity_group_roster(p_group_id UUID)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  avatar_color TEXT,
  role TEXT,
  joined_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_affinity_group_member(p_group_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    agm.user_id,
    COALESCE(NULLIF(btrim(u.full_name), ''), split_part(u.email, '@', 1)) AS full_name,
    sp.avatar_color,
    agm.role,
    agm.joined_at
  FROM public.affinity_group_members agm
  LEFT JOIN public.users u ON u.id = agm.user_id
  LEFT JOIN public.sailor_profiles sp ON sp.user_id = agm.user_id
  WHERE agm.group_id = p_group_id
    AND agm.status = 'active'
  ORDER BY (agm.role <> 'member'), agm.joined_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_affinity_group_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_affinity_group_meta(UUID, TIMESTAMPTZ, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_affinity_group_invite_token(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_affinity_group_by_token(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.affinity_group_roster(UUID) TO authenticated;

COMMIT;
