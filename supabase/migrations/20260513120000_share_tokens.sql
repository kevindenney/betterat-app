-- =============================================================================
-- share_tokens: unified, revocable, optionally-expiring share links for
-- timeline_steps and timeline_blueprints. Per onboarding plan §4 Step 4 / D10.
--
-- A share link looks like /share/<token> and resolves through the
-- SECURITY DEFINER RPC `resolve_share_token`. The RPC enforces validity
-- (not revoked, not expired), increments an access counter, and returns a
-- redacted JSON view of the target. Coaches/parents/etc. can preview a
-- step or blueprint without an account and convert via the embedded CTA.
--
-- Why a unified table (vs. extending the existing per-table `share_token`
-- columns on `timeline_steps`/`sailor_race_preparation`): the plan calls for
-- a single revocation + expiry surface, a single resolver to rate-limit, and
-- room to add future target types (blueprint folders, courses, etc.) without
-- another schema change. The legacy columns stay in place for now — they
-- back the existing `/p/step/*` route. A later migration may consolidate.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.share_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type     TEXT NOT NULL CHECK (target_type IN ('step', 'blueprint')),
  target_id       UUID NOT NULL,
  scope           TEXT NOT NULL CHECK (scope IN ('step:read', 'blueprint:read')),
  token           TEXT NOT NULL UNIQUE,
  created_by      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  access_count    INTEGER NOT NULL DEFAULT 0,
  -- Sliding-window rate-limit counters. Reset when the window rolls.
  rate_window_started_at TIMESTAMPTZ,
  rate_window_count INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT share_tokens_scope_matches_target CHECK (
    (target_type = 'step'      AND scope = 'step:read') OR
    (target_type = 'blueprint' AND scope = 'blueprint:read')
  )
);

CREATE INDEX IF NOT EXISTS idx_share_tokens_target
  ON public.share_tokens (target_type, target_id);

-- Useful for "all my share links" UI later; non-unique on created_by.
CREATE INDEX IF NOT EXISTS idx_share_tokens_creator
  ON public.share_tokens (created_by, created_at DESC);

COMMENT ON TABLE public.share_tokens IS
  'Unified read-only share tokens for steps and blueprints. Resolution goes through resolve_share_token() to enforce expiry, revocation, and per-token rate limiting.';

-- ---------------------------------------------------------------------------
-- RLS — owners can read/manage their own tokens; resolution for non-owners
-- happens through the SECURITY DEFINER RPC, never via direct SELECT.
-- ---------------------------------------------------------------------------
ALTER TABLE public.share_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "share_tokens_owner_read"
  ON public.share_tokens
  FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "share_tokens_owner_insert"
  ON public.share_tokens
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "share_tokens_owner_update"
  ON public.share_tokens
  FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "share_tokens_owner_delete"
  ON public.share_tokens
  FOR DELETE
  USING (created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- create_share_token(target_type, target_id, expires_at?)
-- Verifies the caller owns the target. Returns the new token string.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_share_token(
  p_target_type TEXT,
  p_target_id UUID,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_owns BOOLEAN := false;
  v_scope TEXT;
  v_token TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_target_type = 'step' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.timeline_steps
      WHERE id = p_target_id AND user_id = v_caller
    ) INTO v_owns;
    v_scope := 'step:read';
  ELSIF p_target_type = 'blueprint' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.timeline_blueprints
      WHERE id = p_target_id AND user_id = v_caller
    ) INTO v_owns;
    v_scope := 'blueprint:read';
  ELSE
    RAISE EXCEPTION 'unsupported target_type %', p_target_type USING ERRCODE = '22023';
  END IF;

  IF NOT v_owns THEN
    RAISE EXCEPTION 'caller does not own target' USING ERRCODE = '42501';
  END IF;

  -- 32 random bytes → 64 hex chars = 256 bits of entropy. UNIQUE on `token`
  -- guards against (vanishingly small) collisions.
  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO public.share_tokens (
    target_type, target_id, scope, token, created_by, expires_at
  ) VALUES (
    p_target_type, p_target_id, v_scope, v_token, v_caller, p_expires_at
  );

  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_share_token(TEXT, UUID, TIMESTAMPTZ) TO authenticated;

-- ---------------------------------------------------------------------------
-- revoke_share_token(token)
-- Marks the token revoked. Caller must be the original creator.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_share_token(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_updated INTEGER;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.share_tokens
  SET revoked_at = now()
  WHERE token = p_token
    AND created_by = v_caller
    AND revoked_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_share_token(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- resolve_share_token(token)
-- Public resolver — callable by anonymous users. Validates, rate-limits, and
-- returns a redacted JSON blob the share page can render. Returns NULL when
-- the token is unknown, revoked, expired, or rate-limited.
--
-- Rate limit: max 120 resolutions per 60s per token. Sliding window stored
-- on the row itself to avoid a separate audit table. Sufficient for v1; if
-- abuse shows up in logs we can lower or add per-IP via a header proxy.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_share_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.share_tokens%ROWTYPE;
  v_now TIMESTAMPTZ := now();
  v_window_seconds CONSTANT INTEGER := 60;
  v_window_max CONSTANT INTEGER := 120;
  v_payload JSONB;
BEGIN
  SELECT * INTO v_row
  FROM public.share_tokens
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_row.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'revoked');
  END IF;

  IF v_row.expires_at IS NOT NULL AND v_row.expires_at < v_now THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  -- Sliding-window rate-limit. Reset window if it's rolled over.
  IF v_row.rate_window_started_at IS NULL
    OR v_row.rate_window_started_at < v_now - make_interval(secs => v_window_seconds) THEN
    v_row.rate_window_started_at := v_now;
    v_row.rate_window_count := 0;
  END IF;

  IF v_row.rate_window_count >= v_window_max THEN
    RAISE LOG 'share_tokens: rate limit hit for token %', v_row.id;
    RETURN jsonb_build_object('error', 'rate_limited');
  END IF;

  -- Build the redacted payload per target type.
  IF v_row.target_type = 'step' THEN
    SELECT jsonb_build_object(
      'target_type', 'step',
      'step', jsonb_build_object(
        'id', s.id,
        'title', s.title,
        'description', s.description,
        'status', s.status,
        'starts_at', s.starts_at,
        'ends_at', s.ends_at,
        'due_at', s.due_at,
        'completed_at', s.completed_at,
        'created_at', s.created_at,
        'metadata', s.metadata
      ),
      'author', jsonb_build_object(
        'full_name', u.full_name,
        'avatar_url', u.avatar_url
      )
    )
    INTO v_payload
    FROM public.timeline_steps s
    LEFT JOIN public.users u ON u.id = s.user_id
    WHERE s.id = v_row.target_id;
  ELSIF v_row.target_type = 'blueprint' THEN
    SELECT jsonb_build_object(
      'target_type', 'blueprint',
      'blueprint', jsonb_build_object(
        'id', b.id,
        'title', b.title,
        'slug', b.slug,
        'description', b.description,
        'interest_id', b.interest_id,
        'subscriber_count', b.subscriber_count,
        'is_published', b.is_published
      ),
      'author', jsonb_build_object(
        'full_name', u.full_name,
        'avatar_url', u.avatar_url
      ),
      'step_count', (
        SELECT COUNT(*) FROM public.blueprint_steps bs WHERE bs.blueprint_id = b.id
      )
    )
    INTO v_payload
    FROM public.timeline_blueprints b
    LEFT JOIN public.users u ON u.id = b.user_id
    WHERE b.id = v_row.target_id;
  END IF;

  -- Target deleted out from under the token — surface a stable shape so the
  -- public route can render "no longer available" instead of a hard error.
  IF v_payload IS NULL THEN
    RETURN jsonb_build_object('error', 'target_missing');
  END IF;

  UPDATE public.share_tokens
  SET access_count           = v_row.access_count + 1,
      last_accessed_at       = v_now,
      rate_window_started_at = v_row.rate_window_started_at,
      rate_window_count      = v_row.rate_window_count + 1
  WHERE id = v_row.id;

  RETURN v_payload;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_share_token(TEXT) TO anon, authenticated;
