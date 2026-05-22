-- ============================================================================
-- step_beats — Phase 11+ "beats" (D33+ Do-tab structured content)
-- ============================================================================
-- A step like "Med-Surg shift" or "Race Day · Race 4" contains a sequence
-- of time-stamped sub-events: a Handoff at 7:00a, an Assessment round at
-- 7:30a; a Skipper meeting at -45, an Off-dock at -30, etc.
--
-- Schema is generic across all interests. The label that fronts the
-- beats list ("SHIFT BEATS", "RACE BEATS", "ROUND BEATS") is configured
-- per-interest in lib/interest-config.ts; the rows themselves are just
-- {time_label, title, body} pairs.
--
-- step_beat_pins (already exists from Phase 11) attaches library items to
-- a specific beat — that's the D37 vision where you pin a PDF to a
-- 7:30a Assessment-round beat.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.step_beats (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id     uuid NOT NULL,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position    integer NOT NULL DEFAULT 0,
  time_label  text,
  title       text NOT NULL,
  body        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS step_beats_step_position_idx
  ON public.step_beats(step_id, position);
CREATE INDEX IF NOT EXISTS step_beats_user_idx
  ON public.step_beats(user_id);

ALTER TABLE public.step_beats ENABLE ROW LEVEL SECURITY;

-- Owner-only for now. Step-collaborator visibility lands when we wire
-- shared steps; the step_collaborators table exists but isn't joined
-- elsewhere in beat-read paths yet.
DROP POLICY IF EXISTS step_beats_owner_rw ON public.step_beats;
CREATE POLICY step_beats_owner_rw ON public.step_beats
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Keep updated_at in sync.
CREATE OR REPLACE FUNCTION public.step_beats_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS step_beats_touch_updated_at ON public.step_beats;
CREATE TRIGGER step_beats_touch_updated_at
  BEFORE UPDATE ON public.step_beats
  FOR EACH ROW EXECUTE FUNCTION public.step_beats_touch_updated_at();
