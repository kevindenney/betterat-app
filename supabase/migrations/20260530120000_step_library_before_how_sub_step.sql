-- Anchor a "before the shift" library link to a specific How sub-step.
-- how_sub_steps live as JSON in step metadata (plan.how_sub_steps[].id), so
-- this is a logical text reference, not an enforced FK. NULL = step-level link
-- (the existing "From your library, before shift" card); non-NULL pins the
-- item under one How checklist row on the Do tab (e.g. "Read chapter 1").
ALTER TABLE public.step_library_before
  ADD COLUMN IF NOT EXISTS how_sub_step_id text;

CREATE INDEX IF NOT EXISTS step_library_before_how_sub_step_idx
  ON public.step_library_before(step_id, how_sub_step_id);

COMMENT ON COLUMN public.step_library_before.how_sub_step_id IS
  'Optional plan.how_sub_steps[].id this link is pinned to; NULL = step-level.';
