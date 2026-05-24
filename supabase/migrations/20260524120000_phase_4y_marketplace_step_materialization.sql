-- Phase 4y · marketplace step materialization
-- When a buyer subscribes to an independent blueprint, the
-- blueprint_step_templates rows materialize into the buyer's
-- timeline_steps so they can actually practice the steps, not just
-- read them.
--
-- timeline_steps.interest_id was originally NOT NULL (sail-racing
-- legacy). Independent blueprints don't have an interest binding yet
-- — relaxed to nullable. source_type CHECK extended to include
-- 'marketplace_copy' (plus 'blueprint' and 'suggestion' which already
-- existed in production but weren't in the original CHECK list).

ALTER TABLE public.timeline_steps
  ALTER COLUMN interest_id DROP NOT NULL;

ALTER TABLE public.timeline_steps
  DROP CONSTRAINT IF EXISTS timeline_steps_source_type_check;

ALTER TABLE public.timeline_steps
  ADD CONSTRAINT timeline_steps_source_type_check
  CHECK (source_type IN ('manual','template','copied','program_session','blueprint','suggestion','marketplace_copy'));

CREATE INDEX IF NOT EXISTS idx_timeline_steps_marketplace
  ON public.timeline_steps(user_id, source_id)
  WHERE source_type = 'marketplace_copy';

CREATE OR REPLACE FUNCTION public.materialize_marketplace_blueprint(
  p_blueprint_id uuid,
  p_buyer_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid;
  v_caller_is_buyer boolean;
  v_caller_is_admin boolean := false;
  v_org_id uuid;
  v_inserted integer := 0;
  v_skipped integer := 0;
  v_sub_exists boolean;
  v_t record;
BEGIN
  v_caller := (SELECT auth.uid());
  v_caller_is_buyer := v_caller IS NOT NULL AND v_caller = p_buyer_user_id;

  SELECT org_id INTO v_org_id FROM public.blueprints WHERE id = p_blueprint_id;
  IF v_caller IS NOT NULL AND v_org_id IS NOT NULL THEN
    v_caller_is_admin := public.is_org_admin_member(v_org_id);
  END IF;

  -- Allow: the buyer themselves, OR an org admin (for migrations/backfill),
  -- OR a service-role caller (auth.uid IS NULL inside a SECURITY DEFINER
  -- fn invoked by the webhook).
  IF v_caller IS NOT NULL AND NOT v_caller_is_buyer AND NOT v_caller_is_admin THEN
    RAISE EXCEPTION 'Not authorized to materialize this blueprint'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Buyer must have an active subscription. Skipped when the caller
  -- is the service role (webhook just created the row).
  IF v_caller IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.marketplace_subscriptions
      WHERE blueprint_id = p_blueprint_id
        AND buyer_user_id = p_buyer_user_id
        AND status IN ('active','trialing')
    ) INTO v_sub_exists;
    IF NOT v_sub_exists THEN
      RAISE EXCEPTION 'No active subscription for this blueprint'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  FOR v_t IN
    SELECT t.id, t.title, t.description, t.category, t.sort_order
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

    INSERT INTO public.timeline_steps
      (user_id, interest_id, source_type, source_id, title, description, category,
       status, sort_order, metadata)
    VALUES
      (p_buyer_user_id, NULL, 'marketplace_copy', v_t.id,
       v_t.title, v_t.description, v_t.category,
       'pending', v_t.sort_order,
       jsonb_build_object('blueprint_id', p_blueprint_id));
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

COMMENT ON FUNCTION public.materialize_marketplace_blueprint(uuid, uuid) IS
  'Copy a marketplace blueprint''s step templates into the buyer''s timeline_steps. Idempotent (per (user_id, source_id)). Gated on active subscription unless called via service role.';

-- Extend get_marketplace_blueprint to return per-step buyer status
CREATE OR REPLACE FUNCTION public.get_marketplace_blueprint(p_blueprint_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bp record;
  v_uid uuid;
  v_steps jsonb;
  v_has_access boolean := false;
  v_subscription jsonb := NULL;
BEGIN
  SELECT b.*,
         COALESCE(NULLIF(trim(u.full_name), ''), 'Independent author') AS author_name,
         o.name AS org_name
  INTO v_bp
  FROM public.blueprints b
  LEFT JOIN public.users u ON u.id = b.author_user_id
  LEFT JOIN public.organizations o ON o.id = b.org_id
  WHERE b.id = p_blueprint_id;

  IF v_bp.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_bp.access_mode <> 'independent' OR v_bp.stripe_price_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_listed');
  END IF;

  v_uid := (SELECT auth.uid());

  IF v_uid IS NOT NULL THEN
    IF v_bp.author_user_id = v_uid THEN
      v_has_access := true;
    ELSIF v_bp.org_id IS NOT NULL AND public.is_org_admin_member(v_bp.org_id) THEN
      v_has_access := true;
    ELSE
      SELECT jsonb_build_object(
        'id', ms.id,
        'status', ms.status,
        'cancel_at_period_end', ms.cancel_at_period_end,
        'current_period_end', ms.current_period_end
      )
      INTO v_subscription
      FROM public.marketplace_subscriptions ms
      WHERE ms.blueprint_id = v_bp.id
        AND ms.buyer_user_id = v_uid
        AND ms.status IN ('active', 'trialing');
      IF v_subscription IS NOT NULL THEN
        v_has_access := true;
      END IF;
    END IF;
  END IF;

  IF v_has_access THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'sort_order', t.sort_order,
        'title', t.title,
        'description', t.description,
        'category', t.category,
        'what_question', t.what_question,
        'buyer_status', ts.status,
        'buyer_step_id', ts.id
      )
      ORDER BY t.sort_order
    )
    INTO v_steps
    FROM public.blueprint_step_templates t
    LEFT JOIN public.timeline_steps ts
      ON ts.source_id = t.id
      AND ts.source_type = 'marketplace_copy'
      AND ts.user_id = v_uid
    WHERE t.blueprint_id = v_bp.id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'blueprint', jsonb_build_object(
      'id', v_bp.id,
      'title', v_bp.title,
      'description', v_bp.description,
      'price_per_seat_cents', v_bp.price_per_seat_cents,
      'billing_cadence', v_bp.billing_cadence,
      'trial_days', v_bp.trial_days,
      'author_name', v_bp.author_name,
      'org_name', v_bp.org_name,
      'stripe_price_id', v_bp.stripe_price_id
    ),
    'has_access', v_has_access,
    'subscription', v_subscription,
    'steps', COALESCE(v_steps, '[]'::jsonb)
  );
END;
$$;
