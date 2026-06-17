-- Fan out a `step_suggested` social_notification when a peer suggestion
-- row is inserted into step_suggestions.
--
-- Two disjoint suggestion signals existed before this:
--   * step_suggestions  -> Practice Inbox (inbox_items view). Written by
--     the step-detail share sheet (useShareStep.suggestDirect) and the
--     public-face SuggestStepComposer. These NEVER rang the bell, so a
--     suggested step landed silently — the recipient only saw it if they
--     happened to open the Inbox tab.
--   * social_notifications(type='step_suggested') -> notification bell.
--     Written app-side by the blueprint-coach path
--     (useSuggestStepToSubscriber) and the legacy SuggestStepSheet. These
--     do NOT write a step_suggestions row.
--
-- This trigger makes every Inbox-backed peer suggestion ALSO ring the
-- bell. No double-notify: neither Inbox path writes a bell row itself,
-- and the bell-only paths don't write step_suggestions, so they're
-- untouched.
--
-- `data` mirrors NotificationService.notifyStepSuggested so the existing
-- NotificationRow "Adopt" affordance (reads data.source_step_id) works.
--
-- SECURITY DEFINER so the insert bypasses the social_notifications RLS
-- actor-check (actor_id = auth.uid()); the actor here is the suggestion's
-- source_user_id, which the WITH CHECK on step_suggestions already pins to
-- the caller.

CREATE OR REPLACE FUNCTION public.notify_on_step_suggestion_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_name  text;
  v_step_title  text;
  v_step_desc   text;
  v_interest_id uuid;
BEGIN
  -- Don't notify yourself.
  IF NEW.target_user_id = NEW.source_user_id THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO v_actor_name
  FROM public.profiles
  WHERE id = NEW.source_user_id;
  v_actor_name := COALESCE(NULLIF(TRIM(v_actor_name), ''), 'Someone');

  -- Pull step details when the suggestion references a real step.
  -- Free-form suggestions (source_step_id NULL) fall back to the message.
  IF NEW.source_step_id IS NOT NULL THEN
    SELECT ts.title, ts.description, ts.interest_id
    INTO v_step_title, v_step_desc, v_interest_id
    FROM public.timeline_steps ts
    WHERE ts.id = NEW.source_step_id;
  END IF;

  v_step_title := COALESCE(
    NULLIF(TRIM(v_step_title), ''),
    NULLIF(TRIM(NEW.message), ''),
    'a step'
  );

  INSERT INTO public.social_notifications
    (user_id, type, actor_id, title, body, data, is_read, created_at)
  VALUES (
    NEW.target_user_id,
    'step_suggested',
    NEW.source_user_id,
    'Step suggestion',
    v_actor_name || ' suggested "' || v_step_title || '"',
    jsonb_build_object(
      'source_step_id',   NEW.source_step_id,
      'step_title',       v_step_title,
      'step_description', v_step_desc,
      'interest_id',      v_interest_id,
      'suggestion_id',    NEW.id
    ),
    false,
    NOW()
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_step_suggestion_insert ON public.step_suggestions;

CREATE TRIGGER trg_notify_on_step_suggestion_insert
  AFTER INSERT ON public.step_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_step_suggestion_insert();
