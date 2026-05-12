-- Enable RLS on step_review_backfill_audit.
--
-- Fixes Supabase advisor lint 0013 (rls_disabled_in_public, ERROR level).
-- This table was created in 20260512140000_step_arch_e_backfill_review_sections.sql
-- to snapshot pre-transform metadata.review blobs before the Step E backfill
-- rewrote them. It is written exclusively from a server-side backfill function
-- and never read from the client.
--
-- Enabling RLS without any policy denies all access for anon/authenticated.
-- Service role (used by edge functions and the admin SQL editor) bypasses
-- RLS, which is exactly the access pattern we want here.

ALTER TABLE public.step_review_backfill_audit ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.step_review_backfill_audit IS
  'Step Arch E (2026-05-12) — pre-transform snapshot of metadata.review for each row touched by the legacy-flat-field → sections[] backfill. RLS enabled with no policies: service role only.';
