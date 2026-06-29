-- Studio · Subscriber roster for the signed-in author.
--
-- Creator Studio's Subscribers tab lists the people subscribed to the blueprints
-- this author owns. Those rows live in marketplace_subscriptions, which the
-- author can read (mps_author_self_read) — but the subscriber's *identity*
-- (profiles row) isn't guaranteed readable through profiles RLS for someone the
-- author doesn't follow. This SECURITY DEFINER RPC sidesteps that: it keys off
-- auth.uid() = blueprints.author_user_id, so an author always sees who is
-- subscribed to what they wrote, and never anyone else's roster.
--
-- One row per (subscriber, blueprint) active/trialing subscription, newest
-- first. The client groups by buyer to render one card per person.

CREATE OR REPLACE FUNCTION public.studio_author_subscribers(p_limit int DEFAULT 200)
RETURNS TABLE (
  buyer_user_id uuid,
  buyer_name text,
  buyer_avatar_url text,
  blueprint_id uuid,
  blueprint_title text,
  status text,
  cadence text,
  unit_amount_cents int,
  currency text,
  subscribed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  ORDER BY ms.created_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.studio_author_subscribers(int) TO authenticated;
