-- Document intentional service-role-only access on payment-side tables.
--
-- Supabase advisor lint 0008 (rls_enabled_no_policy, INFO) keeps flagging
-- these tables. They have RLS enabled with no policies, which denies all
-- anon/authenticated access and falls through to service_role bypass —
-- exactly what we want for server-side-only data.
--
-- analytics_events, dragonworlds_bot_state, step_review_backfill_audit,
-- and stripe_webhook_events already have explanatory COMMENT ON TABLE
-- statements making this intent explicit. platform_transfers — the
-- platform → connected-account transfer ledger written exclusively
-- from supabase/functions/stripe-webhooks/index.ts — was missing one.
-- Adding it brings the documentation in line with the other tables.

COMMENT ON TABLE public.platform_transfers IS
  'Stripe platform → connected-account transfer ledger. Written exclusively from the stripe-webhooks edge function (transfer.created handler). RLS enabled with no policies: service role only.';
