-- Phase 10 · HKDW → BetterAt onboarding
--
-- Schema changes:
-- 1. redeem_tokens — single-use tokens issued ahead of an event. Resolved by
--    the /r/[token] web route; each redemption flips used_at + used_by_user_id.
-- 2. session_accounts — anonymous-but-persistent accounts. A redeem creates a
--    row tied to the session token and the blueprint subscription, valid for
--    3 months. /api/account/claim upgrades it to an email-backed account.
-- 3. resolve_redeem_token(token) helper — public-callable RPC that resolves
--    a token to its blueprint id without exposing the table.
--
-- The sample token HKDW-WLDS-2026-SAMPLE is intentionally NOT seeded here —
-- the redeem service mocks it in non-production environments so dev testing
-- doesn't produce real database side effects.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. REDEEM_TOKENS
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.redeem_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  blueprint_id UUID NOT NULL REFERENCES public.timeline_blueprints(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'hkdw-2026', 'partner')),
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '180 days'),
  used_at TIMESTAMPTZ,
  used_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_redeem_tokens_token ON public.redeem_tokens (token);
CREATE INDEX IF NOT EXISTS idx_redeem_tokens_blueprint ON public.redeem_tokens (blueprint_id);

ALTER TABLE public.redeem_tokens ENABLE ROW LEVEL SECURITY;

-- Tokens are otherwise opaque; redeem flow uses the SECURITY DEFINER RPC
-- below. We DO NOT allow direct anonymous SELECT here.
DROP POLICY IF EXISTS "redeem_tokens_redeemer_read" ON public.redeem_tokens;
CREATE POLICY "redeem_tokens_redeemer_read"
  ON public.redeem_tokens
  FOR SELECT
  USING (auth.uid() = used_by_user_id);

COMMENT ON TABLE public.redeem_tokens IS
  'Single-use invite tokens. Resolved via resolve_redeem_token() and consumed via consume_redeem_token().';

-- Public resolution: returns blueprint_id when valid; nothing when invalid /
-- expired / already used.
CREATE OR REPLACE FUNCTION public.resolve_redeem_token(p_token TEXT)
RETURNS TABLE (
  token TEXT,
  blueprint_id UUID,
  valid_to TIMESTAMPTZ,
  source TEXT,
  already_used BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.redeem_tokens;
BEGIN
  SELECT * INTO v_row
    FROM public.redeem_tokens
   WHERE redeem_tokens.token = p_token
     AND redeem_tokens.valid_from <= NOW()
     AND redeem_tokens.valid_to >= NOW();

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY SELECT
    v_row.token,
    v_row.blueprint_id,
    v_row.valid_to,
    v_row.source,
    v_row.used_at IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_redeem_token(TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.resolve_redeem_token(TEXT) IS
  'Resolves a redeem token to its blueprint without exposing the table. Returns no row when expired or invalid.';

-- Authenticated consume: flips used_at + used_by_user_id atomically. Returns
-- the same shape resolve_redeem_token does plus the resulting blueprint id.
CREATE OR REPLACE FUNCTION public.consume_redeem_token(p_token TEXT, p_user_id UUID)
RETURNS TABLE (
  blueprint_id UUID,
  already_used BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.redeem_tokens;
BEGIN
  SELECT * INTO v_row
    FROM public.redeem_tokens
   WHERE redeem_tokens.token = p_token
     AND redeem_tokens.valid_from <= NOW()
     AND redeem_tokens.valid_to >= NOW()
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_row.used_at IS NOT NULL THEN
    RETURN QUERY SELECT v_row.blueprint_id, TRUE;
    RETURN;
  END IF;

  UPDATE public.redeem_tokens
     SET used_at = NOW(), used_by_user_id = p_user_id
   WHERE id = v_row.id;

  RETURN QUERY SELECT v_row.blueprint_id, FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_redeem_token(TEXT, UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.consume_redeem_token(TEXT, UUID) IS
  'Atomically marks a redeem token used. Returns blueprint_id and an already_used flag if the token was previously consumed.';

-- -----------------------------------------------------------------------------
-- 2. SESSION_ACCOUNTS
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.session_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  redeem_token TEXT REFERENCES public.redeem_tokens(token) ON DELETE SET NULL,
  blueprint_id UUID REFERENCES public.timeline_blueprints(id) ON DELETE SET NULL,
  blueprint_subscription_id UUID,
  source TEXT NOT NULL DEFAULT 'hkdw-2026',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
  claimed_email TEXT,
  claimed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_session_accounts_session_token
  ON public.session_accounts (session_token);

CREATE INDEX IF NOT EXISTS idx_session_accounts_user
  ON public.session_accounts (user_id, created_at DESC);

ALTER TABLE public.session_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "session_accounts_owner_read" ON public.session_accounts;
CREATE POLICY "session_accounts_owner_read"
  ON public.session_accounts
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "session_accounts_owner_update" ON public.session_accounts;
CREATE POLICY "session_accounts_owner_update"
  ON public.session_accounts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.session_accounts IS
  'Anonymous-but-persistent accounts created at redeem time. Upgraded to email-backed accounts via /api/account/claim.';

COMMIT;
