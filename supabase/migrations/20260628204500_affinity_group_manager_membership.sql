-- Give self-serve affinity groups an owner/manager concept and member
-- management operations. `leader` is the existing role that maps to "owns or
-- manages this peer group"; we avoid adding a fourth role value.

ALTER TABLE public.affinity_groups
  ADD COLUMN IF NOT EXISTS created_by UUID;

-- Existing self-serve groups did not store a creator. Prefer the attached
-- blueprint owner where available, because attaching a plan is a strong signal
-- that this person is running the group. Fall back to the earliest active
-- member so old groups are still manageable.
UPDATE public.affinity_groups ag
SET created_by = tb.user_id,
    updated_at = now()
FROM public.timeline_blueprints tb
WHERE ag.blueprint_id = tb.id
  AND ag.created_by IS NULL
  AND ag.kind IN ('crew_pod', 'practice_group')
  AND ag.is_active = true;

WITH first_member AS (
  SELECT DISTINCT ON (agm.group_id)
    agm.group_id,
    agm.user_id
  FROM public.affinity_group_members agm
  JOIN public.affinity_groups ag ON ag.id = agm.group_id
  WHERE ag.created_by IS NULL
    AND ag.kind IN ('crew_pod', 'practice_group')
    AND ag.is_active = true
    AND agm.status = 'active'
  ORDER BY agm.group_id, agm.joined_at ASC
)
UPDATE public.affinity_groups ag
SET created_by = fm.user_id,
    updated_at = now()
FROM first_member fm
WHERE ag.id = fm.group_id
  AND ag.created_by IS NULL;

UPDATE public.affinity_group_members agm
SET role = 'leader'
FROM public.affinity_groups ag
WHERE ag.id = agm.group_id
  AND ag.kind IN ('crew_pod', 'practice_group')
  AND ag.created_by = agm.user_id
  AND agm.status = 'active'
  AND agm.role = 'member';

CREATE OR REPLACE FUNCTION public.is_affinity_group_manager(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.affinity_group_members agm
    JOIN public.affinity_groups ag ON ag.id = agm.group_id
    WHERE agm.group_id = p_group_id
      AND agm.user_id = auth.uid()
      AND agm.status = 'active'
      AND ag.is_active = true
      AND ag.kind IN ('crew_pod', 'practice_group')
      AND (
        agm.role IN ('leader', 'coach')
        OR ag.created_by = auth.uid()
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.add_affinity_group_member(
  p_group_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind TEXT;
BEGIN
  SELECT kind INTO v_kind
  FROM public.affinity_groups
  WHERE id = p_group_id AND is_active = true;

  IF v_kind IS NULL THEN
    RAISE EXCEPTION 'group not found';
  END IF;

  IF v_kind NOT IN ('crew_pod', 'practice_group') THEN
    RAISE EXCEPTION 'this group does not support adding members here';
  END IF;

  IF NOT public.is_affinity_group_manager(p_group_id) THEN
    RAISE EXCEPTION 'only group leaders can add people';
  END IF;

  INSERT INTO public.affinity_group_members (group_id, user_id, role, status)
  VALUES (p_group_id, p_user_id, 'member', 'active')
  ON CONFLICT (group_id, user_id)
  DO UPDATE SET status = 'active',
                role = COALESCE(public.affinity_group_members.role, 'member');

  PERFORM public.seed_group_member_from_blueprint(p_group_id, p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.manage_affinity_group_member(
  p_group_id UUID,
  p_user_id UUID,
  p_action TEXT,
  p_role TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT := lower(trim(COALESCE(p_action, '')));
  v_role TEXT := lower(trim(COALESCE(p_role, '')));
  v_target_role TEXT;
  v_remaining_managers INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NOT public.is_affinity_group_manager(p_group_id) THEN
    RAISE EXCEPTION 'only group leaders can manage members';
  END IF;

  SELECT role INTO v_target_role
  FROM public.affinity_group_members
  WHERE group_id = p_group_id
    AND user_id = p_user_id
    AND status = 'active';

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'member not found';
  END IF;

  SELECT COUNT(*) INTO v_remaining_managers
  FROM public.affinity_group_members agm
  JOIN public.affinity_groups ag ON ag.id = agm.group_id
  WHERE agm.group_id = p_group_id
    AND agm.user_id <> p_user_id
    AND agm.status = 'active'
    AND (
      agm.role IN ('leader', 'coach')
      OR ag.created_by = agm.user_id
    );

  IF v_action = 'remove' THEN
    IF p_user_id = auth.uid() THEN
      RAISE EXCEPTION 'use Leave or Delete group for yourself';
    END IF;

    IF v_target_role IN ('leader', 'coach') AND v_remaining_managers = 0 THEN
      RAISE EXCEPTION 'make another member a leader before removing the last leader';
    END IF;

    UPDATE public.affinity_group_members
    SET status = 'inactive'
    WHERE group_id = p_group_id
      AND user_id = p_user_id;
    RETURN;
  END IF;

  IF v_action = 'set_role' THEN
    IF v_role NOT IN ('member', 'leader', 'coach') THEN
      RAISE EXCEPTION 'unsupported member role';
    END IF;

    IF v_target_role IN ('leader', 'coach')
      AND v_role = 'member'
      AND v_remaining_managers = 0 THEN
      RAISE EXCEPTION 'make another member a leader before demoting the last leader';
    END IF;

    UPDATE public.affinity_group_members
    SET role = v_role
    WHERE group_id = p_group_id
      AND user_id = p_user_id;
    RETURN;
  END IF;

  RAISE EXCEPTION 'unsupported member action';
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_self_serve_affinity_group(p_group_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind TEXT;
BEGIN
  IF NOT public.is_affinity_group_manager(p_group_id) THEN
    RAISE EXCEPTION 'only group leaders can delete this group';
  END IF;

  SELECT kind INTO v_kind
  FROM public.affinity_groups
  WHERE id = p_group_id AND is_active = true;

  IF v_kind IS NULL THEN
    RAISE EXCEPTION 'group not found';
  END IF;

  IF v_kind NOT IN ('crew_pod', 'practice_group') THEN
    RAISE EXCEPTION 'only self-serve groups can be deleted here';
  END IF;

  UPDATE public.affinity_groups
  SET is_active = false,
      invite_token = NULL,
      updated_at = now()
  WHERE id = p_group_id;

  UPDATE public.affinity_group_members
  SET status = 'inactive'
  WHERE group_id = p_group_id
    AND status = 'active';
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_affinity_group_manager(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_affinity_group_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manage_affinity_group_member(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_self_serve_affinity_group(UUID) TO authenticated;

COMMENT ON COLUMN public.affinity_groups.created_by IS
  'Creator/owner for self-serve affinity groups. Existing rows are backfilled from attached blueprint owner or first active member.';
COMMENT ON FUNCTION public.is_affinity_group_manager(UUID) IS
  'True when the caller is an active leader/coach or recorded creator of a self-serve affinity group.';
COMMENT ON FUNCTION public.manage_affinity_group_member(UUID, UUID, TEXT, TEXT) IS
  'Leader-only self-serve affinity group member management: remove members or set role.';
