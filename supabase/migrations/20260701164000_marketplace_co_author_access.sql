-- Marketplace detail should treat cover-credit co-authors as author-side access.
-- They can inspect the full listing/steps without seeing buyer subscription UI.

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
  v_viewer_role text := NULL;
  v_subscription jsonb := NULL;
  v_my_review jsonb := NULL;
  v_reviews jsonb := '[]'::jsonb;
  v_rating_avg numeric;
  v_rating_count integer;
  v_paid_subscriber_count integer;
  v_free_subscriber_count integer;
BEGIN
  SELECT b.*,
         COALESCE(NULLIF(trim(u.full_name), ''), 'Independent author') AS author_name,
         u.bio AS author_bio,
         o.name AS org_name
  INTO v_bp
  FROM public.blueprints b
  LEFT JOIN public.users u ON u.id = b.author_user_id
  LEFT JOIN public.organizations o ON o.id = b.org_id
  WHERE b.id = p_blueprint_id;

  IF v_bp.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_bp.access_mode <> 'independent'
    OR v_bp.status <> 'live'
    OR (v_bp.stripe_price_id IS NULL AND COALESCE(v_bp.price_per_seat_cents, 0) > 0)
  THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_listed');
  END IF;

  v_uid := (SELECT auth.uid());

  IF v_uid IS NOT NULL THEN
    IF v_bp.author_user_id = v_uid THEN
      v_has_access := true;
      v_viewer_role := 'primary_author';
    ELSIF EXISTS (
      SELECT 1
      FROM public.blueprint_authors ba
      WHERE ba.blueprint_id = v_bp.id
        AND ba.user_id = v_uid
    ) THEN
      v_has_access := true;
      v_viewer_role := 'co_author';
    ELSIF v_bp.org_id IS NOT NULL AND public.is_org_admin_member(v_bp.org_id) THEN
      v_has_access := true;
      v_viewer_role := 'org_admin';
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

      IF v_subscription IS NULL THEN
        SELECT jsonb_build_object(
          'id', bs.id,
          'status', 'active',
          'cancel_at_period_end', false,
          'current_period_end', NULL
        )
        INTO v_subscription
        FROM public.blueprint_subscriptions bs
        WHERE bs.blueprint_id = v_bp.id
          AND bs.subscriber_id = v_uid
          AND bs.blueprint_system = 'marketplace';
      END IF;

      IF v_subscription IS NOT NULL THEN
        v_has_access := true;
        v_viewer_role := 'subscriber';
      END IF;
    END IF;
  END IF;

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

  SELECT count(*)
  INTO v_paid_subscriber_count
  FROM public.marketplace_subscriptions
  WHERE blueprint_id = v_bp.id
    AND status IN ('active', 'trialing');

  SELECT count(*)
  INTO v_free_subscriber_count
  FROM public.blueprint_subscriptions
  WHERE blueprint_id = v_bp.id
    AND blueprint_system = 'marketplace';

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
      'price_per_seat_cents', COALESCE(v_bp.price_per_seat_cents, 0),
      'billing_cadence', v_bp.billing_cadence,
      'trial_days', v_bp.trial_days,
      'author_user_id', v_bp.author_user_id,
      'author_name', v_bp.author_name,
      'author_bio', v_bp.author_bio,
      'org_name', v_bp.org_name,
      'stripe_price_id', v_bp.stripe_price_id,
      'rating_avg', v_rating_avg,
      'rating_count', COALESCE(v_rating_count, 0),
      'active_subscriber_count',
        COALESCE(v_paid_subscriber_count, 0) + COALESCE(v_free_subscriber_count, 0)
    ),
    'has_access', v_has_access,
    'viewer_role', v_viewer_role,
    'subscription', v_subscription,
    'steps', COALESCE(v_steps, '[]'::jsonb),
    'reviews', COALESCE(v_reviews, '[]'::jsonb),
    'my_review', v_my_review
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_marketplace_blueprint(uuid) TO anon, authenticated;
