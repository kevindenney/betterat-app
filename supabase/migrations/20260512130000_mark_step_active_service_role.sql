-- Migration: mark_step_active() — accept p_user_id from service_role callers
--
-- Step Arch B/2 follow-up. Production observation 2026-05-12: the Telegram
-- bot calls `mark_step_active()` via the SERVICE_ROLE client, so `auth.uid()`
-- inside the function is NULL and the central recently-active hook errors
-- out with "mark_step_active: not authenticated".
--
-- Fix: add an optional `p_user_id` argument. When the caller's JWT role is
-- `service_role`, the function trusts that argument (still verifying the
-- step ownership). For any other role we keep the existing auth.uid()
-- behavior — service_role is the only path that can supply p_user_id.
--
-- Additive, backwards-compatible: existing JWT-bearing clients can keep
-- calling mark_step_active(p_step_id, p_source, NULL) — the p_user_id
-- arg has a default of NULL so 2-arg call sites still resolve.
--
-- The legacy 2-arg overload is dropped to avoid Postgres function
-- resolution ambiguity once both signatures exist.

DROP FUNCTION IF EXISTS public.mark_step_active(uuid, text);

CREATE OR REPLACE FUNCTION public.mark_step_active(
  p_step_id uuid,
  p_source  text,
  p_user_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jwt_role text := COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->>'role',
    ''
  );
  v_user_id uuid;
  v_owns    boolean;
BEGIN
  -- Source must be one of the allowed values.
  IF p_source NOT IN ('telegram', 'whatsapp', 'voice', 'in_app', 'web', 'sms') THEN
    RAISE EXCEPTION 'mark_step_active: invalid source %', p_source USING ERRCODE = '22023';
  END IF;

  -- Resolve the effective user_id.
  --
  -- Service-role callers (Telegram/WhatsApp webhooks running with the
  -- SUPABASE_SERVICE_ROLE_KEY) have no auth.uid() and must pass
  -- p_user_id explicitly. We trust their assertion of identity because
  -- the service-role key is server-only and the ownership check below
  -- still gates the write to a step that actually belongs to that user.
  --
  -- Authenticated end-user callers must omit p_user_id; we always use
  -- auth.uid() for them so the function can't be abused to write
  -- recency rows for other users.
  IF v_jwt_role = 'service_role' THEN
    IF p_user_id IS NULL THEN
      RAISE EXCEPTION 'mark_step_active: service_role caller must pass p_user_id'
        USING ERRCODE = '22023';
    END IF;
    v_user_id := p_user_id;
  ELSE
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
      RAISE EXCEPTION 'mark_step_active: not authenticated' USING ERRCODE = '42501';
    END IF;
    -- Authenticated callers may not impersonate.
    IF p_user_id IS NOT NULL AND p_user_id <> v_user_id THEN
      RAISE EXCEPTION 'mark_step_active: cannot specify p_user_id as non-service caller'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Caller (or the impersonated user, for service-role) must own the step.
  -- Guarded explicitly because SECURITY DEFINER bypasses the underlying
  -- table's RLS.
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

-- Re-grant — function signature changed (added arg with default).
REVOKE ALL ON FUNCTION public.mark_step_active(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_step_active(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_step_active(uuid, text, uuid) TO service_role;

COMMENT ON FUNCTION public.mark_step_active(uuid, text, uuid) IS
  'UPSERTs (user_id, p_step_id) into step_recent_activity with last_active_at = now(). '
  'For service_role callers (bot webhooks) p_user_id is required and trusted. '
  'For authenticated end-user callers p_user_id must be NULL or equal auth.uid(). '
  'Silently no-ops if the resolved user does not own the step.';
