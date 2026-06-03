-- Unify the marketplace discovery read across both blueprint systems.
--
-- The marketplace/interest-page Blueprints surface only read System B
-- (public.blueprints: Studio-authored, Stripe-listed). Coach-curated plans
-- authored directly as timeline_blueprints (e.g. the Dragon Worlds prep) were
-- invisible there, even when published and public.
--
-- This redefines list_marketplace_blueprints to UNION both sources into the
-- same row shape, tagging each with `source` ('marketplace' | 'timeline') and
-- `slug` so the client can route a card to the right detail surface:
--   marketplace → /marketplace/{id}  (Stripe checkout + reviews)
--   timeline    → /blueprint/{slug}  (subscribe CTA on the public blueprint page)
--
-- This is a read-layer union only: the two tables remain physically separate
-- (System B still backs Studio authoring + Stripe; System A backs adoption).

DROP FUNCTION IF EXISTS public.list_marketplace_blueprints(uuid);

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
  WITH listed AS (
    -- System B · Studio-authored, Stripe-listed independent blueprints
    SELECT
      b.id,
      b.slug,
      b.title,
      b.description,
      COALESCE(b.price_per_seat_cents, 0)       AS price_per_seat_cents,
      COALESCE(b.billing_cadence, 'monthly')    AS billing_cadence,
      COALESCE(b.trial_days, 0)                 AS trial_days,
      b.stripe_price_id,
      b.author_user_id,
      b.org_id                                  AS organization_id,
      b.interest_id,
      b.created_at,
      COALESCE(b.is_featured, false)            AS is_featured,
      b.featured_rank,
      b.featured_blurb,
      rv.avg                                    AS rating_avg,
      COALESCE(rv.cnt, 0)                       AS rating_count,
      COALESCE(sub.cnt, 0)                      AS active_subscriber_count,
      'marketplace'::text                       AS source
    FROM public.blueprints b
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

    UNION ALL

    -- System A · coach/fleet-authored timeline blueprints, published + public
    SELECT
      tb.id,
      tb.slug,
      tb.title,
      tb.description,
      COALESCE(tb.price_cents, 0)               AS price_per_seat_cents,
      CASE
        WHEN tb.pricing_type IN ('monthly', 'annual', 'one_time') THEN tb.pricing_type
        WHEN tb.pricing_type IN ('recurring', 'subscription')      THEN 'monthly'
        ELSE 'one_time'
      END                                       AS billing_cadence,
      0                                         AS trial_days,
      tb.stripe_price_id,
      tb.user_id                                AS author_user_id,
      tb.organization_id,
      tb.interest_id,
      tb.created_at,
      false                                     AS is_featured,
      NULL::int                                 AS featured_rank,
      NULL::text                                AS featured_blurb,
      NULL::numeric                             AS rating_avg,
      0                                         AS rating_count,
      COALESCE(tb.subscriber_count, 0)          AS active_subscriber_count,
      'timeline'::text                          AS source
    FROM public.timeline_blueprints tb
    WHERE tb.is_published = true
      AND tb.access_level IN ('public', 'paid')
      AND (p_interest_id IS NULL OR tb.interest_id = p_interest_id)
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', l.id,
      'slug', l.slug,
      'source', l.source,
      'title', l.title,
      'description', l.description,
      'price_per_seat_cents', l.price_per_seat_cents,
      'billing_cadence', l.billing_cadence,
      'trial_days', l.trial_days,
      'stripe_price_id', l.stripe_price_id,
      'author_user_id', l.author_user_id,
      'author_name', COALESCE(NULLIF(trim(u.full_name), ''), 'Independent author'),
      'author_initials', upper(COALESCE(
        substr(NULLIF(trim(u.full_name), ''), 1, 1) ||
          substr(split_part(NULLIF(trim(u.full_name), ''), ' ', 2), 1, 1),
        substr(u.email, 1, 2),
        'AU'
      )),
      'author_tone',
        (ARRAY['navy','brown','warm','green','purple'])[
          1 + (abs(hashtext(l.author_user_id::text)) % 5)
        ],
      'author_bio', u.bio,
      'org_name', o.name,
      'interest_id', l.interest_id,
      'interest_name', i.name,
      'interest_slug', i.slug,
      'created_at', l.created_at,
      'is_featured', l.is_featured,
      'featured_rank', l.featured_rank,
      'featured_blurb', l.featured_blurb,
      'rating_avg', l.rating_avg,
      'rating_count', l.rating_count,
      'active_subscriber_count', l.active_subscriber_count
    )
    ORDER BY l.is_featured DESC, l.created_at DESC
  ) INTO v_rows
  FROM listed l
  LEFT JOIN public.users u ON u.id = l.author_user_id
  LEFT JOIN public.organizations o ON o.id = l.organization_id
  LEFT JOIN public.interests i ON i.id = l.interest_id;

  RETURN jsonb_build_object(
    'ok', true,
    'blueprints', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_marketplace_blueprints(uuid) TO anon, authenticated;
