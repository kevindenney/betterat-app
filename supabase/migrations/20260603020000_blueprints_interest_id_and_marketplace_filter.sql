-- Interest dimension for the blueprint catalog.
--
-- System B public.blueprints had no interest column — it was org/category
-- scoped only. That left the Stripe-enabled marketplace disconnected from
-- the per-interest discovery surfaces (the dynamic /[interest] pages, Library).
-- This adds interest_id so authored blueprints can be browsed under the
-- interest a learner is working on, backfills the existing marketplace rows,
-- and threads interest_id/interest_name + an optional interest filter through
-- list_marketplace_blueprints so a surface can ask for "drawing plans" only.

ALTER TABLE public.blueprints
  ADD COLUMN IF NOT EXISTS interest_id uuid REFERENCES public.interests(id);

CREATE INDEX IF NOT EXISTS idx_blueprints_interest ON public.blueprints(interest_id);

-- Backfill known rows so the catalog isn't empty.
UPDATE public.blueprints
  SET interest_id = (SELECT id FROM public.interests WHERE slug = 'drawing')
  WHERE id = 'bc363132-b317-4d76-a8cd-18eb87623895'
    AND interest_id IS NULL;

UPDATE public.blueprints
  SET interest_id = (SELECT id FROM public.interests WHERE slug = 'nursing')
  WHERE interest_id IS NULL
    AND (
      org_id = '678e149e-2abb-422c-ac61-b76756a2150e'
      OR id IN (
        'b2a00002-2222-4002-8002-000000000002',
        'b1a00001-1111-4001-8001-000000000001'
      )
    );

-- Single overload with an optional interest filter (drop the no-arg version
-- first so an argless rpc() call resolves unambiguously to this one).
DROP FUNCTION IF EXISTS public.list_marketplace_blueprints();

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
    AND (p_interest_id IS NULL OR b.interest_id = p_interest_id);

  RETURN jsonb_build_object(
    'ok', true,
    'blueprints', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_marketplace_blueprints(uuid) TO anon, authenticated;
