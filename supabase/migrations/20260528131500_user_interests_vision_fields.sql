-- Move vision off seasons (calendar partitions, shared across interests)
-- onto user_interests (per-persona, the actual conceptual home of
-- "what am I building toward").
--
-- seasons.vision_* columns stay in place for one release as a
-- deprecation shim; new reads/writes go through user_interests.
--
-- Applied to dev project via Supabase MCP.

ALTER TABLE public.user_interests
  ADD COLUMN IF NOT EXISTS vision_statement text,
  ADD COLUMN IF NOT EXISTS vision_competency_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

COMMENT ON COLUMN public.user_interests.vision_statement IS
  'Free-text vision for this interest — what the user wants this persona to add up to. Surfaces at the top of the L3 canvas for this interest. Per-(user, interest), not per-season — visions persist across calendar partitions.';
COMMENT ON COLUMN public.user_interests.vision_competency_ids IS
  'Optional anchors to org_competencies(id) for this interest''s vision — when set, the L3 progress strip renders per-competency progress bars instead of an aggregate count.';
