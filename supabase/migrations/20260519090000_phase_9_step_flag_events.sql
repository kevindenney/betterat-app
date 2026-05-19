-- Phase 9 · Hinges — step_flag_events
--
-- Stores the "I want to come back to this" moments a user marks during a step.
-- HingeBuildService pulls these as one of the four sources that fill a hinge's
-- filmstrip (flagged moments / step-less insights / step-less reflections /
-- step_deck adds in the interval).
--
-- This table may have been provisioned ad hoc by earlier work; the IF NOT
-- EXISTS clauses make this migration idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS public.step_flag_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step_id UUID REFERENCES public.timeline_steps(id) ON DELETE CASCADE,
  flagged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  body TEXT,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'auto', 'imported')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_step_flag_events_user_flagged
  ON public.step_flag_events (user_id, flagged_at DESC);

CREATE INDEX IF NOT EXISTS idx_step_flag_events_step
  ON public.step_flag_events (step_id);

ALTER TABLE public.step_flag_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "step_flag_events_owner_read" ON public.step_flag_events;
CREATE POLICY "step_flag_events_owner_read"
  ON public.step_flag_events
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "step_flag_events_owner_insert" ON public.step_flag_events;
CREATE POLICY "step_flag_events_owner_insert"
  ON public.step_flag_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "step_flag_events_owner_update" ON public.step_flag_events;
CREATE POLICY "step_flag_events_owner_update"
  ON public.step_flag_events
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "step_flag_events_owner_delete" ON public.step_flag_events;
CREATE POLICY "step_flag_events_owner_delete"
  ON public.step_flag_events
  FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.step_flag_events IS
  'User-flagged moments. HingeBuildService reads these when expanding the day tiles between two adjacent steps.';

COMMIT;
