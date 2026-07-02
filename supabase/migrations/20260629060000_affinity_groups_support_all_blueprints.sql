-- Restore affinity group blueprint attachments to the general blueprint model.
--
-- The previous Studio-only migration pointed affinity_groups.blueprint_id at
-- public.blueprints and cleared timeline_blueprints attachments. Groups need to
-- accept both sources:
--   - timeline_blueprints + blueprint_steps, including Get Inspired blueprints
--   - blueprints + blueprint_step_templates, from Creator Studio
--
-- Keep the existing RPC names so the client does not care which storage system
-- authored the attached group blueprint.

BEGIN;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.affinity_groups'::regclass
      AND contype = 'f'
      AND conname LIKE '%blueprint_id%'
  LOOP
    EXECUTE format('ALTER TABLE public.affinity_groups DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

UPDATE public.affinity_groups
SET blueprint_id = '8db491d3-9619-4716-a934-3304b153b188'::UUID,
    updated_at = now()
WHERE id = 'cbbb57ef-2e5a-4416-94c3-e4de089b013c'::UUID
  AND EXISTS (
    SELECT 1
    FROM public.timeline_blueprints
    WHERE id = '8db491d3-9619-4716-a934-3304b153b188'::UUID
  );

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
    RAISE EXCEPTION 'only members can view this group blueprint';
  END IF;

  SELECT blueprint_id INTO v_blueprint_id
  FROM public.affinity_groups ag
  WHERE ag.id = p_group_id
    AND ag.is_active = true;

  IF v_blueprint_id IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.timeline_blueprints tb
    WHERE tb.id = v_blueprint_id
  ) THEN
    RETURN QUERY
    SELECT
      s.id,
      s.title,
      s.description,
      s.category,
      COALESCE(s.status, 'pending')::TEXT AS status
    FROM public.blueprint_steps bs
    JOIN public.timeline_steps s ON s.id = bs.step_id
    WHERE bs.blueprint_id = v_blueprint_id
    ORDER BY bs.sort_order ASC, s.created_at ASC;
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
  v_sub_id UUID;
  v_next_sort INTEGER;
  v_idx INTEGER := 0;
  v_new_step UUID;
  r RECORD;
  v_is_anchor BOOLEAN;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.affinity_group_members
    WHERE group_id = p_group_id
      AND user_id = v_caller
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'only members can seed people in this group';
  END IF;

  SELECT blueprint_id INTO v_blueprint_id
  FROM public.affinity_groups
  WHERE id = p_group_id
    AND is_active = true;

  IF v_blueprint_id IS NULL THEN
    RETURN;
  END IF;

  SELECT interest_id INTO v_interest_id
  FROM public.timeline_blueprints
  WHERE id = v_blueprint_id;

  IF v_interest_id IS NOT NULL THEN
    SELECT id INTO v_sub_id
    FROM public.blueprint_subscriptions
    WHERE blueprint_id = v_blueprint_id
      AND subscriber_id = p_user_id;

    IF v_sub_id IS NULL THEN
      INSERT INTO public.blueprint_subscriptions (blueprint_id, subscriber_id)
      VALUES (v_blueprint_id, p_user_id)
      RETURNING id INTO v_sub_id;
    END IF;

    SELECT COALESCE(MAX(sort_order), -1) + 1 INTO v_next_sort
    FROM public.timeline_steps
    WHERE user_id = p_user_id
      AND interest_id = v_interest_id;

    FOR r IN
      SELECT s.*, bs.sort_order AS bp_sort
      FROM public.blueprint_steps bs
      JOIN public.timeline_steps s ON s.id = bs.step_id
      WHERE bs.blueprint_id = v_blueprint_id
      ORDER BY bs.sort_order ASC
    LOOP
      v_idx := v_idx + 1;

      IF r.user_id = p_user_id THEN
        CONTINUE;
      END IF;

      v_is_anchor := (v_idx = 1) OR COALESCE(r.is_race, false) OR (r.due_at IS NOT NULL);
      IF NOT v_is_anchor THEN
        CONTINUE;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM public.blueprint_step_actions
        WHERE subscription_id = v_sub_id
          AND source_step_id = r.id
      ) THEN
        CONTINUE;
      END IF;

      INSERT INTO public.timeline_steps (
        user_id, interest_id, organization_id,
        source_type, source_id, source_blueprint_id, copied_from_user_id,
        title, description, category, status,
        starts_at, ends_at, due_at,
        location_name, location_lat, location_lng, location_place_id,
        visibility, share_approximate_location,
        sort_order, metadata, is_timed, is_race
      )
      VALUES (
        p_user_id, r.interest_id, r.organization_id,
        'copied', r.id, v_blueprint_id, r.user_id,
        r.title, r.description, r.category, 'pending',
        r.starts_at, r.ends_at, r.due_at,
        r.location_name, r.location_lat, r.location_lng, r.location_place_id,
        r.visibility, r.share_approximate_location,
        v_next_sort, COALESCE(r.metadata, '{}'::jsonb), COALESCE(r.is_timed, false), COALESCE(r.is_race, false)
      )
      RETURNING id INTO v_new_step;

      v_next_sort := v_next_sort + 1;

      INSERT INTO public.blueprint_step_actions (subscription_id, source_step_id, action, adopted_step_id)
      VALUES (v_sub_id, r.id, 'adopted', v_new_step);
    END LOOP;

    RETURN;
  END IF;

  SELECT interest_id INTO v_interest_id
  FROM public.blueprints
  WHERE id = v_blueprint_id;

  IF v_interest_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(MAX(sort_order), -1) + 1 INTO v_next_sort
  FROM public.timeline_steps
  WHERE user_id = p_user_id
    AND interest_id = v_interest_id;

  SELECT t.* INTO r
  FROM public.blueprint_step_templates t
  WHERE t.blueprint_id = v_blueprint_id
  ORDER BY t.sort_order ASC, t.created_at ASC
  LIMIT 1;

  IF r.id IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.timeline_steps
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
      'seeded_from_group_blueprint', true
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
    RAISE EXCEPTION 'this group does not support attaching a blueprint here';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.affinity_group_members
    WHERE group_id = p_group_id
      AND user_id = v_caller
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'only members can attach a blueprint to this group';
  END IF;

  SELECT user_id INTO v_owner
  FROM public.timeline_blueprints
  WHERE id = p_blueprint_id;

  IF v_owner IS NOT NULL THEN
    IF v_owner <> v_caller THEN
      RAISE EXCEPTION 'you can only attach a blueprint you created';
    END IF;

    UPDATE public.timeline_blueprints
    SET is_published = true,
        updated_at = now()
    WHERE id = p_blueprint_id;
  ELSE
    SELECT author_user_id INTO v_owner
    FROM public.blueprints
    WHERE id = p_blueprint_id;

    IF v_owner IS NULL THEN
      RAISE EXCEPTION 'blueprint not found';
    END IF;

    IF v_owner <> v_caller THEN
      RAISE EXCEPTION 'you can only attach a blueprint you created';
    END IF;
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
  WHERE id = p_group_id
    AND is_active = true;

  IF v_blueprint_id IS NULL THEN
    RAISE EXCEPTION 'This group has no shared blueprint yet';
  END IF;

  SELECT user_id, interest_id INTO v_author_id, v_interest_id
  FROM public.timeline_blueprints
  WHERE id = v_blueprint_id;

  IF v_author_id IS NOT NULL THEN
    SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_next_order
    FROM public.blueprint_steps
    WHERE blueprint_id = v_blueprint_id;

    INSERT INTO public.timeline_steps (
      user_id, interest_id, title, description,
      category, status, visibility, source_type, source_blueprint_id, sort_order
    )
    VALUES (
      v_author_id, v_interest_id, v_title, NULLIF(btrim(coalesce(p_description, '')), ''),
      'general', 'pending', 'crew', 'blueprint', v_blueprint_id, v_next_order
    )
    RETURNING id INTO v_step_id;

    INSERT INTO public.blueprint_steps (blueprint_id, step_id, sort_order)
    VALUES (v_blueprint_id, v_step_id, v_next_order);

    RETURN v_step_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.blueprints WHERE id = v_blueprint_id) THEN
    RAISE EXCEPTION 'This group has no shared blueprint yet';
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
        SELECT COUNT(*)
        FROM public.blueprint_step_templates
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
    RAISE EXCEPTION 'Only members can edit this blueprint';
  END IF;

  SELECT blueprint_id INTO v_blueprint_id
  FROM public.affinity_groups
  WHERE id = p_group_id
    AND is_active = true;

  IF v_blueprint_id IS NULL THEN
    RAISE EXCEPTION 'This group has no shared blueprint yet';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.blueprint_steps
    WHERE blueprint_id = v_blueprint_id
      AND step_id = p_step_id
  ) THEN
    RETURN v_blueprint_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.blueprint_step_templates
    WHERE blueprint_id = v_blueprint_id
      AND id = p_step_id
  ) THEN
    RETURN v_blueprint_id;
  END IF;

  RAISE EXCEPTION 'That step is not part of this group blueprint';
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

  IF EXISTS (
    SELECT 1
    FROM public.blueprint_steps
    WHERE blueprint_id = v_blueprint_id
      AND step_id = p_step_id
  ) THEN
    UPDATE public.timeline_steps
    SET title = v_title,
        description = NULLIF(btrim(coalesce(p_description, '')), ''),
        updated_at = now()
    WHERE id = p_step_id;
    RETURN;
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

  IF EXISTS (
    SELECT 1
    FROM public.blueprint_steps
    WHERE blueprint_id = v_blueprint_id
      AND step_id = p_step_id
  ) THEN
    DELETE FROM public.blueprint_steps WHERE step_id = p_step_id;
    DELETE FROM public.timeline_steps WHERE id = p_step_id;
    RETURN;
  END IF;

  DELETE FROM public.blueprint_step_templates
  WHERE id = p_step_id;

  UPDATE public.blueprints
  SET step_count = (
        SELECT COUNT(*)
        FROM public.blueprint_step_templates
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
    RAISE EXCEPTION 'Only members can reorder this blueprint';
  END IF;

  SELECT blueprint_id INTO v_blueprint_id
  FROM public.affinity_groups
  WHERE id = p_group_id
    AND is_active = true;

  IF v_blueprint_id IS NULL THEN
    RAISE EXCEPTION 'This group has no shared blueprint yet';
  END IF;

  IF EXISTS (SELECT 1 FROM public.timeline_blueprints WHERE id = v_blueprint_id) THEN
    SELECT COUNT(*) INTO v_total
    FROM public.blueprint_steps
    WHERE blueprint_id = v_blueprint_id;

    SELECT COUNT(*) INTO v_matched
    FROM public.blueprint_steps
    WHERE blueprint_id = v_blueprint_id
      AND step_id = ANY(p_step_ids);

    IF array_length(p_step_ids, 1) IS DISTINCT FROM v_total
       OR v_matched IS DISTINCT FROM v_total THEN
      RAISE EXCEPTION 'Reorder must list exactly this group blueprint''s steps';
    END IF;

    UPDATE public.blueprint_steps AS bs
    SET sort_order = ordered.ord
    FROM (
      SELECT unnest(p_step_ids) AS step_id,
             generate_subscripts(p_step_ids, 1) AS ord
    ) AS ordered
    WHERE bs.blueprint_id = v_blueprint_id
      AND bs.step_id = ordered.step_id;
    RETURN;
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
    RAISE EXCEPTION 'Reorder must list exactly this group blueprint''s steps';
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
  v_sub_id UUID;
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
    RAISE EXCEPTION 'only members can reset this group blueprint';
  END IF;

  SELECT ag.blueprint_id, tb.interest_id, ag.name, ag.goal_at
    INTO v_blueprint_id, v_interest_id, v_group_name, v_goal_at
  FROM public.affinity_groups ag
  JOIN public.timeline_blueprints tb ON tb.id = ag.blueprint_id
  WHERE ag.id = p_group_id
    AND ag.is_active = true;

  IF v_blueprint_id IS NOT NULL THEN
    SELECT id INTO v_sub_id
    FROM public.blueprint_subscriptions
    WHERE blueprint_id = v_blueprint_id
      AND subscriber_id = v_caller;

    IF v_sub_id IS NULL THEN
      INSERT INTO public.blueprint_subscriptions (blueprint_id, subscriber_id)
      VALUES (v_blueprint_id, v_caller)
      RETURNING id INTO v_sub_id;
    END IF;

    FOR r IN
      SELECT
        bs.step_id AS source_step_id,
        bs.sort_order AS bp_sort,
        s.*
      FROM public.blueprint_steps bs
      JOIN public.timeline_steps s ON s.id = bs.step_id
      WHERE bs.blueprint_id = v_blueprint_id
      ORDER BY bs.sort_order ASC
    LOOP
      IF r.user_id = v_caller THEN
        v_step_id := r.source_step_id;

        UPDATE public.timeline_steps
        SET status = 'pending',
            starts_at = NULL,
            ends_at = NULL,
            due_at = NULL,
            is_race = false,
            sort_order = v_sort,
            updated_at = now()
        WHERE id = v_step_id;
      ELSE
        SELECT id INTO v_step_id
        FROM public.timeline_steps
        WHERE user_id = v_caller
          AND source_id = r.source_step_id
          AND status <> 'folded'
        ORDER BY created_at ASC
        LIMIT 1;

        IF v_step_id IS NULL THEN
          INSERT INTO public.timeline_steps (
            user_id, interest_id, organization_id,
            source_type, source_id, source_blueprint_id, copied_from_user_id,
            title, description, category, status,
            starts_at, ends_at, due_at,
            location_name, location_lat, location_lng, location_place_id,
            visibility, share_approximate_location,
            sort_order, metadata, is_timed, is_race
          )
          VALUES (
            v_caller, r.interest_id, r.organization_id,
            'copied', r.source_step_id, v_blueprint_id, r.user_id,
            r.title, r.description, r.category, 'pending',
            NULL, NULL, NULL,
            r.location_name, r.location_lat, r.location_lng, r.location_place_id,
            r.visibility, r.share_approximate_location,
            v_sort, COALESCE(r.metadata, '{}'::jsonb), COALESCE(r.is_timed, false), false
          )
          RETURNING id INTO v_step_id;
        ELSE
          UPDATE public.timeline_steps
          SET status = 'pending',
              starts_at = NULL,
              ends_at = NULL,
              due_at = NULL,
              is_race = false,
              sort_order = v_sort,
              updated_at = now()
          WHERE id = v_step_id;
        END IF;

        INSERT INTO public.blueprint_step_actions (
          subscription_id,
          source_step_id,
          action,
          acted_at,
          adopted_step_id
        )
        VALUES (v_sub_id, r.source_step_id, 'adopted', now(), v_step_id)
        ON CONFLICT (subscription_id, source_step_id)
        DO UPDATE SET action = 'adopted',
                      acted_at = now(),
                      adopted_step_id = EXCLUDED.adopted_step_id;
      END IF;

      v_plan_row_ids := array_append(v_plan_row_ids, v_step_id);
      v_sort := v_sort + 1;
    END LOOP;
  ELSE
    SELECT ag.blueprint_id, b.interest_id, ag.name, ag.goal_at
      INTO v_blueprint_id, v_interest_id, v_group_name, v_goal_at
    FROM public.affinity_groups ag
    JOIN public.blueprints b ON b.id = ag.blueprint_id
    WHERE ag.id = p_group_id
      AND ag.is_active = true;

    IF v_blueprint_id IS NULL THEN
      RAISE EXCEPTION 'this group does not have an attached blueprint';
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
            'reset_from_group_blueprint', true
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
                'reset_from_group_blueprint', true
              ),
            updated_at = now()
        WHERE id = v_step_id;
      END IF;

      v_plan_row_ids := array_append(v_plan_row_ids, v_step_id);
      v_sort := v_sort + 1;
    END LOOP;
  END IF;

  IF v_goal_at IS NOT NULL THEN
    SELECT id INTO v_anchor_id
    FROM public.timeline_steps
    WHERE user_id = v_caller
      AND interest_id = v_interest_id
      AND source_id = v_blueprint_id
      AND status <> 'folded'
      AND (is_race = true OR category = 'race')
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_anchor_id IS NULL THEN
      INSERT INTO public.timeline_steps (
        user_id, interest_id,
        source_type, source_id, source_blueprint_id,
        title, description, category, status,
        starts_at, is_race, visibility, sort_order, metadata
      )
      VALUES (
        v_caller, v_interest_id,
        'suggestion', v_blueprint_id, v_blueprint_id,
        v_group_name, 'The fixed point everything above builds toward.',
        'race', 'pending',
        v_goal_at, true, 'followers', v_sort,
        jsonb_build_object('affinity_group_id', p_group_id, 'reset_from_group_blueprint', true)
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
          source_blueprint_id = v_blueprint_id,
          sort_order = v_sort,
          metadata = COALESCE(metadata, '{}'::jsonb) ||
            jsonb_build_object('affinity_group_id', p_group_id, 'reset_from_group_blueprint', true),
          updated_at = now()
      WHERE id = v_anchor_id;
    END IF;

    UPDATE public.timeline_steps
    SET status = 'folded',
        updated_at = now()
    WHERE user_id = v_caller
      AND interest_id = v_interest_id
      AND id <> v_anchor_id
      AND source_id = v_blueprint_id
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

COMMENT ON FUNCTION public.reset_my_affinity_group_plan(UUID) IS
  'Restart the caller''s personal timeline from a group blueprint without detaching the group blueprint.';

COMMIT;
