-- Optional fleet ownership for a blueprint. When set, the blueprint
-- is published by a fleet — its cohort discussion threads become the
-- fleet's per-step conversation, and the Watch tab can surface posts
-- as "your fleet · {blueprint} · {step}" stream items.
--
-- Nullable: orgs and individuals can still publish blueprints without
-- a fleet attribution. ON DELETE SET NULL so deleting a fleet doesn't
-- cascade-wipe its published blueprints.
--
-- Applied to dev project via Supabase MCP.

ALTER TABLE public.blueprints
  ADD COLUMN IF NOT EXISTS fleet_id uuid
    REFERENCES public.fleets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_blueprints_fleet
  ON public.blueprints(fleet_id)
  WHERE fleet_id IS NOT NULL;

COMMENT ON COLUMN public.blueprints.fleet_id IS
  'Optional FK to fleets — when set, the blueprint is fleet-published. Cohort discussion on its blueprint_steps becomes the fleet''s shared thread; Watch tab can attribute activity to the fleet.';
