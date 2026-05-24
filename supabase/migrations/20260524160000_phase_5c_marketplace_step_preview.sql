-- Phase 5c · marketplace detail step previews for non-subscribers
--
-- Before this migration, the steps array on get_marketplace_blueprint
-- was only populated when the caller had access (subscription, author,
-- or org admin). Non-subscribers landing on /marketplace/[id] saw a
-- single "Subscribe to see the full step list" placeholder with no
-- shape of what was inside — which undersells a real curriculum.
--
-- This migration lifts the gate on step *titles + category + order*
-- (the shape of the curriculum). Descriptions and what_questions
-- remain access-gated. The frontend renders a locked-preview list of
-- titled, ordered steps for non-subscribers — buyers see they're
-- getting a real, structured playbook before they pay.

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
  v_my_review jsonb := NULL;
  v_reviews jsonb := '[]'::jsonb;
  v_rating_avg numeric;
  v_rating_count integer;
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

  -- Titles + category + order are ALWAYS returned (curriculum shape).
  -- Description + what_question only when v_has_access is true.
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'sort_order', t.sort_order,
      'title', t.title,
      'description', CASE WHEN v_has_access THEN t.description ELSE NULL END,
      'category', t.category,
      'what_question', CASE WHEN v_has_access THEN t.what_question ELSE NULL END,
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

  SELECT round(avg(rating)::numeric, 2), count(*)
  INTO v_rating_avg, v_rating_count
  FROM public.marketplace_blueprint_reviews
  WHERE blueprint_id = v_bp.id;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'rating', r.rating,
      'body', r.body,
      'created_at', r.created_at,
      'reviewer_user_id', r.reviewer_user_id,
      'reviewer_name', COALESCE(NULLIF(trim(ru.full_name), ''), 'Subscriber'),
      'reviewer_initials', upper(COALESCE(
        substr(NULLIF(trim(ru.full_name), ''), 1, 1) ||
          substr(split_part(NULLIF(trim(ru.full_name), ''), ' ', 2), 1, 1),
        substr(ru.email, 1, 2),
        'SB'
      )),
      'is_mine', (v_uid IS NOT NULL AND r.reviewer_user_id = v_uid)
    )
    ORDER BY r.created_at DESC
  )
  INTO v_reviews
  FROM (
    SELECT * FROM public.marketplace_blueprint_reviews
    WHERE blueprint_id = v_bp.id
    ORDER BY created_at DESC
    LIMIT 8
  ) r
  LEFT JOIN public.users ru ON ru.id = r.reviewer_user_id;

  IF v_uid IS NOT NULL THEN
    SELECT jsonb_build_object('id', r.id, 'rating', r.rating, 'body', r.body, 'created_at', r.created_at)
    INTO v_my_review
    FROM public.marketplace_blueprint_reviews r
    WHERE r.blueprint_id = v_bp.id AND r.reviewer_user_id = v_uid;
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
      'stripe_price_id', v_bp.stripe_price_id,
      'rating_avg', v_rating_avg,
      'rating_count', COALESCE(v_rating_count, 0)
    ),
    'has_access', v_has_access,
    'subscription', v_subscription,
    'steps', COALESCE(v_steps, '[]'::jsonb),
    'reviews', COALESCE(v_reviews, '[]'::jsonb),
    'my_review', v_my_review
  );
END;
$$;
