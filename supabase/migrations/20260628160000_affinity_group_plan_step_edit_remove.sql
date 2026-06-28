-- Let any group member edit or remove a step on the shared prep plan. Mirrors
-- add_affinity_group_plan_step: the step is owned by the blueprint AUTHOR, so a
-- non-author member can't UPDATE/DELETE timeline_steps directly. These
-- member-gated SECURITY DEFINER RPCs do it on their behalf after proving (a) the
-- caller is an active member and (b) the step actually belongs to THIS group's
-- attached blueprint (so a member can't reach another group's steps by id).

BEGIN;

-- Shared guard: returns the group's blueprint id iff the caller is a member and
-- the step is part of that blueprint. RAISEs otherwise. Keeps the two write
-- RPCs from duplicating the same checks.
CREATE OR REPLACE FUNCTION public.assert_affinity_group_plan_step(
  p_group_id UUID,
  p_step_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blueprint_id UUID;
BEGIN
  IF NOT public.is_affinity_group_member(p_group_id) THEN
    RAISE EXCEPTION 'Only members can edit this plan';
  END IF;

  SELECT blueprint_id INTO v_blueprint_id
  FROM public.affinity_groups WHERE id = p_group_id;
  IF v_blueprint_id IS NULL THEN
    RAISE EXCEPTION 'This group has no shared plan yet';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.blueprint_steps
    WHERE blueprint_id = v_blueprint_id AND step_id = p_step_id
  ) THEN
    RAISE EXCEPTION 'That step is not part of this group plan';
  END IF;

  RETURN v_blueprint_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_affinity_group_plan_step(
  p_group_id UUID,
  p_step_id UUID,
  p_title TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT := btrim(coalesce(p_title, ''));
BEGIN
  PERFORM public.assert_affinity_group_plan_step(p_group_id, p_step_id);

  IF char_length(v_title) < 2 THEN
    RAISE EXCEPTION 'Give the step a title of at least 2 characters';
  END IF;

  UPDATE public.timeline_steps
  SET title = v_title,
      description = NULLIF(btrim(coalesce(p_description, '')), ''),
      updated_at = now()
  WHERE id = p_step_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_affinity_group_plan_step(
  p_group_id UUID,
  p_step_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_affinity_group_plan_step(p_group_id, p_step_id);

  -- Drop the membership row first, then the owned step. The blueprint_steps row
  -- would also fall to the FK, but delete it explicitly so order is obvious.
  DELETE FROM public.blueprint_steps WHERE step_id = p_step_id;
  DELETE FROM public.timeline_steps WHERE id = p_step_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assert_affinity_group_plan_step(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_affinity_group_plan_step(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_affinity_group_plan_step(UUID, UUID) TO authenticated;

COMMIT;
