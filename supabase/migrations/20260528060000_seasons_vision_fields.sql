-- Add vision fields to seasons for the VISION ↔ PROGRESS lane on L3.
--
-- Two columns, both optional:
--   * vision_statement   text  — the human "why" ("podium at HHYC fall
--                                 series" / "land an ICU job at JHH")
--   * vision_competency_ids uuid[] — explicit anchors to entries in the
--                                 user's org's competency framework. When
--                                 present, the progress strip renders one
--                                 mini-bar per competency. When absent,
--                                 progress falls back to an aggregate
--                                 evidence count.
--
-- No FK on the array — we keep it loose so deleting a competency from
-- the org framework doesn't cascade-delete the vision link. The UI
-- filters out stale ids at read time.
--
-- Applied to dev project via Supabase MCP.

BEGIN;

ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS vision_statement text,
  ADD COLUMN IF NOT EXISTS vision_competency_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

COMMENT ON COLUMN public.seasons.vision_statement IS
  'Free-text vision for the arc — what the user wants this season to add up to. Surfaces at the top of the L3 canvas.';
COMMENT ON COLUMN public.seasons.vision_competency_ids IS
  'Optional anchors to org_competencies(id) — when set, the L3 progress strip renders per-competency progress bars instead of an aggregate count.';

COMMIT;
