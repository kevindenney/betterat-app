-- Make discussion-post notification bodies descriptive: append a short
-- preview of the actual post text so the inbox row reads
--   "Kevin posted in cohort" / Race 2 · "No way"
-- instead of just naming the step. Who + where + a quote of what was said,
-- which makes the row scannable and worth tapping.
--
-- Both triggers get the same treatment:
--   • notify_cohort_on_discussion_post        (blueprint_step posts)
--   • notify_collaborators_on_personal_step_post (personal-step posts)
-- Only the body construction changes; recipient fan-out is untouched. The
-- snippet collapses whitespace and truncates to 60 chars; posts with no text
-- (image-only) fall back to the step/context label alone.
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
  v_context         text;
  v_snippet         text;
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

  -- Where the post lives: prefer the step title, fall back to the blueprint.
  v_context := COALESCE(
    NULLIF(TRIM(v_step_title), ''),
    NULLIF(TRIM(v_blueprint_title), ''),
    'a step'
  );

  -- A one-line preview of the post text, truncated. NULL for image-only posts.
  v_snippet := NULLIF(TRIM(regexp_replace(COALESCE(NEW.body, ''), '\s+', ' ', 'g')), '');
  IF v_snippet IS NOT NULL AND length(v_snippet) > 60 THEN
    v_snippet := left(v_snippet, 60) || '…';
  END IF;

  v_body := CASE
    WHEN v_snippet IS NOT NULL THEN v_context || ' · "' || v_snippet || '"'
    ELSE v_context
  END;

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

CREATE OR REPLACE FUNCTION public.notify_collaborators_on_personal_step_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id    uuid;
  v_step_title  text;
  v_author_name text;
  v_context     text;
  v_snippet     text;
  v_body        text;
  rec RECORD;
BEGIN
  IF NEW.step_id IS NULL OR NEW.blueprint_step_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT ts.user_id, ts.title
  INTO v_owner_id, v_step_title
  FROM public.timeline_steps ts
  WHERE ts.id = NEW.step_id;

  IF v_owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO v_author_name
  FROM public.profiles
  WHERE id = NEW.user_id;
  v_author_name := COALESCE(NULLIF(TRIM(v_author_name), ''), 'Someone');

  v_context := COALESCE(NULLIF(TRIM(v_step_title), ''), 'Shared step');

  v_snippet := NULLIF(TRIM(regexp_replace(COALESCE(NEW.body, ''), '\s+', ' ', 'g')), '');
  IF v_snippet IS NOT NULL AND length(v_snippet) > 60 THEN
    v_snippet := left(v_snippet, 60) || '…';
  END IF;

  v_body := CASE
    WHEN v_snippet IS NOT NULL THEN v_context || ' · "' || v_snippet || '"'
    ELSE v_context
  END;

  FOR rec IN
    SELECT DISTINCT recipient_user_id
    FROM (
      SELECT v_owner_id AS recipient_user_id
      UNION
      SELECT (c->>'user_id')::uuid AS recipient_user_id
        FROM public.timeline_steps ts,
             jsonb_array_elements(
               COALESCE(ts.metadata->'plan'->'collaborators', '[]'::jsonb)
             ) AS c
       WHERE ts.id = NEW.step_id
         AND c->>'type' = 'platform'
         AND c->>'user_id' IS NOT NULL
    ) AS recipients
    WHERE recipient_user_id IS NOT NULL
      AND recipient_user_id <> NEW.user_id
  LOOP
    INSERT INTO public.social_notifications
      (user_id, type, actor_id, title, body, data, is_read, created_at)
    VALUES (
      rec.recipient_user_id,
      'step_discussion_post',
      NEW.user_id,
      v_author_name || ' posted on a shared step',
      v_body,
      jsonb_build_object(
        'step_discussion_id', NEW.id,
        'step_id',            NEW.step_id
      ),
      false,
      NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$$;
