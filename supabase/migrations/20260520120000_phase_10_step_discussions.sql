-- Phase 10 · Step Discussion (Surface C)
--
-- Two tables:
--   1. step_discussions — notes posted to a blueprint step's Discussion tab.
--      Each note may be a root note (parent_id IS NULL) or a threaded reply.
--      Evidence chips (voice clips, photos, polar data) live in evidence jsonb.
--   2. step_discussion_reactions — three named verbs (fire / insight / question).
--      Unique per (discussion, user, kind) so toggling re-uses the row.
--
-- RLS: any subscriber of the blueprint that owns the step may read all rows
-- on its steps. Authors may always read their own posts. Inserts require an
-- active subscription. Updates/deletes are author-only.
--
-- The discussion is scoped to the timeline_step the note hangs off; the
-- blueprint scope is derived by joining timeline_steps → blueprint_steps.

BEGIN;

CREATE TABLE IF NOT EXISTS public.step_discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID NOT NULL REFERENCES public.timeline_steps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.step_discussions(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_coach_reply BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_step_discussions_step
  ON public.step_discussions (step_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_step_discussions_user
  ON public.step_discussions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_step_discussions_parent
  ON public.step_discussions (parent_id) WHERE parent_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.step_discussion_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id UUID NOT NULL REFERENCES public.step_discussions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('fire', 'insight', 'question')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (discussion_id, user_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_step_discussion_reactions_discussion
  ON public.step_discussion_reactions (discussion_id);

ALTER TABLE public.step_discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.step_discussion_reactions ENABLE ROW LEVEL SECURITY;

-- Helper: does the viewer subscribe to any blueprint that contains this step?
CREATE OR REPLACE FUNCTION public.is_subscriber_to_step_blueprint(
  p_step_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.blueprint_steps bs
      JOIN public.blueprint_subscriptions sub
        ON sub.blueprint_id = bs.blueprint_id
     WHERE bs.step_id = p_step_id
       AND sub.subscriber_id = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_subscriber_to_step_blueprint(UUID, UUID)
  TO anon, authenticated;

-- READ: viewer must be the author OR a subscriber to the blueprint that
-- contains this step.
DROP POLICY IF EXISTS "step_discussions_subscriber_read" ON public.step_discussions;
CREATE POLICY "step_discussions_subscriber_read"
  ON public.step_discussions
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_subscriber_to_step_blueprint(step_id, auth.uid())
  );

-- WRITE: viewer must be a subscriber to the blueprint that contains this step.
-- (Author-of-blueprint counts as subscriber via subscribe() auto-adopt.)
DROP POLICY IF EXISTS "step_discussions_subscriber_insert" ON public.step_discussions;
CREATE POLICY "step_discussions_subscriber_insert"
  ON public.step_discussions
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_subscriber_to_step_blueprint(step_id, auth.uid())
  );

DROP POLICY IF EXISTS "step_discussions_author_update" ON public.step_discussions;
CREATE POLICY "step_discussions_author_update"
  ON public.step_discussions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "step_discussions_author_delete" ON public.step_discussions;
CREATE POLICY "step_discussions_author_delete"
  ON public.step_discussions
  FOR DELETE
  USING (auth.uid() = user_id);

-- REACTIONS: anyone who can read the underlying discussion can react.
DROP POLICY IF EXISTS "step_discussion_reactions_subscriber_read"
  ON public.step_discussion_reactions;
CREATE POLICY "step_discussion_reactions_subscriber_read"
  ON public.step_discussion_reactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.step_discussions d
       WHERE d.id = step_discussion_reactions.discussion_id
         AND (
           auth.uid() = d.user_id
           OR public.is_subscriber_to_step_blueprint(d.step_id, auth.uid())
         )
    )
  );

DROP POLICY IF EXISTS "step_discussion_reactions_subscriber_insert"
  ON public.step_discussion_reactions;
CREATE POLICY "step_discussion_reactions_subscriber_insert"
  ON public.step_discussion_reactions
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.step_discussions d
       WHERE d.id = step_discussion_reactions.discussion_id
         AND public.is_subscriber_to_step_blueprint(d.step_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "step_discussion_reactions_owner_delete"
  ON public.step_discussion_reactions;
CREATE POLICY "step_discussion_reactions_owner_delete"
  ON public.step_discussion_reactions
  FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.step_discussions IS
  'Per-step discussion notes scoped to a blueprint step. Root notes have parent_id NULL; replies (incl. pinned coach replies) point to a parent.';
COMMENT ON TABLE public.step_discussion_reactions IS
  'Three named reactions (fire / insight / question) on a discussion note. Unique per (discussion, user, kind).';

COMMIT;
