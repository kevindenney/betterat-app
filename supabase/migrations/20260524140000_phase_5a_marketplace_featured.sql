-- Phase 5a · marketplace featured rail
-- Hand-curated featured slot on /marketplace. Admins flip blueprints
-- on; the catalog surface bubbles featured rows above the regular
-- grid sorted by featured_rank.

ALTER TABLE public.blueprints
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_rank integer,
  ADD COLUMN IF NOT EXISTS featured_blurb text;

CREATE INDEX IF NOT EXISTS idx_blueprints_featured
  ON public.blueprints(featured_rank)
  WHERE is_featured = true;

CREATE OR REPLACE FUNCTION public.list_marketplace_blueprints()
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
      'org_name', o.name,
      'created_at', b.created_at,
      'rating_avg', rv.avg,
      'rating_count', COALESCE(rv.cnt, 0),
      'is_featured', b.is_featured,
      'featured_rank', b.featured_rank,
      'featured_blurb', b.featured_blurb
    )
    ORDER BY b.is_featured DESC, COALESCE(b.featured_rank, 999), b.created_at DESC
  ) INTO v_rows
  FROM public.blueprints b
  LEFT JOIN public.users u ON u.id = b.author_user_id
  LEFT JOIN public.organizations o ON o.id = b.org_id
  LEFT JOIN LATERAL (
    SELECT round(avg(rating)::numeric, 2) AS avg, count(*)::int AS cnt
    FROM public.marketplace_blueprint_reviews r
    WHERE r.blueprint_id = b.id
  ) rv ON true
  WHERE b.access_mode = 'independent'
    AND b.stripe_price_id IS NOT NULL;

  RETURN jsonb_build_object(
    'ok', true,
    'blueprints', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;
