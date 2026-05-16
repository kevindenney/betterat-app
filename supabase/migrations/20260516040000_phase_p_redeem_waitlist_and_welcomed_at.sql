-- Phase P Step 1: dragon_worlds_welcomed_at + redeem_waitlist
--
-- Per docs/redesign/specs/PHASE_P_HKDW_REDEEM.md (commit 8310d216).
--
-- Adds one column to support the server-side dismissal flag for the
-- new /practice welcome banner, and one table for email capture from
-- the non-sailor placeholder routes (/redeem/{spectator,media,race-admin}).
--
-- Application/route wiring lands in subsequent commits behind
-- EXPO_PUBLIC_FF_REDEEM. This migration alone is inert until that flag
-- ships ON in a production build.

BEGIN;

-- ============================================================================
-- 1) dragon_worlds_welcomed_at column on profiles
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN dragon_worlds_welcomed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.dragon_worlds_welcomed_at IS
  'Server-side dismissal timestamp for the Dragon Worlds 2027 welcome banner on /practice. NULL = banner not yet dismissed. Set to now() when the user taps "Got it".';

-- ============================================================================
-- 2) redeem_waitlist table
-- ============================================================================
-- Generic name (not dragon_worlds_waitlist) so future regatta/host-app
-- launches can reuse the same table with a different `source` value.

CREATE TABLE public.redeem_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('spectator', 'media', 'race_admin')),
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.redeem_waitlist IS
  'Email capture from /redeem/<role> placeholder pages for non-sailor HKDW user types (spectator/media/race_admin). Anon-insert only; reads happen out-of-band via Studio.';

CREATE INDEX idx_redeem_waitlist_role ON public.redeem_waitlist(role);
CREATE INDEX idx_redeem_waitlist_source ON public.redeem_waitlist(source);
CREATE UNIQUE INDEX idx_redeem_waitlist_email_role ON public.redeem_waitlist(email, role);

ALTER TABLE public.redeem_waitlist ENABLE ROW LEVEL SECURITY;

-- Allow unauthenticated POSTs from the placeholder pages. The UNIQUE
-- (email, role) index defends against trivial duplicate spam from a single
-- email per role. No SELECT/UPDATE/DELETE policies are granted; admin
-- consumption goes through Studio with the service role.
CREATE POLICY "anon_insert" ON public.redeem_waitlist
  FOR INSERT
  TO anon
  WITH CHECK (true);

COMMIT;
