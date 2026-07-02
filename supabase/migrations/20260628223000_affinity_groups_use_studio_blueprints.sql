-- Make self-serve affinity groups attach Studio blueprints.
--
-- New canonical authoring lives in public.blueprints + blueprint_step_templates.
-- Keep the existing RPC names used by the client, but point them at the Studio
-- tables so new group-plan flows no longer depend on timeline_blueprints,
-- blueprint_steps, or blueprint_subscriptions.

BEGIN;

-- affinity_groups.blueprint_id used to reference timeline_blueprints. Remove
-- that FK, clear orphaned legacy ids, then point the column at blueprints.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.affinity_groups'::regclass
      AND confrelid = 'public.timeline_blueprints'::regclass
      AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE public.affinity_groups DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

UPDATE public.affinity_groups ag
SET blueprint_id = NULL,
    updated_at = now()
WHERE blueprint_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.blueprints b WHERE b.id = ag.blueprint_id
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.affinity_groups'::regclass
      AND conname = 'affinity_groups_blueprint_id_fkey'
  ) THEN
    ALTER TABLE public.affinity_groups
      ADD CONSTRAINT affinity_groups_blueprint_id_fkey
      FOREIGN KEY (blueprint_id) REFERENCES public.blueprints(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_affinity_group_plan_steps(p_group_id UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  category TEXT,
  status TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blueprint_id UUID;
BEGIN
  IF NOT public.is_affinity_group_member(p_group_id) THEN
    RAISE EXCEPTION 'only members can view this group plan';
  END IF;

  SELECT blueprint_id INTO v_blueprint_id
  FROM public.affinity_groups
  WHERE id = p_group_id
    AND is_active = true;

  IF v_blueprint_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.title,
    t.description,
    t.category,
    'pending'::TEXT AS status
  FROM public.blueprint_step_templates t
  WHERE t.blueprint_id = v_blueprint_id
  ORDER BY t.sort_order ASC, t.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_affinity_group_plan_steps(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.seed_group_member_from_blueprint(
  p_group_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_blueprint_id UUID;
  v_interest_id UUID;
  v_next_sort INTEGER;
  r RECORD;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.affinity_group_members
    WHERE group_id = p_group_id
      AND user_id = v_caller
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'only members can seed people in this group';
  END IF;

  SELECT ag.blueprint_id, b.interest_id
    INTO v_blueprint_id, v_interest_id
  FROM public.affinity_groups ag
  JOIN public.blueprints b ON b.id = ag.blueprint_id
  WHERE ag.id = p_group_id
    AND ag.is_active = true;

  IF v_blueprint_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(MAX(sort_order), -1) + 1 INTO v_next_sort
  FROM public.timeline_steps
  WHERE user_id = p_user_id
    AND (v_interest_id IS NULL OR interest_id = v_interest_id);

  -- Seed only the first template. The full reset action can materialize the
  -- whole plan later without flooding a new member's timeline on join.
  SELECT t.*
    INTO r
  FROM public.blueprint_step_templates t
  WHERE t.blueprint_id = v_blueprint_id
  ORDER BY t.sort_order ASC, t.created_at ASC
  LIMIT 1;

  IF r.id IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.timeline_steps
    WHERE user_id = p_user_id
      AND source_id = r.id
      AND status <> 'folded'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.timeline_steps (
    user_id, interest_id, source_type, source_id,
    title, description, category, status, visibility, sort_order, metadata
  )
  VALUES (
    p_user_id, v_interest_id, 'copied', r.id,
    r.title, r.description, r.category, 'pending', 'private', v_next_sort,
    jsonb_build_object(
      'blueprint_id', v_blueprint_id,
      'affinity_group_id', p_group_id,
      'seeded_from_group_plan', true
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_group_member_from_blueprint(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.attach_affinity_group_blueprint(
  p_group_id UUID,
  p_blueprint_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_kind TEXT;
  v_owner UUID;
  r_member RECORD;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT kind INTO v_kind
  FROM public.affinity_groups
  WHERE id = p_group_id
    AND is_active = true;

  IF v_kind IS NULL THEN
    RAISE EXCEPTION 'group not found';
  END IF;

  IF v_kind NOT IN ('crew_pod', 'practice_group') THEN
    RAISE EXCEPTION 'this group does not support attaching a plan here';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.affinity_group_members
    WHERE group_id = p_group_id
      AND user_id = v_caller
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'only members can attach a plan to this group';
  END IF;

  SELECT author_user_id INTO v_owner
  FROM public.blueprints
  WHERE id = p_blueprint_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'plan not found';
  END IF;

  IF v_owner <> v_caller THEN
    RAISE EXCEPTION 'you can only attach a plan you created';
  END IF;

  UPDATE public.affinity_groups
  SET blueprint_id = p_blueprint_id,
      updated_at = now()
  WHERE id = p_group_id;

  FOR r_member IN
    SELECT user_id
    FROM public.affinity_group_members
    WHERE group_id = p_group_id
      AND status = 'active'
  LOOP
    PERFORM public.seed_group_member_from_blueprint(p_group_id, r_member.user_id);
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.attach_affinity_group_blueprint(UUID, UUID) TO authenticated;

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
  WHERE id = p_group_id
    AND is_active = true;

  IF v_blueprint_id IS NULL THEN
    RAISE EXCEPTION 'This group has no shared plan yet';
  END IF;

  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_next_order
  FROM public.blueprint_step_templates
  WHERE blueprint_id = v_blueprint_id;

  INSERT INTO public.blueprint_step_templates (
    blueprint_id, sort_order, title, description, category
  )
  VALUES (
    v_blueprint_id,
    v_next_order,
    v_title,
    NULLIF(btrim(coalesce(p_description, '')), ''),
    'other'
  )
  RETURNING id INTO v_step_id;

  UPDATE public.blueprints
  SET step_count = (
        SELECT COUNT(*) FROM public.blueprint_step_templates
        WHERE blueprint_id = v_blueprint_id
      ),
      last_edited_at = now(),
      updated_at = now()
  WHERE id = v_blueprint_id;

  RETURN v_step_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_affinity_group_plan_step(UUID, TEXT, TEXT) TO authenticated;

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
  FROM public.affinity_groups
  WHERE id = p_group_id
    AND is_active = true;

  IF v_blueprint_id IS NULL THEN
    RAISE EXCEPTION 'This group has no shared plan yet';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.blueprint_step_templates
    WHERE blueprint_id = v_blueprint_id
      AND id = p_step_id
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
  v_blueprint_id UUID;
BEGIN
  v_blueprint_id := public.assert_affinity_group_plan_step(p_group_id, p_step_id);

  IF char_length(v_title) < 2 THEN
    RAISE EXCEPTION 'Give the step a title of at least 2 characters';
  END IF;

  UPDATE public.blueprint_step_templates
  SET title = v_title,
      description = NULLIF(btrim(coalesce(p_description, '')), ''),
      updated_at = now()
  WHERE id = p_step_id;

  UPDATE public.blueprints
  SET last_edited_at = now(),
      updated_at = now()
  WHERE id = v_blueprint_id;
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
DECLARE
  v_blueprint_id UUID;
BEGIN
  v_blueprint_id := public.assert_affinity_group_plan_step(p_group_id, p_step_id);

  DELETE FROM public.blueprint_step_templates
  WHERE id = p_step_id;

  UPDATE public.blueprints
  SET step_count = (
        SELECT COUNT(*) FROM public.blueprint_step_templates
        WHERE blueprint_id = v_blueprint_id
      ),
      last_edited_at = now(),
      updated_at = now()
  WHERE id = v_blueprint_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assert_affinity_group_plan_step(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_affinity_group_plan_step(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_affinity_group_plan_step(UUID, UUID) TO authenticated;

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
  FROM public.affinity_groups
  WHERE id = p_group_id
    AND is_active = true;

  IF v_blueprint_id IS NULL THEN
    RAISE EXCEPTION 'This group has no shared plan yet';
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM public.blueprint_step_templates
  WHERE blueprint_id = v_blueprint_id;

  SELECT COUNT(*) INTO v_matched
  FROM public.blueprint_step_templates
  WHERE blueprint_id = v_blueprint_id
    AND id = ANY(p_step_ids);

  IF array_length(p_step_ids, 1) IS DISTINCT FROM v_total
     OR v_matched IS DISTINCT FROM v_total THEN
    RAISE EXCEPTION 'Reorder must list exactly this group plan''s steps';
  END IF;

  UPDATE public.blueprint_step_templates AS t
  SET sort_order = ordered.ord,
      updated_at = now()
  FROM (
    SELECT unnest(p_step_ids) AS id,
           generate_subscripts(p_step_ids, 1) AS ord
  ) AS ordered
  WHERE t.blueprint_id = v_blueprint_id
    AND t.id = ordered.id;

  UPDATE public.blueprints
  SET last_edited_at = now(),
      updated_at = now()
  WHERE id = v_blueprint_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reorder_affinity_group_plan_steps(UUID, UUID[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.reset_my_affinity_group_plan(p_group_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_blueprint_id UUID;
  v_interest_id UUID;
  v_group_name TEXT;
  v_goal_at TIMESTAMPTZ;
  v_sort INTEGER := 1;
  v_plan_row_ids UUID[] := ARRAY[]::UUID[];
  v_step_id UUID;
  v_anchor_id UUID;
  v_anchor_offset INTEGER := 0;
  r RECORD;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NOT public.is_affinity_group_member(p_group_id) THEN
    RAISE EXCEPTION 'only members can reset this group plan';
  END IF;

  SELECT ag.blueprint_id, b.interest_id, ag.name, ag.goal_at
    INTO v_blueprint_id, v_interest_id, v_group_name, v_goal_at
  FROM public.affinity_groups ag
  JOIN public.blueprints b ON b.id = ag.blueprint_id
  WHERE ag.id = p_group_id
    AND ag.is_active = true;

  IF v_blueprint_id IS NULL THEN
    RAISE EXCEPTION 'this group does not have an attached plan';
  END IF;

  FOR r IN
    SELECT *
    FROM public.blueprint_step_templates
    WHERE blueprint_id = v_blueprint_id
    ORDER BY sort_order ASC, created_at ASC
  LOOP
    SELECT id INTO v_step_id
    FROM public.timeline_steps
    WHERE user_id = v_caller
      AND source_id = r.id
      AND status <> 'folded'
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_step_id IS NULL THEN
      INSERT INTO public.timeline_steps (
        user_id, interest_id,
        source_type, source_id,
        title, description, category, status,
        starts_at, ends_at, due_at,
        visibility, sort_order, metadata
      )
      VALUES (
        v_caller, v_interest_id,
        'copied', r.id,
        r.title, r.description, r.category, 'pending',
        NULL, NULL, NULL,
        'private', v_sort,
        jsonb_build_object(
          'blueprint_id', v_blueprint_id,
          'affinity_group_id', p_group_id,
          'reset_from_group_plan', true
        )
      )
      RETURNING id INTO v_step_id;
    ELSE
      UPDATE public.timeline_steps
      SET title = r.title,
          description = r.description,
          category = r.category,
          status = 'pending',
          starts_at = NULL,
          ends_at = NULL,
          due_at = NULL,
          is_race = false,
          sort_order = v_sort,
          metadata = COALESCE(metadata, '{}'::jsonb) ||
            jsonb_build_object(
              'blueprint_id', v_blueprint_id,
              'affinity_group_id', p_group_id,
              'reset_from_group_plan', true
            ),
          updated_at = now()
      WHERE id = v_step_id;
    END IF;

    v_plan_row_ids := array_append(v_plan_row_ids, v_step_id);
    v_sort := v_sort + 1;
  END LOOP;

  IF v_goal_at IS NOT NULL THEN
    SELECT id INTO v_anchor_id
    FROM public.timeline_steps
    WHERE user_id = v_caller
      AND source_id = v_blueprint_id
      AND status <> 'folded'
      AND (is_race = true OR category = 'race')
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_anchor_id IS NULL THEN
      INSERT INTO public.timeline_steps (
        user_id, interest_id,
        source_type, source_id,
        title, description, category, status,
        starts_at, is_race, visibility, sort_order, metadata
      )
      VALUES (
        v_caller, v_interest_id,
        'suggestion', v_blueprint_id,
        v_group_name, 'The fixed point everything above builds toward.',
        'race', 'pending',
        v_goal_at, true, 'followers', v_sort,
        jsonb_build_object('affinity_group_id', p_group_id, 'reset_from_group_plan', true)
      )
      RETURNING id INTO v_anchor_id;
    ELSE
      UPDATE public.timeline_steps
      SET title = v_group_name,
          description = 'The fixed point everything above builds toward.',
          category = 'race',
          status = 'pending',
          starts_at = v_goal_at,
          ends_at = NULL,
          due_at = NULL,
          is_race = true,
          sort_order = v_sort,
          metadata = COALESCE(metadata, '{}'::jsonb) ||
            jsonb_build_object('affinity_group_id', p_group_id, 'reset_from_group_plan', true),
          updated_at = now()
      WHERE id = v_anchor_id;
    END IF;

    UPDATE public.timeline_steps
    SET status = 'folded',
        updated_at = now()
    WHERE user_id = v_caller
      AND source_id = v_blueprint_id
      AND id <> v_anchor_id
      AND status <> 'folded'
      AND (is_race = true OR category = 'race');

    v_anchor_offset := 1;
  END IF;

  WITH ordered_other AS (
    SELECT
      id,
      row_number() OVER (ORDER BY sort_order ASC, created_at ASC) AS rn
    FROM public.timeline_steps
    WHERE user_id = v_caller
      AND (v_interest_id IS NULL OR interest_id = v_interest_id)
      AND status <> 'folded'
      AND NOT (id = ANY(v_plan_row_ids))
      AND (v_anchor_id IS NULL OR id <> v_anchor_id)
  )
  UPDATE public.timeline_steps ts
  SET sort_order = (v_sort - 1) + v_anchor_offset + ordered_other.rn,
      updated_at = now()
  FROM ordered_other
  WHERE ts.id = ordered_other.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_my_affinity_group_plan(UUID) TO authenticated;

COMMIT;
