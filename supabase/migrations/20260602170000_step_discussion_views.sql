-- Track when a user last opened a step's Discussion thread, so the "Discuss N"
-- badge can show UNREAD activity (comments newer than the viewer's last visit,
-- excluding the viewer's own comments) instead of a permanent total count that
-- never clears.
--
-- One row per (step_id, user_id); last_seen_at bumps each time the viewer opens
-- the Discuss tab. RLS lets a user read/write only their own marker.
--
-- Applied to dev project qavekrwdbsobecwrfxwu.

CREATE TABLE IF NOT EXISTS public.step_discussion_views (
  step_id uuid NOT NULL REFERENCES public.timeline_steps(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (step_id, user_id)
);

ALTER TABLE public.step_discussion_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY step_discussion_views_select_own
  ON public.step_discussion_views
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY step_discussion_views_insert_own
  ON public.step_discussion_views
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY step_discussion_views_update_own
  ON public.step_discussion_views
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
