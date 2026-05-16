-- Add `is_timed` to timeline_steps so the Do tab can branch on whether this
-- step is a stopwatch-style activity (race, starting drill, interval workout)
-- or just a capture surface for observations.
--
-- Default false: the dominant case across every interest — including sail
-- racing — is "drop notes / photos here, no elapsed-time data needed."
-- Race-day, starting drills, and interval workouts opt in by flipping
-- is_timed = true on the step. The Do tab's auto-stamp of metadata.act.started_at
-- is gated on (is_timed === true) when the per-step-timing feature flag is on.
--
-- Existing rows: backfilled to false. Steps that already have
-- metadata.act.started_at stamped will continue to render the live UI because
-- deriveDoInteriorState treats a populated started_at as 'live' regardless of
-- is_timed. The change is forward-looking for new steps and the new opt-in toggle.

ALTER TABLE timeline_steps
  ADD COLUMN IF NOT EXISTS is_timed BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN timeline_steps.is_timed IS
  'True if this step is an elapsed-time activity (race, starting drill, interval workout). Drives the Do tab auto-stamp of metadata.act.started_at and the live header / stop-capturing UI. Default false: most steps in most interests are untimed capture surfaces.';
