-- Store step-level institutional competency links as ids, not just labels.
-- capability_tags stays as the display/back-compat label list.

ALTER TABLE public.blueprint_step_templates
  ADD COLUMN IF NOT EXISTS capability_competency_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

COMMENT ON COLUMN public.blueprint_step_templates.capability_competency_ids IS
  'Org competency ids trained by this specific template step. Labels remain in capability_tags for display/backward compatibility.';

WITH matched AS (
  SELECT
    t.id AS template_id,
    array_agg(oc.id ORDER BY tag.ord) AS competency_ids
  FROM public.blueprint_step_templates t
  JOIN public.blueprints b ON b.id = t.blueprint_id
  CROSS JOIN LATERAL unnest(COALESCE(t.capability_tags, ARRAY[]::text[]))
    WITH ORDINALITY AS tag(label, ord)
  JOIN public.org_competencies oc
    ON oc.org_id = b.org_id
   AND oc.is_active = true
   AND (
     lower(btrim(oc.short_label)) = lower(btrim(tag.label))
     OR lower(btrim(oc.full_label)) = lower(btrim(tag.label))
   )
  WHERE cardinality(t.capability_competency_ids) = 0
  GROUP BY t.id
)
UPDATE public.blueprint_step_templates t
SET capability_competency_ids = matched.competency_ids
FROM matched
WHERE t.id = matched.template_id;

CREATE OR REPLACE FUNCTION public.materialize_marketplace_blueprint(
  p_blueprint_id uuid,
  p_buyer_user_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bp record;
  v_t record;
  v_step_id uuid;
  v_inserted integer := 0;
  v_skipped integer := 0;
  v_plan jsonb;
BEGIN
  SELECT * INTO v_bp
  FROM public.blueprints
  WHERE id = p_blueprint_id;

  IF v_bp.id IS NULL THEN
    RAISE EXCEPTION 'Blueprint not found';
  END IF;

  IF p_buyer_user_id IS NULL THEN
    RAISE EXCEPTION 'Buyer user id is required';
  END IF;

  IF v_bp.access_mode <> 'independent' OR v_bp.stripe_price_id IS NULL THEN
    RAISE EXCEPTION 'Blueprint is not listed for marketplace adoption';
  END IF;

  IF p_buyer_user_id <> v_bp.author_user_id
     AND NOT EXISTS (
       SELECT 1 FROM public.marketplace_subscriptions ms
       WHERE ms.blueprint_id = p_blueprint_id
         AND ms.buyer_user_id = p_buyer_user_id
         AND ms.status IN ('active', 'trialing')
     ) THEN
    RAISE EXCEPTION 'Active subscription required';
  END IF;

  FOR v_t IN
    SELECT *
    FROM public.blueprint_step_templates t
    WHERE t.blueprint_id = p_blueprint_id
    ORDER BY t.sort_order
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.timeline_steps
      WHERE user_id = p_buyer_user_id
        AND source_type = 'marketplace_copy'
        AND source_id = v_t.id
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_plan := jsonb_strip_nulls(
      jsonb_build_object(
        'what_will_you_do', v_t.title,
        'why_reasoning', NULLIF(v_t.plan_metadata->>'why', ''),
        'when_label', NULLIF(v_t.plan_metadata->>'when_label', ''),
        'where_location', CASE
          WHEN NULLIF(v_t.plan_metadata->>'where_label', '') IS NULL THEN NULL
          ELSE jsonb_build_object('name', v_t.plan_metadata->>'where_label')
        END,
        'who_collaborators', CASE
          WHEN NULLIF(v_t.preceptor_role, '') IS NULL THEN '[]'::jsonb
          ELSE jsonb_build_array(v_t.preceptor_role)
        END,
        'how_sub_steps', (
          SELECT COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'id', 'bp_' || v_t.id::text || '_' || (idx - 1)::text,
                'text', COALESCE(item->>'text', ''),
                'sort_order', idx - 1,
                'completed', false
              )
              ORDER BY idx
            ),
            '[]'::jsonb
          )
          FROM jsonb_array_elements(COALESCE(v_t.sub_steps, '[]'::jsonb)) WITH ORDINALITY AS s(item, idx)
          WHERE NULLIF(item->>'text', '') IS NOT NULL
        ),
        'capability_goals', to_jsonb(COALESCE(v_t.capability_tags, ARRAY[]::text[])),
        'competency_ids', to_jsonb(COALESCE(v_t.capability_competency_ids, ARRAY[]::uuid[])),
        'runthrough_beats', COALESCE(v_t.plan_metadata->'beats', '[]'::jsonb)
      )
    );

    INSERT INTO public.timeline_steps
      (user_id, interest_id, source_type, source_id, title, description, category,
       status, sort_order, metadata)
    VALUES
      (p_buyer_user_id, v_bp.interest_id, 'marketplace_copy', v_t.id,
       v_t.title, v_t.description, v_t.category,
       'pending', v_t.sort_order,
       jsonb_build_object('blueprint_id', p_blueprint_id, 'plan', v_plan))
    RETURNING id INTO v_step_id;

    INSERT INTO public.step_beats (step_id, user_id, position, time_label, title, body)
    SELECT
      v_step_id,
      p_buyer_user_id,
      idx,
      NULLIF(beat->>'time_label', ''),
      beat->>'title',
      NULLIF(beat->>'body', '')
    FROM jsonb_array_elements(COALESCE(v_t.plan_metadata->'beats', '[]'::jsonb)) WITH ORDINALITY AS b(beat, idx)
    WHERE NULLIF(beat->>'title', '') IS NOT NULL;

    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'inserted', v_inserted,
    'skipped', v_skipped
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.materialize_marketplace_blueprint(uuid, uuid) TO authenticated;
