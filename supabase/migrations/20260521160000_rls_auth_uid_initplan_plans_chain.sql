-- Second batch of RLS auth_uid_initplan fixes — covers the remaining tables
-- in the useSubscribedPlansForLibrary chain that the first batch
-- (20260521150000) didn't touch.
--
-- Symptom this addresses: Library Plans zone still rendered empty after the
-- first batch even though Concepts started working. The Plans hook queries
-- blueprint_subscriptions twice (once for the user's subs, once for peer
-- previews), plus blueprint_steps (step counts), plan_resources (resource
-- counts), and users (author chip). Each unwrapped auth.uid() was still
-- triggering per-row JWT re-decode under RLS — enough to keep one of the
-- 8 chained queries from settling before the 30s app-side abort.

ALTER POLICY "Subscribe to blueprints" ON public.blueprint_subscriptions
  WITH CHECK (subscriber_id = (SELECT auth.uid()) AND can_subscribe_to_blueprint(blueprint_id));

ALTER POLICY "Unsubscribe from blueprints" ON public.blueprint_subscriptions
  USING (subscriber_id = (SELECT auth.uid()));

ALTER POLICY "Update own subscriptions" ON public.blueprint_subscriptions
  USING (subscriber_id = (SELECT auth.uid()));

ALTER POLICY "View own subscriptions or as blueprint owner" ON public.blueprint_subscriptions
  USING (
    subscriber_id = (SELECT auth.uid())
    OR blueprint_id IN (
      SELECT timeline_blueprints.id
      FROM timeline_blueprints
      WHERE timeline_blueprints.user_id = (SELECT auth.uid())
    )
  );

ALTER POLICY "blueprint_steps_author_all" ON public.blueprint_steps
  USING (EXISTS (
    SELECT 1 FROM timeline_blueprints b
    WHERE b.id = blueprint_steps.blueprint_id
      AND b.user_id = (SELECT auth.uid())
  ));

ALTER POLICY "blueprint_steps_subscriber_read" ON public.blueprint_steps
  USING (EXISTS (
    SELECT 1 FROM blueprint_subscriptions bs
    WHERE bs.blueprint_id = blueprint_steps.blueprint_id
      AND bs.subscriber_id = (SELECT auth.uid())
  ));

ALTER POLICY "plan_resources_subscriber_read" ON public.plan_resources
  USING (EXISTS (
    SELECT 1 FROM plan_subscriptions ps
    WHERE ps.plan_id = plan_resources.plan_id
      AND ps.user_id = (SELECT auth.uid())
  ));

ALTER POLICY "users_update_own_notif_prefs" ON public.users
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);
