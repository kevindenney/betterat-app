-- Break the infinite recursion on plan_subscriptions RLS.
--
-- plan_subscriptions_peer_read had a USING clause that ran:
--   EXISTS (SELECT 1 FROM plan_subscriptions ps WHERE ps.plan_id = plan_subscriptions.plan_id AND ps.user_id = auth.uid())
--
-- Postgres applies RLS to the subquery too, which triggers the same
-- policy, which queries the table again -> 42P17 infinite recursion.
-- Every PostgREST request to plan_resources (whose RLS calls
-- plan_subscriptions) bubbled this up as a 500.
--
-- Symptom: useSubscribedPlansForLibrary's step-3b plan_resources count
-- query returned 500; the entire hook threw, leaving the Library Plans
-- zone empty even after the earlier auth_uid_initplan migrations.
--
-- Fix: hoist the "am I a subscriber to this plan?" check into a
-- SECURITY DEFINER helper so the policy stops recursing.

CREATE OR REPLACE FUNCTION public.is_plan_subscriber(p_plan_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.plan_subscriptions
    WHERE plan_id = p_plan_id
      AND user_id = auth.uid()
  );
$$;

ALTER POLICY "plan_subscriptions_peer_read" ON public.plan_subscriptions
  USING (is_plan_subscriber(plan_id));

-- Also wrap the lingering bare auth.uid() in the owner policy while
-- we're here -- same initplan optimization as the other batches.
ALTER POLICY "plan_subscriptions_owner_rw" ON public.plan_subscriptions
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
