-- ============================================================================
-- Playbook scheduled jobs — weekly cron
-- ============================================================================
-- Schedules the `playbook-scheduled-jobs` edge function to run weekly so the
-- pattern-detect and weekly-review jobs keep every eligible user's Playbook
-- suggestion queue fresh (Vercel crons are paused project-wide). The function
-- itself only ENQUEUES `pending` suggestions — materialization into
-- playbook_concepts/_patterns/_reviews remains a user-curated step.
--
-- Mechanism: pg_cron fires a SQL command that uses pg_net (`net.http_post`) to
-- POST to the edge function with the shared `x-cron-secret` header. The secret
-- is read from Supabase Vault at fire time (NOT hardcoded here) so it never
-- lands in version control. The Vault secret `playbook_jobs_cron_secret` must
-- be created out-of-band (see the deploy steps) and must match the function's
-- CRON_SECRET env var.
--
-- Idempotent: unschedules any prior job of the same name before rescheduling.
-- Guarded so `supabase db push` never hard-fails if pg_cron is unavailable.

DO $$
DECLARE
  v_function_url TEXT := 'https://qavekrwdbsobecwrfxwu.supabase.co/functions/v1/playbook-scheduled-jobs';
  v_command TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'pg_net not installed — cannot schedule playbook jobs via HTTP. Skipping.';
    RETURN;
  END IF;

  -- Drop any previous instance so this migration is safely re-runnable.
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'playbook-weekly-jobs') THEN
    PERFORM cron.unschedule('playbook-weekly-jobs');
  END IF;

  -- The scheduled command: POST to the edge function, pulling the shared secret
  -- from Vault at fire time. format() with %L safely quotes the literal URL.
  v_command := format($cmd$
    SELECT net.http_post(
      url := %L,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'playbook_jobs_cron_secret'
        )
      ),
      body := '{"job":"both"}'::jsonb
    );
  $cmd$, v_function_url);

  -- Monday 09:00 UTC, weekly (both jobs).
  PERFORM cron.schedule('playbook-weekly-jobs', '0 9 * * 1', v_command);

  RAISE NOTICE 'Scheduled playbook-weekly-jobs (Mon 09:00 UTC).';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule playbook-weekly-jobs: %', SQLERRM;
END $$;
