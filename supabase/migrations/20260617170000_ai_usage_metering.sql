-- AI usage metering: per-user, per-month counters for metered AI features.
--
-- The product gates AI features for free users (N actions / month) and gives
-- paid users unlimited use. There is no single AI chokepoint in the app — calls
-- fan out through edge functions and the Anthropic SDK — so increments are
-- recorded at each feature's entry point via the increment_ai_usage RPC.
--
-- Clients may READ their own counters (to show "X of N left" and to gate the
-- UI), but may NOT write them directly: increments only happen through the
-- SECURITY DEFINER RPC, so a client cannot under-report its usage.

CREATE TABLE IF NOT EXISTS public.ai_usage_counters (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_month date NOT NULL,
  feature text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, period_month, feature)
);

ALTER TABLE public.ai_usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own AI usage"
  ON public.ai_usage_counters
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Atomic increment for the current UTC month. Returns the new running count so
-- the caller can decide whether the action that just ran put the user over a
-- free-tier limit (the UI refreshes its counters from this).
CREATE OR REPLACE FUNCTION public.increment_ai_usage(p_feature text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_month date := date_trunc('month', now())::date;
  v_count integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.ai_usage_counters (user_id, period_month, feature, count, updated_at)
  VALUES (v_user, v_month, p_feature, 1, now())
  ON CONFLICT (user_id, period_month, feature)
  DO UPDATE SET count = ai_usage_counters.count + 1, updated_at = now()
  RETURNING count INTO v_count;

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.increment_ai_usage(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_ai_usage(text) TO authenticated;
