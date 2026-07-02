-- Marketplace step copy RPC
-- Independent marketplace blueprints expose their step templates through
-- get_marketplace_blueprint, but direct blueprint_step_templates reads are RLS
-- protected. Buyers need a definer path to copy one or all subscribed steps
-- into their own timeline.

CREATE OR REPLACE FUNCTION public.materialize_marketplace_blueprint_steps(
  p_blueprint_id uuid,
  p_step_mode text DEFAULT 'all',
  p_template_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_bp record;
  v_has_access boolean := false;
  v_inserted integer := 0;
  v_step_ids uuid[] := ARRAY[]::uuid[];
  v_step_map jsonb := '{}'::jsonb;
  v_first_step_id uuid := NULL;
  v_next_sort integer := 1;
  v_t record;
  v_existing record;
  v_sub_steps jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to add this blueprint step'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT id, org_id, interest_id, status, access_mode
  INTO v_bp
  FROM public.blueprints
  WHERE id = p_blueprint_id;

  IF v_bp.id IS NULL OR v_bp.status <> 'live' OR v_bp.access_mode <> 'independent' THEN
    RAISE EXCEPTION 'Blueprint is not available';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.marketplace_subscriptions ms
    WHERE ms.blueprint_id = p_blueprint_id
      AND ms.buyer_user_id = v_uid
      AND ms.status IN ('active', 'trialing')
  ) OR EXISTS (
    SELECT 1
    FROM public.blueprint_subscriptions bs
    WHERE bs.blueprint_id = p_blueprint_id
      AND bs.subscriber_id = v_uid
      AND bs.blueprint_system = 'marketplace'
  )
  INTO v_has_access;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'No active subscription for this blueprint'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT COALESCE(max(sort_order), 0) + 1
  INTO v_next_sort
  FROM public.timeline_steps
  WHERE user_id = v_uid
    AND (
      v_bp.interest_id IS NULL
      OR interest_id = v_bp.interest_id
    );

  FOR v_existing IN
    SELECT id, source_id
    FROM public.timeline_steps
    WHERE user_id = v_uid
      AND source_type = 'marketplace_copy'
      AND source_id IN (
        SELECT id
        FROM public.blueprint_step_templates
        WHERE blueprint_id = p_blueprint_id
      )
  LOOP
    IF v_existing.source_id IS NOT NULL THEN
      v_step_map := v_step_map || jsonb_build_object(v_existing.source_id::text, v_existing.id);
    END IF;
  END LOOP;

  FOR v_t IN
    SELECT t.id,
           t.title,
           t.description,
           t.category,
           t.what_question,
           t.sub_steps,
           t.preceptor_role,
           t.capability_tags,
           t.plan_metadata
    FROM public.blueprint_step_templates t
    WHERE t.blueprint_id = p_blueprint_id
      AND (
        p_template_ids IS NULL
        OR t.id = ANY(p_template_ids)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.timeline_steps ts
        WHERE ts.user_id = v_uid
          AND ts.source_type = 'marketplace_copy'
          AND ts.source_id = t.id
      )
    ORDER BY t.sort_order
  LOOP
    IF p_step_mode = 'first' AND v_inserted > 0 THEN
      EXIT;
    END IF;

    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', 'ss_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12),
          'text', COALESCE(item->>'text', ''),
          'completed', false,
          'sort_order', COALESCE((item->>'n')::integer - 1, ordinality - 1)
        )
        ORDER BY ordinality
      ),
      '[]'::jsonb
    )
    INTO v_sub_steps
    FROM jsonb_array_elements(COALESCE(v_t.sub_steps, '[]'::jsonb)) WITH ORDINALITY AS s(item, ordinality)
    WHERE length(trim(COALESCE(item->>'text', ''))) > 0;

    INSERT INTO public.timeline_steps
      (user_id,
       interest_id,
       organization_id,
       source_type,
       source_id,
       title,
       description,
       category,
       status,
       visibility,
       sort_order,
       metadata)
    VALUES
      (v_uid,
       v_bp.interest_id,
       v_bp.org_id,
       'marketplace_copy',
       v_t.id,
       v_t.title,
       v_t.description,
       'general',
       'pending',
       'private',
       v_next_sort,
       jsonb_build_object(
         'plan', jsonb_build_object(
           'what_will_you_do', v_t.title,
           'why_reasoning', NULLIF(trim(COALESCE(v_t.plan_metadata->>'why', '')), ''),
           'how_sub_steps', v_sub_steps,
           'capability_goals', COALESCE(to_jsonb(v_t.capability_tags), '[]'::jsonb),
           'competency_ids', '[]'::jsonb,
           'when_label', NULLIF(trim(COALESCE(v_t.plan_metadata->>'when_label', v_t.plan_metadata->>'whenLabel', '')), ''),
           'where_label', NULLIF(trim(COALESCE(v_t.plan_metadata->>'where_label', v_t.plan_metadata->>'whereLabel', '')), ''),
           'what_question', NULLIF(trim(COALESCE(v_t.what_question, '')), '')
         ),
         'source', 'institutional_blueprint',
         'blueprint_id', p_blueprint_id,
         'blueprint_template_id', v_t.id,
         'preceptor_role', NULLIF(trim(COALESCE(v_t.preceptor_role, '')), '')
       ))
    RETURNING id INTO v_first_step_id;

    IF v_inserted = 0 THEN
      v_step_ids := ARRAY[v_first_step_id];
    ELSE
      v_step_ids := array_append(v_step_ids, v_first_step_id);
    END IF;
    v_step_map := v_step_map || jsonb_build_object(v_t.id::text, v_first_step_id);
    v_inserted := v_inserted + 1;
    v_next_sort := v_next_sort + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'count', v_inserted,
    'first_step_id', CASE WHEN array_length(v_step_ids, 1) > 0 THEN v_step_ids[1] ELSE NULL END,
    'step_ids', COALESCE(to_jsonb(v_step_ids), '[]'::jsonb),
    'step_ids_by_template_id', v_step_map
  );
END;
$$;

REVOKE ALL ON FUNCTION public.materialize_marketplace_blueprint_steps(uuid, text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.materialize_marketplace_blueprint_steps(uuid, text, uuid[]) TO authenticated;

COMMENT ON FUNCTION public.materialize_marketplace_blueprint_steps(uuid, text, uuid[]) IS
  'Copy one, first, or all remaining subscribed marketplace blueprint templates into the current user timeline.';
