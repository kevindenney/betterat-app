-- The Studio Subscribers roster (and the count derived from it) only read
-- marketplace_subscriptions — the Stripe payment record. Institutional /
-- timeline subscriptions live in blueprint_subscriptions and were invisible,
-- so a learner who subscribed to an institutional blueprint ("test") never
-- appeared and the author saw "No subscribers yet". UNION both sources.
CREATE OR REPLACE FUNCTION public.studio_author_subscribers(p_limit integer DEFAULT 200)
RETURNS TABLE(
  buyer_user_id uuid,
  buyer_name text,
  buyer_avatar_url text,
  blueprint_id uuid,
  blueprint_title text,
  status text,
  cadence text,
  unit_amount_cents integer,
  currency text,
  subscribed_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Marketplace (paid) subscribers — Stripe-backed, carry pricing fields.
  SELECT
    ms.buyer_user_id,
    pp.full_name AS buyer_name,
    pp.avatar_url AS buyer_avatar_url,
    ms.blueprint_id,
    bp.title AS blueprint_title,
    ms.status,
    ms.cadence,
    ms.unit_amount_cents::int,
    ms.currency,
    ms.created_at AS subscribed_at
  FROM public.marketplace_subscriptions ms
  JOIN public.blueprints bp ON bp.id = ms.blueprint_id
  LEFT JOIN public.profiles pp ON pp.id = ms.buyer_user_id
  WHERE bp.author_user_id = auth.uid()
    AND ms.status IN ('active', 'trialing')

  UNION ALL

  -- Institutional / timeline-on-blueprints subscribers — relationship rows in
  -- blueprint_subscriptions. No payment, so pricing fields are null. Only
  -- non-timeline systems point at public.blueprints (timeline ids live in
  -- timeline_blueprints, a different author surface).
  SELECT
    bs.subscriber_id AS buyer_user_id,
    pp.full_name AS buyer_name,
    pp.avatar_url AS buyer_avatar_url,
    bs.blueprint_id,
    bp.title AS blueprint_title,
    bs.subscription_status AS status,
    NULL::text AS cadence,
    NULL::int AS unit_amount_cents,
    NULL::text AS currency,
    bs.subscribed_at
  FROM public.blueprint_subscriptions bs
  JOIN public.blueprints bp ON bp.id = bs.blueprint_id
  LEFT JOIN public.profiles pp ON pp.id = bs.subscriber_id
  WHERE bp.author_user_id = auth.uid()
    AND bs.blueprint_system <> 'timeline'
    AND bs.subscription_status = 'active'

  ORDER BY subscribed_at DESC
  LIMIT p_limit;
$function$;
