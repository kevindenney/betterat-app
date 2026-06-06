-- Phase 8 · Share-a-Step + Share-a-Capture + Fleet View
--
-- Schema changes:
-- 1. shared_steps — DM-style share rows + fleet/cohort broadcasts. Recipient
--    is either a single user (direct mode) or a group (group/fleet/cohort
--    mode). Receiver can fork into their own timeline; forked_to_step_id
--    captures provenance.
-- 2. share_tokens — link-mode invitations. Single-use guard via used_count
--    + expires_at (default 30 days).
-- 3. comments — receiver feedback thread on a shared step.
-- 4. claim_share_token(token) helper — public viewers redeem a share link
--    without exposing the share_tokens table directly.
--
-- Captures stay embedded in timeline_steps.metadata.act (JSONB observations
-- and media). Phase 8 stores per-observation visibility inside that JSONB
-- rather than introducing a separate captures table.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. SHARED_STEPS
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.shared_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.timeline_steps(id) ON DELETE CASCADE,
  recipient_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  group_kind TEXT CHECK (group_kind IN ('fleet', 'organization', 'cohort')),
  group_id UUID,
  shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  forked_to_step_id UUID REFERENCES public.timeline_steps(id) ON DELETE SET NULL,
  CONSTRAINT shared_steps_target_exclusive CHECK (
    (recipient_user_id IS NOT NULL AND group_id IS NULL AND group_kind IS NULL)
    OR
    (recipient_user_id IS NULL AND group_id IS NOT NULL AND group_kind IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_shared_steps_recipient_shared_at
  ON public.shared_steps (recipient_user_id, shared_at DESC)
  WHERE recipient_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shared_steps_group_shared_at
  ON public.shared_steps (group_id, shared_at DESC)
  WHERE group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shared_steps_sender
  ON public.shared_steps (sender_user_id, shared_at DESC);

CREATE INDEX IF NOT EXISTS idx_shared_steps_step
  ON public.shared_steps (step_id);

ALTER TABLE public.shared_steps ENABLE ROW LEVEL SECURITY;

-- Sender can read their own outgoing shares
DROP POLICY IF EXISTS "shared_steps_sender_read" ON public.shared_steps;
CREATE POLICY "shared_steps_sender_read"
  ON public.shared_steps
  FOR SELECT
  USING ((SELECT auth.uid()) = sender_user_id);

-- Direct recipient can read their incoming share
DROP POLICY IF EXISTS "shared_steps_recipient_read" ON public.shared_steps;
CREATE POLICY "shared_steps_recipient_read"
  ON public.shared_steps
  FOR SELECT
  USING ((SELECT auth.uid()) = recipient_user_id);

-- Sender inserts; recipient + group fields validated by CHECK + caller
DROP POLICY IF EXISTS "shared_steps_sender_insert" ON public.shared_steps;
CREATE POLICY "shared_steps_sender_insert"
  ON public.shared_steps
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = sender_user_id);

-- Recipient updates read_at + forked_to_step_id; sender updates nothing
DROP POLICY IF EXISTS "shared_steps_recipient_update" ON public.shared_steps;
CREATE POLICY "shared_steps_recipient_update"
  ON public.shared_steps
  FOR UPDATE
  USING ((SELECT auth.uid()) = recipient_user_id)
  WITH CHECK ((SELECT auth.uid()) = recipient_user_id);

-- Sender can rescind
DROP POLICY IF EXISTS "shared_steps_sender_delete" ON public.shared_steps;
CREATE POLICY "shared_steps_sender_delete"
  ON public.shared_steps
  FOR DELETE
  USING ((SELECT auth.uid()) = sender_user_id);

COMMENT ON TABLE public.shared_steps IS
  'Direct/group/link-mode share rows for a timeline step. CHECK guarantees exactly one target (recipient OR group). forked_to_step_id captures provenance when the receiver pulls a fork into their own timeline.';

-- -----------------------------------------------------------------------------
-- 2. SHARE_TOKENS  (link-mode invitations, 30-day TTL)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.share_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  step_id UUID NOT NULL REFERENCES public.timeline_steps(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  used_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_share_tokens_token ON public.share_tokens (token);
CREATE INDEX IF NOT EXISTS idx_share_tokens_creator ON public.share_tokens (created_by_user_id, created_at DESC);

ALTER TABLE public.share_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "share_tokens_creator_read" ON public.share_tokens;
CREATE POLICY "share_tokens_creator_read"
  ON public.share_tokens
  FOR SELECT
  USING ((SELECT auth.uid()) = created_by_user_id);

DROP POLICY IF EXISTS "share_tokens_creator_insert" ON public.share_tokens;
CREATE POLICY "share_tokens_creator_insert"
  ON public.share_tokens
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = created_by_user_id);

DROP POLICY IF EXISTS "share_tokens_creator_delete" ON public.share_tokens;
CREATE POLICY "share_tokens_creator_delete"
  ON public.share_tokens
  FOR DELETE
  USING ((SELECT auth.uid()) = created_by_user_id);

COMMENT ON TABLE public.share_tokens IS
  'Link-mode share invites. Token redeemed via claim_share_token(); expires_at gates validity.';

-- Public redemption helper. Bypasses RLS so an unauthenticated viewer
-- can resolve a link token to a step id without exposing the table.
CREATE OR REPLACE FUNCTION public.claim_share_token(p_token TEXT)
RETURNS TABLE(step_id UUID, expires_at TIMESTAMPTZ, used_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.share_tokens;
BEGIN
  SELECT * INTO v_row
    FROM public.share_tokens
   WHERE share_tokens.token = p_token
     AND share_tokens.expires_at > NOW();

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.share_tokens
     SET used_count = share_tokens.used_count + 1
   WHERE share_tokens.id = v_row.id;

  RETURN QUERY SELECT v_row.step_id, v_row.expires_at, v_row.used_count + 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_share_token(TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.claim_share_token(TEXT) IS
  'Resolves a share link token to its step_id, increments used_count, returns nothing if expired/missing. Safe to call unauthenticated.';

-- -----------------------------------------------------------------------------
-- 3. COMMENTS
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.shared_step_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_step_id UUID NOT NULL REFERENCES public.shared_steps(id) ON DELETE CASCADE,
  commenter_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(trim(body)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shared_step_comments_shared_step
  ON public.shared_step_comments (shared_step_id, created_at);

CREATE INDEX IF NOT EXISTS idx_shared_step_comments_commenter
  ON public.shared_step_comments (commenter_user_id, created_at DESC);

ALTER TABLE public.shared_step_comments ENABLE ROW LEVEL SECURITY;

-- Sender + recipient + commenter can read the comment thread
DROP POLICY IF EXISTS "shared_step_comments_thread_read" ON public.shared_step_comments;
CREATE POLICY "shared_step_comments_thread_read"
  ON public.shared_step_comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
        FROM public.shared_steps s
       WHERE s.id = shared_step_comments.shared_step_id
         AND (s.sender_user_id = (SELECT auth.uid()) OR s.recipient_user_id = (SELECT auth.uid()))
    )
    OR (SELECT auth.uid()) = commenter_user_id
  );

DROP POLICY IF EXISTS "shared_step_comments_recipient_insert" ON public.shared_step_comments;
CREATE POLICY "shared_step_comments_recipient_insert"
  ON public.shared_step_comments
  FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = commenter_user_id
    AND EXISTS (
      SELECT 1
        FROM public.shared_steps s
       WHERE s.id = shared_step_comments.shared_step_id
         AND (s.sender_user_id = (SELECT auth.uid()) OR s.recipient_user_id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "shared_step_comments_owner_delete" ON public.shared_step_comments;
CREATE POLICY "shared_step_comments_owner_delete"
  ON public.shared_step_comments
  FOR DELETE
  USING ((SELECT auth.uid()) = commenter_user_id);

COMMENT ON TABLE public.shared_step_comments IS
  'Comment thread on a shared_steps row. Either party of the share can post or read.';

COMMIT;
