-- Let authenticated learners subscribe to live independent marketplace blueprints.
--
-- The source-agnostic blueprint_subscriptions INSERT policy previously routed
-- marketplace rows through the institutional/cohort access check. That is
-- correct for assigned institutional blueprints, but free independent listings
-- have no cohort link and should be subscribable by any signed-in learner.

CREATE OR REPLACE FUNCTION public.can_subscribe_to_marketplace_blueprint(p_blueprint_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_author uuid;
BEGIN
  SELECT author_user_id INTO v_author
  FROM public.blueprints
  WHERE id = p_blueprint_id
    AND access_mode = 'independent'
    AND status = 'live'
    AND (
      stripe_price_id IS NOT NULL
      OR COALESCE(price_per_seat_cents, 0) = 0
    );

  IF NOT FOUND THEN RETURN false; END IF;

  -- Author can always subscribe/materialize their own live listing.
  IF v_author = (SELECT auth.uid()) THEN RETURN true; END IF;

  -- Paid listings still require a Stripe-backed active/trialing subscription.
  IF EXISTS (
    SELECT 1
    FROM public.blueprints b
    WHERE b.id = p_blueprint_id
      AND b.stripe_price_id IS NOT NULL
      AND COALESCE(b.price_per_seat_cents, 0) > 0
  ) THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.marketplace_subscriptions ms
      WHERE ms.blueprint_id = p_blueprint_id
        AND ms.buyer_user_id = (SELECT auth.uid())
        AND ms.status IN ('active', 'trialing')
    );
  END IF;

  -- Free independent listings are the marketplace equivalent of "subscribe".
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.can_subscribe_to_marketplace_blueprint(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_subscribe_to_marketplace_blueprint(uuid) TO authenticated;

DROP POLICY IF EXISTS "Subscribe to blueprints" ON public.blueprint_subscriptions;
CREATE POLICY "Subscribe to blueprints" ON public.blueprint_subscriptions
  FOR INSERT
  WITH CHECK (
    subscriber_id = (SELECT auth.uid())
    AND (
      CASE
        WHEN blueprint_system = 'timeline'
          THEN can_subscribe_to_blueprint(blueprint_id)
        WHEN blueprint_system = 'institutional'
          THEN can_subscribe_to_institutional_blueprint(blueprint_id)
        WHEN blueprint_system = 'marketplace'
          THEN can_subscribe_to_marketplace_blueprint(blueprint_id)
        ELSE false
      END
    )
  );
