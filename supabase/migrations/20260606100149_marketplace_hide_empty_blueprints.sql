-- Hide empty blueprints from the marketplace storefront.
--
-- list_marketplace_blueprints listed every independent, Stripe-enabled
-- blueprint regardless of whether it had any authored steps. 15 of 24 live
-- rows had zero step templates, so most storefront cards led to a detail page
-- with nothing to preview — it read as "subscribe is your only option."
--
-- A storefront listing should require something to look at. This adds an
-- EXISTS guard on blueprint_step_templates so 0-step blueprints drop out of
-- the catalog until their author publishes steps. The detail page still
-- handles a direct link to an empty blueprint gracefully ("author is still
-- drafting"); this only affects what the storefront surfaces.

CREATE OR REPLACE FUNCTION public.list_marketplace_blueprints(p_interest_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', b.id,
      'title', b.title,
      'description', b.description,
      'price_per_seat_cents', b.price_per_seat_cents,
      'billing_cadence', b.billing_cadence,
      'trial_days', b.trial_days,
      'stripe_price_id', b.stripe_price_id,
      'author_user_id', b.author_user_id,
      'author_name', COALESCE(NULLIF(trim(u.full_name), ''), 'Independent author'),
      'author_initials', upper(COALESCE(
        substr(NULLIF(trim(u.full_name), ''), 1, 1) ||
          substr(split_part(NULLIF(trim(u.full_name), ''), ' ', 2), 1, 1),
        substr(u.email, 1, 2),
        'AU'
      )),
      'author_tone',
        (ARRAY['navy','brown','warm','green','purple'])[
          1 + (abs(hashtext(b.author_user_id::text)) % 5)
        ],
      'author_bio', u.bio,
      'org_name', o.name,
      'interest_id', b.interest_id,
      'interest_name', i.name,
      'interest_slug', i.slug,
      'created_at', b.created_at,
      'is_featured', COALESCE(b.is_featured, false),
      'featured_rank', b.featured_rank,
      'featured_blurb', b.featured_blurb,
      'rating_avg', rv.avg,
      'rating_count', COALESCE(rv.cnt, 0),
      'active_subscriber_count', COALESCE(sub.cnt, 0)
    )
    ORDER BY b.created_at DESC
  ) INTO v_rows
  FROM public.blueprints b
  LEFT JOIN public.users u ON u.id = b.author_user_id
  LEFT JOIN public.organizations o ON o.id = b.org_id
  LEFT JOIN public.interests i ON i.id = b.interest_id
  LEFT JOIN LATERAL (
    SELECT round(avg(rating)::numeric, 2) AS avg, count(*)::int AS cnt
    FROM public.marketplace_blueprint_reviews r
    WHERE r.blueprint_id = b.id
  ) rv ON true
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS cnt
    FROM public.marketplace_subscriptions ms
    WHERE ms.blueprint_id = b.id
      AND ms.status IN ('active', 'trialing')
  ) sub ON true
  WHERE b.access_mode = 'independent'
    AND b.stripe_price_id IS NOT NULL
    AND (p_interest_id IS NULL OR b.interest_id = p_interest_id)
    AND EXISTS (
      SELECT 1 FROM public.blueprint_step_templates t
      WHERE t.blueprint_id = b.id
    );

  RETURN jsonb_build_object(
    'ok', true,
    'blueprints', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_marketplace_blueprints(uuid) TO anon, authenticated;
