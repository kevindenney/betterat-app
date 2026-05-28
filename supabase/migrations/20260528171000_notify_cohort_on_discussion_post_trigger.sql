-- Fan out social_notifications when someone posts a cohort message
-- (step_discussions row with blueprint_step_id IS NOT NULL).
--
-- Recipients = every active plan-member of the underlying blueprint
-- ∪ every legacy blueprint_subscriber, MINUS the poster themselves.
-- One notification per recipient per post (replies aren't fanned out
-- separately — keep the inbox quiet enough that the first post wins).
--
-- Reactions DO NOT trigger notifications — too chatty. Posts only.
--
-- SECURITY DEFINER so the trigger can insert across user_id values
-- (the existing social_notifications INSERT policy is permissive but
-- this future-proofs against tightening it later).
--
-- Applied to dev project via Supabase MCP.

CREATE OR REPLACE FUNCTION public.notify_cohort_on_discussion_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blueprint_id   uuid;
  v_blueprint_title text;
  v_step_title      text;
  v_author_name     text;
  rec RECORD;
BEGIN
  IF NEW.blueprint_step_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT bs.blueprint_id, b.title, ts.title
  INTO v_blueprint_id, v_blueprint_title, v_step_title
  FROM public.blueprint_steps bs
  LEFT JOIN public.blueprints b      ON b.id  = bs.blueprint_id
  LEFT JOIN public.timeline_steps ts ON ts.id = bs.step_id
  WHERE bs.id = NEW.blueprint_step_id;

  SELECT full_name INTO v_author_name
  FROM public.profiles
  WHERE id = NEW.user_id;
  v_author_name := COALESCE(NULLIF(TRIM(v_author_name), ''), 'A cohort member');

  FOR rec IN
    SELECT DISTINCT recipient_user_id FROM (
      SELECT user_id AS recipient_user_id
        FROM public.plans
       WHERE source_blueprint_id = v_blueprint_id
         AND status = 'active'
         AND user_id <> NEW.user_id
      UNION
      SELECT subscriber_id AS recipient_user_id
        FROM public.blueprint_subscriptions
       WHERE blueprint_id = v_blueprint_id
         AND subscriber_id <> NEW.user_id
    ) AS recipients
  LOOP
    INSERT INTO public.social_notifications
      (user_id, type, actor_id, comment_id, title, body, data, is_read, created_at)
    VALUES (
      rec.recipient_user_id,
      'cohort_discussion_post',
      NEW.user_id,
      NEW.id,
      v_author_name || ' posted in cohort',
      COALESCE(v_blueprint_title, '') ||
        CASE WHEN v_step_title IS NOT NULL
             THEN ' · ' || v_step_title
             ELSE '' END,
      jsonb_build_object(
        'step_discussion_id', NEW.id,
        'blueprint_step_id',  NEW.blueprint_step_id,
        'blueprint_id',       v_blueprint_id
      ),
      false,
      NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_cohort_on_discussion_post ON public.step_discussions;

CREATE TRIGGER trg_notify_cohort_on_discussion_post
  AFTER INSERT ON public.step_discussions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_cohort_on_discussion_post();
