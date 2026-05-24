-- ============================================================================
-- v3 screen-designs · The reflecting & suggesting system
--
-- Two schema changes that close the loop with Phases A/C of the v3 cover:
--
--   1. peer_reflections — a peer's short reflection on someone else's step.
--      Lights up the Read segment of the Inbox tab (currently skeletal).
--      Maps to the lilac italic-serif quote on the step cover (Phase B).
--
--   2. step_suggestions.source_step_id becomes nullable so peers can send
--      truly free-form suggestions ("a sub-step on kicker release timing")
--      without having to surface one of their own steps as the source.
--
-- The inbox_items view is extended with a third UNION arm exposing
-- peer_reflections as kind='reflection', so existing client paths
-- (useInboxItems, useInboxCount) get the new rows for free once they
-- recognise the new kind.
--
-- Per project conventions: auth.uid() wrapped as (SELECT auth.uid()) in
-- RLS to avoid per-row JWT re-decode (feedback_rls_auth_uid_must_be_wrapped).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · step_suggestions.source_step_id → nullable
-- ----------------------------------------------------------------------------

ALTER TABLE public.step_suggestions
  ALTER COLUMN source_step_id DROP NOT NULL;

COMMENT ON COLUMN public.step_suggestions.source_step_id IS
  'Optional sender''s step the suggestion references. NULL when the suggestion is a free-form idea ("try a sub-step on X") with no existing source step.';

-- ----------------------------------------------------------------------------
-- 2 · peer_reflections — the Read kind of the v3 Inbox
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.peer_reflections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_step_id  uuid REFERENCES public.timeline_steps(id) ON DELETE SET NULL,
  body            text NOT NULL CHECK (length(trim(body)) > 0),
  status          text NOT NULL DEFAULT 'unread'
                    CHECK (status IN ('unread','read','archived')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS peer_reflections_target_idx
  ON public.peer_reflections(target_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS peer_reflections_source_idx
  ON public.peer_reflections(source_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS peer_reflections_target_step_idx
  ON public.peer_reflections(target_step_id)
  WHERE target_step_id IS NOT NULL;

ALTER TABLE public.peer_reflections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS peer_reflections_participants_read ON public.peer_reflections;
CREATE POLICY peer_reflections_participants_read
  ON public.peer_reflections
  FOR SELECT
  TO authenticated
  USING (
    source_user_id = (SELECT auth.uid())
    OR target_user_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS peer_reflections_sender_insert ON public.peer_reflections;
CREATE POLICY peer_reflections_sender_insert
  ON public.peer_reflections
  FOR INSERT
  TO authenticated
  WITH CHECK (source_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS peer_reflections_recipient_update ON public.peer_reflections;
CREATE POLICY peer_reflections_recipient_update
  ON public.peer_reflections
  FOR UPDATE
  TO authenticated
  USING (target_user_id = (SELECT auth.uid()))
  WITH CHECK (target_user_id = (SELECT auth.uid()));

COMMENT ON TABLE public.peer_reflections IS
  'v3 inbox Read kind. A peer''s short reflection on another user''s step. Surfaces as the lilac italic-serif quote on the recipient''s step cover (Phase B) and in the Inbox Read segment (Phase A).';

-- ----------------------------------------------------------------------------
-- 3 · inbox_items view — extended UNION arm for peer_reflections
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
    s.created_at             AS created_at
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
    d.added_at               AS created_at
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
    r.created_at             AS created_at
  FROM public.peer_reflections r
  WHERE r.status IN ('unread', 'read');

COMMENT ON VIEW public.inbox_items IS
  'Unified Practice Inbox source — suggestions + on-deck + peer reflections. The kind column drives client-side routing into Act (suggestions, on_deck) vs Read (reflection) segments per v3 screen 04.';
