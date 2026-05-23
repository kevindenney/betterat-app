-- Phase 4u · marketplace_subscriptions + payout helper RPCs
-- One row per active subscription on an independent blueprint. Bridge
-- between Stripe (subscription + customer) and our domain (blueprint +
-- buyer). Webhook handlers maintain this table; reads stay admin/owner-
-- gated since these are revenue records.

CREATE TABLE IF NOT EXISTS public.marketplace_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES public.blueprints(id) ON DELETE CASCADE,
  buyer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  stripe_subscription_id text UNIQUE,
  stripe_customer_id text,
  stripe_price_id text,
  stripe_checkout_session_id text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('trialing','active','past_due','canceled','incomplete','incomplete_expired','paused','unpaid')),
  unit_amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  cadence text NOT NULL DEFAULT 'monthly'
    CHECK (cadence IN ('monthly','annual','one_time')),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blueprint_id, buyer_user_id)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_subscriptions_buyer
  ON public.marketplace_subscriptions(buyer_user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_subscriptions_author
  ON public.marketplace_subscriptions(author_user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_subscriptions_blueprint
  ON public.marketplace_subscriptions(blueprint_id);

ALTER TABLE public.marketplace_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mps_buyer_self_read" ON public.marketplace_subscriptions;
CREATE POLICY "mps_buyer_self_read"
  ON public.marketplace_subscriptions FOR SELECT
  USING (buyer_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "mps_author_self_read" ON public.marketplace_subscriptions;
CREATE POLICY "mps_author_self_read"
  ON public.marketplace_subscriptions FOR SELECT
  USING (author_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "mps_org_admin_read" ON public.marketplace_subscriptions;
CREATE POLICY "mps_org_admin_read"
  ON public.marketplace_subscriptions FOR SELECT
  USING (org_id IS NOT NULL AND public.is_org_admin_member(org_id));

COMMENT ON TABLE public.marketplace_subscriptions IS
  'One row per active independent-blueprint subscription. Maintained by stripe-webhooks.';

-- Recompute active_seats on org_author_payouts from the live
-- marketplace_subscriptions count so subscribes + cancels both
-- converge.
CREATE OR REPLACE FUNCTION public.bump_author_active_seats(
  p_org_id uuid,
  p_author_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.org_author_payouts oap
  SET active_seats = COALESCE((
    SELECT count(*)::int
    FROM public.marketplace_subscriptions ms
    JOIN public.blueprints b ON b.id = ms.blueprint_id
    WHERE b.author_user_id = p_author_user_id
      AND b.org_id = p_org_id
      AND ms.status IN ('active','trialing')
  ), 0),
  updated_at = now()
  WHERE oap.org_id = p_org_id
    AND oap.author_user_id = p_author_user_id;
END;
$$;

-- Credit an author's earned_ytd by the configured author_payout_pct
-- (default 70%) of a paid amount. Called from the invoice.paid webhook
-- handler.
CREATE OR REPLACE FUNCTION public.credit_author_payout(
  p_org_id uuid,
  p_author_user_id uuid,
  p_amount_cents integer,
  p_author_payout_pct integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pct integer;
  v_credit integer;
BEGIN
  v_pct := COALESCE(p_author_payout_pct, 70);
  v_credit := round(p_amount_cents * (v_pct / 100.0));

  UPDATE public.org_author_payouts
  SET earned_ytd_cents = COALESCE(earned_ytd_cents, 0) + v_credit,
      updated_at = now()
  WHERE org_id = p_org_id AND author_user_id = p_author_user_id;
END;
$$;
