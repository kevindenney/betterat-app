-- Fix: the owner of a personal (non-blueprint) step couldn't post a private
-- note on their own step.
--
-- The phase-10 INSERT policy gated step_discussions writes solely on
-- is_subscriber_to_step_blueprint(step_id, …). A step the user created
-- themselves (e.g. a race on their own timeline) belongs to no blueprint, so
-- that check returns false and the insert was rejected with a 403 RLS error
-- ("new row violates row-level security policy for table step_discussions").
--
-- The "MINE" Discuss thread is the step owner's private channel, so step
-- ownership must grant both read and write — independent of any blueprint
-- subscription. Add an ownership branch to the per-step read/insert policies.
-- The additive blueprint_step_id policies are untouched.
--
-- auth.uid() is wrapped as (SELECT auth.uid()) so it's evaluated once per
-- statement, not re-decoded per row.

DROP POLICY IF EXISTS "step_discussions_subscriber_read" ON public.step_discussions;
CREATE POLICY "step_discussions_subscriber_read"
  ON public.step_discussions
  FOR SELECT
  USING (
    (SELECT auth.uid()) = user_id
    OR public.is_subscriber_to_step_blueprint(step_id, (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.timeline_steps ts
       WHERE ts.id = step_discussions.step_id
         AND ts.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "step_discussions_subscriber_insert" ON public.step_discussions;
CREATE POLICY "step_discussions_subscriber_insert"
  ON public.step_discussions
  FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (
      public.is_subscriber_to_step_blueprint(step_id, (SELECT auth.uid()))
      OR EXISTS (
        SELECT 1 FROM public.timeline_steps ts
         WHERE ts.id = step_discussions.step_id
           AND ts.user_id = (SELECT auth.uid())
      )
    )
  );
