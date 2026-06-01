-- Fan out social_notifications when someone posts on a PERSONAL step
-- (step_discussions row with step_id set, blueprint_step_id NULL).
--
-- The cohort trigger (notify_cohort_on_discussion_post) only handles
-- blueprint_step posts, so a personal step shared with collaborators
-- ("N with") gave those collaborators zero inbox signal when the owner
-- (or another collaborator) posted. This trigger closes that gap.
--
-- Recipients = the step owner ∪ every "platform" collaborator stored on
-- the step's plan metadata (metadata->'plan'->'collaborators'), MINUS the
-- poster themselves. Fans out on every post (root + reply) to match the
-- cohort trigger's behavior; reactions still never notify.
--
-- SECURITY DEFINER so the trigger can insert across user_id values and
-- read collaborator metadata regardless of the poster's RLS scope.
--
-- Applied to dev project via Supabase MCP.

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
  rec RECORD;
BEGIN
  -- Personal-step posts only; cohort posts go through
  -- notify_cohort_on_discussion_post.
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

  FOR rec IN
    SELECT DISTINCT recipient_user_id
    FROM (
      -- the step owner
      SELECT v_owner_id AS recipient_user_id
      UNION
      -- platform collaborators stored on the step's plan metadata
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
    -- NB: social_notifications.comment_id FKs to regatta_comments, so we
    -- DON'T put the discussion id there (it would violate the FK and abort
    -- the post). The discussion id rides in `data` instead.
    INSERT INTO public.social_notifications
      (user_id, type, actor_id, title, body, data, is_read, created_at)
    VALUES (
      rec.recipient_user_id,
      'step_discussion_post',
      NEW.user_id,
      v_author_name || ' posted on a shared step',
      COALESCE(NULLIF(TRIM(v_step_title), ''), 'Shared step'),
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

DROP TRIGGER IF EXISTS trg_notify_collaborators_on_personal_step_post ON public.step_discussions;

CREATE TRIGGER trg_notify_collaborators_on_personal_step_post
  AFTER INSERT ON public.step_discussions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_collaborators_on_personal_step_post();
