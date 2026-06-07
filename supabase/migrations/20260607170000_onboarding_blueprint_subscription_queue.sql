-- Queue org-member blueprint subscription requests made during signup.
--
-- A newly-created user may open an org-member blueprint link before their
-- organization_memberships row exists or is active. Direct inserts into
-- blueprint_subscriptions are correctly blocked by can_subscribe_to_blueprint().
-- This migration gives signup a SECURITY DEFINER RPC that can record that
-- intent, then fulfills it automatically when membership becomes active.

BEGIN;

CREATE TABLE IF NOT EXISTS public.pending_blueprint_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES public.timeline_blueprints(id) ON DELETE CASCADE,
  subscriber_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  fulfilled_at timestamptz NULL,
  status text NOT NULL DEFAULT 'pending_org_membership'
    CHECK (status IN ('pending_org_membership', 'fulfilled', 'not_allowed')),
  last_error text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (blueprint_id, subscriber_id)
);

CREATE INDEX IF NOT EXISTS idx_pending_blueprint_subs_subscriber
  ON public.pending_blueprint_subscriptions(subscriber_id)
  WHERE fulfilled_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pending_blueprint_subs_blueprint
  ON public.pending_blueprint_subscriptions(blueprint_id)
  WHERE fulfilled_at IS NULL;

ALTER TABLE public.pending_blueprint_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pending_blueprint_subscriptions_read_own" ON public.pending_blueprint_subscriptions;
CREATE POLICY "pending_blueprint_subscriptions_read_own"
  ON public.pending_blueprint_subscriptions FOR SELECT
  USING (subscriber_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "pending_blueprint_subscriptions_delete_own" ON public.pending_blueprint_subscriptions;
CREATE POLICY "pending_blueprint_subscriptions_delete_own"
  ON public.pending_blueprint_subscriptions FOR DELETE
  USING (subscriber_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.fulfill_pending_org_blueprint_subscriptions(
  p_subscriber_id uuid,
  p_org_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF p_subscriber_id IS NULL OR p_org_id IS NULL THEN
    RETURN 0;
  END IF;

  WITH eligible AS (
    SELECT p.id, p.blueprint_id, p.subscriber_id
    FROM public.pending_blueprint_subscriptions p
    JOIN public.timeline_blueprints b ON b.id = p.blueprint_id
    WHERE p.subscriber_id = p_subscriber_id
      AND p.fulfilled_at IS NULL
      AND p.status = 'pending_org_membership'
      AND b.organization_id = p_org_id
      AND b.access_level = 'org_members'
      AND b.is_published = true
  ),
  subscribed AS (
    INSERT INTO public.blueprint_subscriptions (
      blueprint_id,
      subscriber_id,
      subscribed_at,
      last_synced_at,
      subscription_status
    )
    SELECT
      e.blueprint_id,
      e.subscriber_id,
      now(),
      now(),
      'active'
    FROM eligible e
    ON CONFLICT (blueprint_id, subscriber_id)
    DO UPDATE SET
      last_synced_at = EXCLUDED.last_synced_at,
      subscription_status = 'active'
    RETURNING blueprint_id, subscriber_id
  ),
  fulfilled AS (
    UPDATE public.pending_blueprint_subscriptions p
    SET
      fulfilled_at = now(),
      status = 'fulfilled',
      last_error = NULL
    FROM eligible e
    WHERE p.id = e.id
      AND EXISTS (
        SELECT 1
        FROM subscribed s
        WHERE s.blueprint_id = e.blueprint_id
          AND s.subscriber_id = e.subscriber_id
      )
    RETURNING p.id
  )
  SELECT count(*) INTO v_count FROM fulfilled;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.fulfill_pending_org_blueprint_subscriptions(uuid, uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.request_onboarding_blueprint_subscription(
  p_blueprint_ref text,
  p_subscriber_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_ref text := btrim(COALESCE(p_blueprint_ref, ''));
  v_subscriber_id uuid := COALESCE(p_subscriber_id, (SELECT auth.uid()));
  v_blueprint public.timeline_blueprints%ROWTYPE;
  v_subscription_id uuid;
  v_pending_id uuid;
  v_is_active_org_member boolean := false;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('status', 'no-auth');
  END IF;

  IF v_subscriber_id IS NULL OR v_subscriber_id <> v_actor THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  IF v_ref = '' THEN
    RETURN jsonb_build_object('status', 'no-ref');
  END IF;

  IF v_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT *
    INTO v_blueprint
    FROM public.timeline_blueprints
    WHERE id = v_ref::uuid
      AND is_published = true;
  ELSE
    SELECT *
    INTO v_blueprint
    FROM public.timeline_blueprints
    WHERE slug = v_ref
      AND is_published = true;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not-found');
  END IF;

  IF v_blueprint.user_id = v_subscriber_id
    OR v_blueprint.access_level = 'public'
    OR (v_blueprint.access_level = 'fleet' AND v_blueprint.fleet_id IS NULL)
  THEN
    INSERT INTO public.blueprint_subscriptions (
      blueprint_id,
      subscriber_id,
      subscribed_at,
      last_synced_at,
      subscription_status
    )
    VALUES (
      v_blueprint.id,
      v_subscriber_id,
      now(),
      now(),
      'active'
    )
    ON CONFLICT (blueprint_id, subscriber_id)
    DO UPDATE SET
      last_synced_at = EXCLUDED.last_synced_at,
      subscription_status = 'active'
    RETURNING id INTO v_subscription_id;

    RETURN jsonb_build_object(
      'status', 'subscribed',
      'blueprint_id', v_blueprint.id,
      'subscription_id', v_subscription_id
    );
  END IF;

  IF v_blueprint.access_level = 'org_members' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.organization_memberships om
      WHERE om.organization_id = v_blueprint.organization_id
        AND om.user_id = v_subscriber_id
        AND COALESCE(om.membership_status, om.status) = 'active'
    ) INTO v_is_active_org_member;

    IF v_is_active_org_member THEN
      INSERT INTO public.blueprint_subscriptions (
        blueprint_id,
        subscriber_id,
        subscribed_at,
        last_synced_at,
        subscription_status
      )
      VALUES (
        v_blueprint.id,
        v_subscriber_id,
        now(),
        now(),
        'active'
      )
      ON CONFLICT (blueprint_id, subscriber_id)
      DO UPDATE SET
        last_synced_at = EXCLUDED.last_synced_at,
        subscription_status = 'active'
      RETURNING id INTO v_subscription_id;

      RETURN jsonb_build_object(
        'status', 'subscribed',
        'blueprint_id', v_blueprint.id,
        'subscription_id', v_subscription_id
      );
    END IF;

    INSERT INTO public.pending_blueprint_subscriptions (
      blueprint_id,
      subscriber_id,
      status,
      metadata
    )
    VALUES (
      v_blueprint.id,
      v_subscriber_id,
      'pending_org_membership',
      jsonb_build_object('source', 'signup')
    )
    ON CONFLICT (blueprint_id, subscriber_id)
    DO UPDATE SET
      requested_at = now(),
      status = 'pending_org_membership',
      fulfilled_at = NULL,
      last_error = NULL,
      metadata = COALESCE(public.pending_blueprint_subscriptions.metadata, '{}'::jsonb)
        || jsonb_build_object('source', 'signup')
    RETURNING id INTO v_pending_id;

    RETURN jsonb_build_object(
      'status', 'pending-org-membership',
      'blueprint_id', v_blueprint.id,
      'pending_id', v_pending_id,
      'organization_id', v_blueprint.organization_id
    );
  END IF;

  IF v_blueprint.access_level = 'paid' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.organization_memberships om
      WHERE om.organization_id = v_blueprint.organization_id
        AND om.user_id = v_subscriber_id
        AND COALESCE(om.membership_status, om.status) = 'active'
    ) INTO v_is_active_org_member;

    IF v_is_active_org_member THEN
      INSERT INTO public.blueprint_subscriptions (
        blueprint_id,
        subscriber_id,
        subscribed_at,
        last_synced_at,
        subscription_status
      )
      VALUES (
        v_blueprint.id,
        v_subscriber_id,
        now(),
        now(),
        'active'
      )
      ON CONFLICT (blueprint_id, subscriber_id)
      DO UPDATE SET
        last_synced_at = EXCLUDED.last_synced_at,
        subscription_status = 'active'
      RETURNING id INTO v_subscription_id;

      RETURN jsonb_build_object(
        'status', 'subscribed',
        'blueprint_id', v_blueprint.id,
        'subscription_id', v_subscription_id
      );
    END IF;

    RETURN jsonb_build_object(
      'status', 'requires-purchase',
      'blueprint_id', v_blueprint.id
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'not-allowed',
    'blueprint_id', v_blueprint.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_onboarding_blueprint_subscription(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_onboarding_blueprint_subscription(text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.organization_memberships_fulfill_pending_blueprints()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.membership_status, NEW.status) = 'active' THEN
    PERFORM public.fulfill_pending_org_blueprint_subscriptions(
      NEW.user_id,
      NEW.organization_id
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.organization_memberships_fulfill_pending_blueprints() FROM PUBLIC;

DROP TRIGGER IF EXISTS organization_memberships_fulfill_pending_blueprints
  ON public.organization_memberships;
CREATE TRIGGER organization_memberships_fulfill_pending_blueprints
  AFTER INSERT OR UPDATE OF status, membership_status, is_verified
  ON public.organization_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.organization_memberships_fulfill_pending_blueprints();

COMMENT ON TABLE public.pending_blueprint_subscriptions IS
  'Signup-time requests for org-member blueprints that cannot be subscribed until organization membership becomes active.';

COMMENT ON FUNCTION public.request_onboarding_blueprint_subscription(text, uuid) IS
  'Resolve a signup blueprint slug/UUID behind RLS. Subscribes immediately when allowed, otherwise queues org-member requests until membership activation.';

COMMIT;
