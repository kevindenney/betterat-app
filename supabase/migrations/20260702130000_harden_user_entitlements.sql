-- Harden user entitlement columns against two ship-blocker findings:
--
--  #6a  Reverse trials never expire. Signup grants subscription_tier='individual'
--       + subscription_status='trialing', but nothing ever downgrades an expired
--       trial (the reverseTrialService.expireTrial function has zero callers and
--       Vercel crons are paused). Result: every trial learner keeps paid access
--       forever. 247 users currently sit in 'trialing'.
--
--  #4   Any authenticated user can self-grant a paid tier by writing straight to
--       their own users row (the UPDATE RLS policy has no column scoping), because
--       the entitlement gate reads users.subscription_tier directly.
--
-- Fix #6a with a pg_cron job that expires past-due trials server-side, and a
-- read-time guard in the client gate (separate change). Fix #4 with a narrow
-- BEFORE UPDATE trigger that blocks the two actual bypass vectors — a client
-- self-activating a paid tier, and a client extending its trial past the window —
-- while still allowing every legitimate client write (signup grant, onboarding
-- plan choice, team/club downgrades). Legitimate paid activation only ever comes
-- from the Stripe/RevenueCat webhooks, which run as service_role and are exempt.

-- ── #6a: server-side trial expiry ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.expire_due_reverse_trials()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  WITH expired AS (
    UPDATE public.users
    SET subscription_tier = 'free',
        subscription_status = 'expired'
    WHERE subscription_status = 'trialing'
      AND trial_ends_at IS NOT NULL
      AND trial_ends_at < now()
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM expired;
  RETURN v_count;
END;
$function$;

-- Run daily at 03:10 UTC. Unschedule any prior definition first so this migration
-- is idempotent.
DO $cron$
BEGIN
  PERFORM cron.unschedule('expire-due-reverse-trials')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-due-reverse-trials');
  PERFORM cron.schedule(
    'expire-due-reverse-trials',
    '10 3 * * *',
    $$SELECT public.expire_due_reverse_trials();$$
  );
END;
$cron$;

-- ── #4: block client self-grant of a paid tier ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_user_entitlement_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid  uuid := (SELECT auth.uid());
  v_role text := (SELECT auth.role());
BEGIN
  -- Trusted writers: pg_cron / migrations (no auth.uid) and the payment webhooks
  -- (service_role). They may set any entitlement state.
  IF v_uid IS NULL OR v_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- An authenticated client is editing its own row. Permit trials and free/
  -- downgrade writes (signup grant, onboarding plan choice, team + club flows).
  -- Never let a client mark itself active on a paid tier — that state only ever
  -- comes from a webhook. Revert just the offending columns so unrelated column
  -- updates in the same statement still land.
  IF NEW.subscription_status = 'active'
     AND COALESCE(NEW.subscription_tier, 'free') <> 'free'
     AND (NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
          OR NEW.subscription_tier   IS DISTINCT FROM OLD.subscription_tier) THEN
    NEW.subscription_tier   := OLD.subscription_tier;
    NEW.subscription_status := OLD.subscription_status;
  END IF;

  -- And never let a client push its trial end date beyond the ~2-week window, so a
  -- self-granted trial can't be stretched into a permanent free paid tier.
  IF NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at
     AND NEW.trial_ends_at > (now() + interval '15 days') THEN
    NEW.trial_ends_at := OLD.trial_ends_at;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_user_entitlement_columns ON public.users;
CREATE TRIGGER trg_guard_user_entitlement_columns
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_entitlement_columns();
