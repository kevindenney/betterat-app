-- Let a member restart their personal timeline for a group's attached plan.
--
-- This is deliberately a reset/resequence, not a destructive delete: the
-- member keeps rows and notes, but plan steps go back to pending and are ordered
-- before the group's race-day anchor.

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
    RAISE EXCEPTION 'only members can reset this group plan';
  END IF;

  SELECT ag.blueprint_id, tb.interest_id, ag.name, ag.goal_at
    INTO v_blueprint_id, v_interest_id, v_group_name, v_goal_at
  FROM public.affinity_groups ag
  JOIN public.timeline_blueprints tb ON tb.id = ag.blueprint_id
  WHERE ag.id = p_group_id
    AND ag.is_active = true;

  IF v_blueprint_id IS NULL THEN
    RAISE EXCEPTION 'this group does not have an attached plan';
  END IF;

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
          source_blueprint_id = v_blueprint_id,
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
      AND interest_id = v_interest_id
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
  'Restart the caller''s personal timeline for a group plan: plan steps pending/in blueprint order, race-day anchor last.';
