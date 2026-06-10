-- Supabase advisor 0024: the authenticated INSERT policy on
-- social_notifications was WITH CHECK (true), letting any signed-in user
-- insert notifications with arbitrary user_id (inbox spam) and actor_id
-- (impersonation). Require the actor to be the caller. All legit fan-out
-- paths are unaffected: trigger functions are SECURITY DEFINER (owner
-- bypasses RLS) and the retention cron uses service_role, which keeps its
-- own "Service can create notifications" policy.

DROP POLICY IF EXISTS "Authenticated users can create notifications" ON social_notifications;

CREATE POLICY "Authenticated users can create notifications"
  ON social_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = (SELECT auth.uid()));
