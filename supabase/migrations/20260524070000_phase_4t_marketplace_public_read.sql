-- Phase 4t · public marketplace surface
-- Adds a public-read RLS policy for listed independent blueprints and
-- an anon-callable RPC that returns the catalog payload the
-- /marketplace surface paints. Independent + stripe_price_id-set rows
-- are intentionally public; everything else stays org-gated.

DROP POLICY IF EXISTS "blueprints_marketplace_public_read" ON public.blueprints;
CREATE POLICY "blueprints_marketplace_public_read"
  ON public.blueprints FOR SELECT
  TO anon, authenticated
  USING (
    access_mode = 'independent'
    AND stripe_price_id IS NOT NULL
  );

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
      'created_at', b.created_at
    )
    ORDER BY b.created_at DESC
  ) INTO v_rows
  FROM public.blueprints b
  LEFT JOIN public.users u ON u.id = b.author_user_id
  LEFT JOIN public.organizations o ON o.id = b.org_id
  WHERE b.access_mode = 'independent'
    AND b.stripe_price_id IS NOT NULL;

  RETURN jsonb_build_object(
    'ok', true,
    'blueprints', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_marketplace_blueprints() TO anon, authenticated;

COMMENT ON FUNCTION public.list_marketplace_blueprints() IS
  'Public marketplace catalog. Returns independent + Stripe-listed blueprints with denormalized author and org names.';
