-- Location focus: the user's *current* anchor for Nearby/Atlas surfaces.
-- Replaces the sailing-only home_venue_* snapshot on sailor_profiles as the
-- primary anchor (home_venue_* stays as a fallback + racing-area key).
-- Interest-agnostic, so it lives on public.users.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS location_focus_lat double precision,
  ADD COLUMN IF NOT EXISTS location_focus_lng double precision,
  ADD COLUMN IF NOT EXISTS location_focus_label text,
  ADD COLUMN IF NOT EXISTS location_focus_set_at timestamptz;

COMMENT ON COLUMN public.users.location_focus_label IS
  'Human label for the current location anchor (e.g. "Yung Shue Wan"). Set from the location picker or "use my current location".';
