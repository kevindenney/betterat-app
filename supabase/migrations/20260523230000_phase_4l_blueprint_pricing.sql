-- Phase 4l · blueprint pricing & access columns
-- Extend public.blueprints with the fields the Pricing & access sub-tab
-- needs to persist: access_mode, per-seat price cents, billing cadence,
-- author payout %, trial days, cohort scope.

ALTER TABLE public.blueprints
  ADD COLUMN IF NOT EXISTS access_mode text NOT NULL DEFAULT 'institutional'
    CHECK (access_mode IN ('institutional','independent')),
  ADD COLUMN IF NOT EXISTS price_per_seat_cents integer,
  ADD COLUMN IF NOT EXISTS billing_cadence text DEFAULT 'monthly'
    CHECK (billing_cadence IS NULL OR billing_cadence IN ('monthly','annual','one_time')),
  ADD COLUMN IF NOT EXISTS author_payout_pct integer DEFAULT 70
    CHECK (author_payout_pct IS NULL OR (author_payout_pct BETWEEN 0 AND 100)),
  ADD COLUMN IF NOT EXISTS trial_days integer DEFAULT 7
    CHECK (trial_days IS NULL OR trial_days >= 0),
  ADD COLUMN IF NOT EXISTS cohort_scope text NOT NULL DEFAULT 'specific'
    CHECK (cohort_scope IN ('all','specific'));

DROP POLICY IF EXISTS "blueprints_author_or_admin_update" ON public.blueprints;
CREATE POLICY "blueprints_author_or_admin_update"
  ON public.blueprints FOR UPDATE
  USING (
    author_user_id = (SELECT auth.uid())
    OR public.is_org_admin_member(org_id)
  )
  WITH CHECK (
    author_user_id = (SELECT auth.uid())
    OR public.is_org_admin_member(org_id)
  );
