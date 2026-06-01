-- Add the missing FK on step_location.step_id → timeline_steps.id.
--
-- step_location had no constraint tying a pin to its backing step, which is
-- how 25 demo-seed rows accrued step_ids with no timeline_steps row: the pin
-- rendered on Atlas (atlas_peer_steps_near reads step_location directly under
-- SECURITY DEFINER) but tapping it dead-ended on "Step not found" because
-- /step/[id] reads timeline_steps under RLS. The 20260602140000 migration
-- backfilled the existing orphans; this stops new ones from accruing.
--
-- ON DELETE CASCADE: a location pin is meaningless without its step, so when
-- a timeline_step is deleted its pin should disappear with it (rather than
-- becoming a fresh orphan). step_id is NOT NULL and all rows now resolve, so
-- the constraint is added as VALID directly.
--
-- Applied to dev project qavekrwdbsobecwrfxwu.

ALTER TABLE public.step_location
  ADD CONSTRAINT step_location_step_fk
  FOREIGN KEY (step_id) REFERENCES public.timeline_steps(id) ON DELETE CASCADE;
