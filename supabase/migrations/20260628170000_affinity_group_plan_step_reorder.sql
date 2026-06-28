-- Let any group member reorder the shared prep plan's steps. Order lives in
-- blueprint_steps.sort_order, owned by the blueprint AUTHOR — so a non-author
-- member can't UPDATE it directly. This member-gated SECURITY DEFINER RPC takes
-- the full ordered list of step ids and rewrites sort_order to match, after
-- proving (a) the caller is an active member and (b) the supplied ids are
-- EXACTLY this group's blueprint step set (no partial scramble, no reaching
-- another blueprint's steps by id). Mirrors add/update/remove plan-step RPCs.

BEGIN;

CREATE OR REPLACE FUNCTION public.reorder_affinity_group_plan_steps(
  p_group_id UUID,
  p_step_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blueprint_id UUID;
  v_total INTEGER;
  v_matched INTEGER;
BEGIN
  IF NOT public.is_affinity_group_member(p_group_id) THEN
    RAISE EXCEPTION 'Only members can reorder this plan';
  END IF;

  SELECT blueprint_id INTO v_blueprint_id
  FROM public.affinity_groups WHERE id = p_group_id;
  IF v_blueprint_id IS NULL THEN
    RAISE EXCEPTION 'This group has no shared plan yet';
  END IF;

  -- The supplied list must be the blueprint's exact step set: same count, and
  -- every id belongs to this blueprint. Otherwise a caller could drop steps from
  -- the ordering or splice in a foreign step id.
  SELECT COUNT(*) INTO v_total
  FROM public.blueprint_steps WHERE blueprint_id = v_blueprint_id;

  SELECT COUNT(*) INTO v_matched
  FROM public.blueprint_steps
  WHERE blueprint_id = v_blueprint_id
    AND step_id = ANY(p_step_ids);

  IF array_length(p_step_ids, 1) IS DISTINCT FROM v_total
     OR v_matched IS DISTINCT FROM v_total THEN
    RAISE EXCEPTION 'Reorder must list exactly this group plan''s steps';
  END IF;

  UPDATE public.blueprint_steps AS bs
  SET sort_order = ordered.ord
  FROM (
    SELECT unnest(p_step_ids) AS step_id,
           generate_subscripts(p_step_ids, 1) AS ord
  ) AS ordered
  WHERE bs.blueprint_id = v_blueprint_id
    AND bs.step_id = ordered.step_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reorder_affinity_group_plan_steps(UUID, UUID[]) TO authenticated;

COMMIT;
