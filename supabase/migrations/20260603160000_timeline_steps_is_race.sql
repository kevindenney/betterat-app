-- Phase N.4 — Step/Race binary.
--
-- A step is just a step. The only distinction that changes Atlas behavior is
-- race vs not-race: a race carries a venue, course geometry, marks and on-water
-- conditions an ordinary step doesn't, so Atlas renders it ⛵ blue inside its
-- race-area polygon and unlocks the course/marks/conditions cockpit.
--
-- This replaces the never-built `step_kind` enum (Phase M.5) and supersedes the
-- keyword resolver in lib/step-kind-config.ts. The flag is set by the planner in
-- the step composer (mockup 27). Default false: existing steps stay non-race
-- until explicitly flagged; the resolver keeps a keyword fallback during the
-- transition so legacy "race" steps still read as races on Atlas.

ALTER TABLE public.timeline_steps
  ADD COLUMN IF NOT EXISTS is_race boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.timeline_steps.is_race IS
  'Phase N.4 — true when this step is a race (gets Atlas course/marks/conditions). The only first-class step distinction; replaces the step_kind taxonomy.';
