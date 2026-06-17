-- Unify the suggestion model so EVERY suggestion (peer or coach) lands in
-- both the Practice Inbox and the notification bell, and so the
-- allow_suggest_step privacy flag is enforced at the DB, not just hidden
-- client-side.
--
-- Before this, two disjoint signals existed (see migration
-- 20260617210000): the step-detail share sheet + public-face composer
-- wrote step_suggestions (Inbox only), while the blueprint-coach and
-- legacy race-card paths wrote a step_suggested bell notification only.
-- Coach suggestions couldn't write step_suggestions cleanly because their
-- "source" is often a blueprint step or free-form text with no
-- timeline_steps row — and the Inbox derived its title from a
-- timeline_steps join.
--
-- Fix: carry an explicit title/description ON the suggestion row so a
-- suggestion with no real source step still renders a clean Inbox card.
-- All write paths now insert a step_suggestions row; the AFTER INSERT
-- trigger fans out the bell. A BEFORE INSERT trigger enforces the
-- recipient's allow_suggest_step flag.

-- ----------------------------------------------------------------------------
-- 1 · Explicit title/description for source-less suggestions
-- ----------------------------------------------------------------------------

ALTER TABLE public.step_suggestions
  ADD COLUMN IF NOT EXISTS suggested_title       text,
  ADD COLUMN IF NOT EXISTS suggested_description text;

COMMENT ON COLUMN public.step_suggestions.suggested_title IS
  'Explicit title shown in the Inbox/bell when source_step_id is NULL (free-form or blueprint-sourced coach suggestion). When source_step_id points at a real timeline_steps row, that row''s title wins.';
COMMENT ON COLUMN public.step_suggestions.suggested_description IS
  'Explicit description companion to suggested_title for source-less suggestions.';

-- ----------------------------------------------------------------------------
-- 2 · inbox_items view — append suggested_title/suggested_description
--     (new columns at the END so CREATE OR REPLACE VIEW is allowed)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.inbox_items AS
  SELECT
    s.id                     AS id,
    'suggestion'::text       AS kind,
    s.target_user_id         AS user_id,
    s.source_user_id         AS from_user_id,
    NULL::uuid               AS from_plan_id,
    s.source_step_id         AS step_id,
    s.message                AS body,
    s.status                 AS status,
    s.created_at             AS created_at,
    s.suggested_title        AS suggested_title,
    s.suggested_description  AS suggested_description
  FROM public.step_suggestions s
  WHERE s.status = 'pending'
UNION ALL
  SELECT
    d.id                     AS id,
    'on_deck'::text          AS kind,
    d.user_id                AS user_id,
    NULL::uuid               AS from_user_id,
    NULL::uuid               AS from_plan_id,
    d.source_id              AS step_id,
    d.body                   AS body,
    d.status                 AS status,
    d.added_at               AS created_at,
    NULL::text               AS suggested_title,
    NULL::text               AS suggested_description
  FROM public.step_deck d
  WHERE d.status = 'on_deck'
UNION ALL
  SELECT
    r.id                     AS id,
    'reflection'::text       AS kind,
    r.target_user_id         AS user_id,
    r.source_user_id         AS from_user_id,
    NULL::uuid               AS from_plan_id,
    r.target_step_id         AS step_id,
    r.body                   AS body,
    r.status                 AS status,
    r.created_at             AS created_at,
    NULL::text               AS suggested_title,
    NULL::text               AS suggested_description
  FROM public.peer_reflections r
  WHERE r.status IN ('unread', 'read');

-- ----------------------------------------------------------------------------
-- 3 · Bell fan-out trigger — prefer the explicit title/description
-- ----------------------------------------------------------------------------

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
  IF NEW.target_user_id = NEW.source_user_id THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO v_actor_name
  FROM public.profiles
  WHERE id = NEW.source_user_id;
  v_actor_name := COALESCE(NULLIF(TRIM(v_actor_name), ''), 'Someone');

  -- Real source step (if any) provides title/description/interest.
  IF NEW.source_step_id IS NOT NULL THEN
    SELECT ts.title, ts.description, ts.interest_id
    INTO v_step_title, v_step_desc, v_interest_id
    FROM public.timeline_steps ts
    WHERE ts.id = NEW.source_step_id;
  END IF;

  -- Explicit suggested_* wins (source-less coach/free-form suggestions);
  -- then the real step; then the personal note; then a generic fallback.
  v_step_title := COALESCE(
    NULLIF(TRIM(NEW.suggested_title), ''),
    NULLIF(TRIM(v_step_title), ''),
    NULLIF(TRIM(NEW.message), ''),
    'a step'
  );
  v_step_desc := COALESCE(
    NULLIF(TRIM(NEW.suggested_description), ''),
    NULLIF(TRIM(v_step_desc), '')
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

-- ----------------------------------------------------------------------------
-- 4 · Enforce allow_suggest_step at the DB
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_step_suggestion_allowed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed boolean;
BEGIN
  -- Suggesting to yourself is always fine.
  IF NEW.target_user_id = NEW.source_user_id THEN
    RETURN NEW;
  END IF;

  -- Fail OPEN when no profile row exists (matches the column default true).
  SELECT allow_suggest_step INTO v_allowed
  FROM public.profiles
  WHERE id = NEW.target_user_id;

  IF COALESCE(v_allowed, true) = false THEN
    RAISE EXCEPTION 'recipient_not_accepting_suggestions'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_step_suggestion_allowed ON public.step_suggestions;

CREATE TRIGGER trg_enforce_step_suggestion_allowed
  BEFORE INSERT ON public.step_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_step_suggestion_allowed();
