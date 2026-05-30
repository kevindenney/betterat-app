-- ============================================================================
-- step_library_before.beat_id — anchor library pins to a step beat
-- ============================================================================
-- How sub-steps live in step metadata JSON (client string ids) and are
-- anchored via how_sub_step_id. Beats are real step_beats rows (uuid). To
-- mirror the per-item library pin onto beats we add a dedicated beat_id
-- column rather than overloading the text how_sub_step_id with uuids.
--
-- A pin is anchored to at most one of: how sub-step, beat, or neither
-- (step-level "Before the shift").
-- ============================================================================

ALTER TABLE public.step_library_before
  ADD COLUMN IF NOT EXISTS beat_id uuid
    REFERENCES public.step_beats(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS step_library_before_beat_idx
  ON public.step_library_before(beat_id)
  WHERE beat_id IS NOT NULL;
