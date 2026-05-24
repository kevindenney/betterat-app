-- Phase 4w · marketplace blueprint detail RPC
-- Single anon-callable read that powers /marketplace/[id]. Always
-- returns the blueprint metadata for listed independent blueprints;
-- includes the step templates only when the caller has an active
-- subscription, is the author, or is an org admin.

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
        'what_question', t.what_question
      )
      ORDER BY t.sort_order
    )
    INTO v_steps
    FROM public.blueprint_step_templates t
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

GRANT EXECUTE ON FUNCTION public.get_marketplace_blueprint(uuid) TO anon, authenticated;
