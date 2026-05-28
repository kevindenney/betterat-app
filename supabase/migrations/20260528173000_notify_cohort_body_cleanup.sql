-- Body assembly: trim and join only the parts we actually have so we
-- never end up with leading "·" when the blueprint title is missing
-- (which happens for blueprints that exist only as a dangling
-- blueprint_subscriptions reference). Same trigger function as
-- before, just smarter body construction.
--
-- Applied to dev project via Supabase MCP.

CREATE OR REPLACE FUNCTION public.notify_cohort_on_discussion_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blueprint_id    uuid;
  v_blueprint_title text;
  v_step_title      text;
  v_author_name     text;
  v_body            text;
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

  -- Join only the parts that exist; never lead with a separator.
  v_body := COALESCE(
    CASE
      WHEN NULLIF(TRIM(v_blueprint_title), '') IS NOT NULL
       AND NULLIF(TRIM(v_step_title), '') IS NOT NULL
        THEN TRIM(v_blueprint_title) || ' · ' || TRIM(v_step_title)
      WHEN NULLIF(TRIM(v_blueprint_title), '') IS NOT NULL
        THEN TRIM(v_blueprint_title)
      WHEN NULLIF(TRIM(v_step_title), '') IS NOT NULL
        THEN TRIM(v_step_title)
      ELSE NULL
    END,
    'a step'
  );

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
      (user_id, type, actor_id, title, body, data, is_read, created_at)
    VALUES (
      rec.recipient_user_id,
      'cohort_discussion_post',
      NEW.user_id,
      v_author_name || ' posted in cohort',
      v_body,
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
