-- business_outcomes: per-week revenue/sales metrics for entrepreneurial plans
-- (SHG / Pitroda demo). One row per (user, plan, week). revenue_minor is the
-- smallest currency unit (paise for INR). Public discovery read is gated on the
-- same profile flags as the portfolio RPCs so /p/[userId] can surface a trend.

CREATE TABLE IF NOT EXISTS public.business_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  units_sold integer NOT NULL DEFAULT 0 CHECK (units_sold >= 0),
  revenue_minor bigint NOT NULL DEFAULT 0 CHECK (revenue_minor >= 0),
  currency text NOT NULL DEFAULT 'INR',
  customer_count integer NOT NULL DEFAULT 0 CHECK (customer_count >= 0),
  repeat_count integer NOT NULL DEFAULT 0 CHECK (repeat_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_outcomes_repeat_le_customer CHECK (repeat_count <= customer_count),
  UNIQUE (user_id, plan_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_business_outcomes_user_week
  ON public.business_outcomes(user_id, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_business_outcomes_plan_week
  ON public.business_outcomes(plan_id, week_start DESC);

ALTER TABLE public.business_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_outcomes_self_all ON public.business_outcomes;
CREATE POLICY business_outcomes_self_all
  ON public.business_outcomes
  FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS business_outcomes_public_read ON public.business_outcomes;
CREATE POLICY business_outcomes_public_read
  ON public.business_outcomes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = business_outcomes.user_id
        AND COALESCE(p.profile_public, false)
        AND COALESCE(p.portfolio_public_opt_in, false)
    )
  );

COMMENT ON TABLE public.business_outcomes IS
  'Weekly revenue/sales metrics for entrepreneurial plans. revenue_minor is the smallest currency unit. Self read/write; public SELECT gated on profile_public + portfolio_public_opt_in.';
