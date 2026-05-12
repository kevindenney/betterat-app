-- Migration: create step_recent_activity table + mark_step_active() helper
--
-- Step Arch B/1 — supports the "recently active step" signal used by Capture
-- Service for cross-surface context inference (Telegram, WhatsApp, in-app).
--
-- Locked decisions:
--   D1 — table name `step_recent_activity`, PK (user_id, step_id), 7-day TTL,
--        `source` column. See docs/audit/step-architecture-migration-plan.md §5.
--
-- Notes:
--   * 7-day TTL is enforced by callers via `WHERE last_active_at > now() - '7 days'`.
--     A partial index using `now()` is not possible because `now()` is STABLE
--     (not IMMUTABLE). The btree index on (user_id, last_active_at DESC)
--     supports that query pattern efficiently.
--   * The SECURITY DEFINER fn lets the Telegram webhook RPC into this table
--     without granting the table to anon; the fn pins search_path per the
--     security-warnings sweep (see 20260121100000_fix_security_definer_search_path.sql).
--   * Additive migration only. No existing tables modified. See
--     PR-rollback-plan in docs/audit/step-architecture-migration-plan.md.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.step_recent_activity (
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step_id        uuid        NOT NULL REFERENCES public.timeline_steps(id) ON DELETE CASCADE,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  source         text        NOT NULL,
  PRIMARY KEY (user_id, step_id),
  CONSTRAINT step_recent_activity_source_check
    CHECK (source IN ('telegram', 'whatsapp', 'voice', 'in_app', 'web', 'sms'))
);

COMMENT ON TABLE public.step_recent_activity IS
  'Per-user "recently active step" signal for cross-surface context inference. '
  '7-day TTL is enforced by callers via WHERE last_active_at > now() - interval ''7 days''. '
  'Written via mark_step_active() SECURITY DEFINER fn from bot tool calls.';

-- Index supports the canonical query: "give me this user''s recently active
-- steps within the last 7 days, newest first".
CREATE INDEX IF NOT EXISTS idx_step_recent_activity_user_recent
  ON public.step_recent_activity (user_id, last_active_at DESC);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.step_recent_activity ENABLE ROW LEVEL SECURITY;

-- Users can read their own rows. Writes go through mark_step_active().
CREATE POLICY "step_recent_activity_select_own"
  ON public.step_recent_activity
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

-- Direct INSERT/UPDATE/DELETE not permitted from anon/authenticated. Writes
-- must use mark_step_active() which is SECURITY DEFINER.

-- ---------------------------------------------------------------------------
-- mark_step_active() — SECURITY DEFINER write helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mark_step_active(
  p_step_id uuid,
  p_source  text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_owns    boolean;
BEGIN
  -- Require an authenticated caller.
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'mark_step_active: not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Source must be one of the allowed values.
  IF p_source NOT IN ('telegram', 'whatsapp', 'voice', 'in_app', 'web', 'sms') THEN
    RAISE EXCEPTION 'mark_step_active: invalid source %', p_source USING ERRCODE = '22023';
  END IF;

  -- Caller must own the step. Guarded explicitly because SECURITY DEFINER
  -- bypasses the underlying table''s RLS.
  SELECT EXISTS (
    SELECT 1
    FROM public.timeline_steps
    WHERE id = p_step_id AND user_id = v_user_id
  ) INTO v_owns;

  IF NOT v_owns THEN
    -- Silent no-op rather than raising — keeps the bot tool hook tamper-proof
    -- without leaking which step ids exist for other users.
    RETURN;
  END IF;

  INSERT INTO public.step_recent_activity (user_id, step_id, last_active_at, source)
  VALUES (v_user_id, p_step_id, now(), p_source)
  ON CONFLICT (user_id, step_id)
  DO UPDATE SET
    last_active_at = EXCLUDED.last_active_at,
    source         = EXCLUDED.source;
END;
$$;

-- Allow authenticated users to call the fn. Ownership is enforced inside.
REVOKE ALL ON FUNCTION public.mark_step_active(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_step_active(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.mark_step_active(uuid, text) IS
  'UPSERTs (auth.uid(), p_step_id) into step_recent_activity with last_active_at = now(). '
  'Silently no-ops if the caller does not own the step. Called from bot tool hooks.';
