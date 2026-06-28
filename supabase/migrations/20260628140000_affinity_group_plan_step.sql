-- Let any group member append a step to the group's shared prep plan.
--
-- The shared plan is an attached timeline_blueprint owned by ONE author; its
-- curated steps live in blueprint_steps → timeline_steps. A non-author member
-- can't INSERT timeline_steps/blueprint_steps directly (RLS owns those to the
-- blueprint author), so appending routes through this member-gated SECURITY
-- DEFINER RPC, matching the Phase 1 attach-plan / set-meta pattern.
--
-- The new step is owned by the blueprint AUTHOR (not the calling member) so the
-- "Blueprint co-subscribers can view peer steps" RLS policy lets every member
-- read it — the same reason useGroupPlanSteps reads the author's canonical
-- steps rather than per-member copies. visibility='crew' keeps it out of the
-- author's private lane while staying co-subscriber-readable.

BEGIN;

CREATE OR REPLACE FUNCTION public.add_affinity_group_plan_step(
  p_group_id UUID,
  p_title TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT := btrim(coalesce(p_title, ''));
  v_blueprint_id UUID;
  v_author_id UUID;
  v_interest_id UUID;
  v_next_order INTEGER;
  v_step_id UUID;
BEGIN
  IF NOT public.is_affinity_group_member(p_group_id) THEN
    RAISE EXCEPTION 'Only members can add a prep step';
  END IF;

  IF char_length(v_title) < 2 THEN
    RAISE EXCEPTION 'Give the step a title of at least 2 characters';
  END IF;

  SELECT blueprint_id INTO v_blueprint_id
  FROM public.affinity_groups
  WHERE id = p_group_id;

  IF v_blueprint_id IS NULL THEN
    RAISE EXCEPTION 'This group has no shared plan yet';
  END IF;

  -- The plan author owns the steps members read via the co-subscriber policy.
  SELECT user_id, interest_id INTO v_author_id, v_interest_id
  FROM public.timeline_blueprints
  WHERE id = v_blueprint_id;

  IF v_author_id IS NULL THEN
    RAISE EXCEPTION 'This group has no shared plan yet';
  END IF;

  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_next_order
  FROM public.blueprint_steps
  WHERE blueprint_id = v_blueprint_id;

  INSERT INTO public.timeline_steps (
    user_id, interest_id, title, description,
    category, status, visibility, source_type, source_blueprint_id, sort_order
  ) VALUES (
    v_author_id, v_interest_id, v_title, NULLIF(btrim(coalesce(p_description, '')), ''),
    'general', 'pending', 'crew', 'blueprint', v_blueprint_id, v_next_order
  )
  RETURNING id INTO v_step_id;

  INSERT INTO public.blueprint_steps (blueprint_id, step_id, sort_order)
  VALUES (v_blueprint_id, v_step_id, v_next_order);

  RETURN v_step_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_affinity_group_plan_step(UUID, TEXT, TEXT) TO authenticated;

COMMIT;
