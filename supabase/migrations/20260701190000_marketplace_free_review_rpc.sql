-- Let marketplace reviews work for both Stripe marketplace subscribers and
-- free marketplace subscribers stored in blueprint_subscriptions.

CREATE OR REPLACE FUNCTION public.can_review_marketplace_blueprint(p_blueprint_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.marketplace_subscriptions ms
    WHERE ms.blueprint_id = p_blueprint_id
      AND ms.buyer_user_id = v_uid
      AND ms.status IN ('active', 'trialing')
  )
  OR EXISTS (
    SELECT 1
    FROM public.blueprint_subscriptions bs
    WHERE bs.blueprint_id = p_blueprint_id
      AND bs.subscriber_id = v_uid
      AND bs.blueprint_system = 'marketplace'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.can_review_marketplace_blueprint(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_review_marketplace_blueprint(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_marketplace_blueprint_review(
  p_blueprint_id uuid,
  p_rating integer,
  p_body text DEFAULT NULL
)
RETURNS public.marketplace_blueprint_reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_review public.marketplace_blueprint_reviews;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to write a review' USING ERRCODE = '28000';
  END IF;

  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5' USING ERRCODE = '22023';
  END IF;

  IF NOT public.can_review_marketplace_blueprint(p_blueprint_id) THEN
    RAISE EXCEPTION 'Subscribe before reviewing this blueprint' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.marketplace_blueprint_reviews (
    blueprint_id,
    reviewer_user_id,
    rating,
    body,
    updated_at
  )
  VALUES (
    p_blueprint_id,
    v_uid,
    p_rating,
    NULLIF(trim(p_body), ''),
    now()
  )
  ON CONFLICT (blueprint_id, reviewer_user_id)
  DO UPDATE SET
    rating = EXCLUDED.rating,
    body = EXCLUDED.body,
    updated_at = now()
  RETURNING * INTO v_review;

  RETURN v_review;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_marketplace_blueprint_review(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_marketplace_blueprint_review(uuid, integer, text) TO authenticated;

DROP POLICY IF EXISTS "reviews_subscriber_insert" ON public.marketplace_blueprint_reviews;
CREATE POLICY "reviews_subscriber_insert"
  ON public.marketplace_blueprint_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    reviewer_user_id = (SELECT auth.uid())
    AND public.can_review_marketplace_blueprint(blueprint_id)
  );

DROP POLICY IF EXISTS "reviews_self_update" ON public.marketplace_blueprint_reviews;
CREATE POLICY "reviews_self_update"
  ON public.marketplace_blueprint_reviews
  FOR UPDATE
  TO authenticated
  USING (reviewer_user_id = (SELECT auth.uid()))
  WITH CHECK (
    reviewer_user_id = (SELECT auth.uid())
    AND public.can_review_marketplace_blueprint(blueprint_id)
  );
