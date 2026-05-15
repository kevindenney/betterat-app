-- Concept detail iOS: per-user concept state for variant routing.
-- Supports new / dormant / breakthrough routing without storing user state
-- on shared baseline playbook_concepts rows.

CREATE TABLE IF NOT EXISTS public.playbook_concept_user_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  playbook_id UUID NOT NULL REFERENCES public.playbooks(id) ON DELETE CASCADE,
  concept_id UUID NOT NULL REFERENCES public.playbook_concepts(id) ON DELETE CASCADE,
  progression_state TEXT NOT NULL DEFAULT 'learning'
    CHECK (progression_state IN ('forming', 'learning', 'practicing', 'breakthrough')),
  breakthrough_detected_at TIMESTAMPTZ,
  breakthrough_dismissed_at TIMESTAMPTZ,
  breakthrough_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_state_computed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT playbook_concept_user_state_unique
    UNIQUE (user_id, playbook_id, concept_id)
);

CREATE INDEX IF NOT EXISTS idx_playbook_concept_user_state_user_playbook
  ON public.playbook_concept_user_state(user_id, playbook_id);

CREATE INDEX IF NOT EXISTS idx_playbook_concept_user_state_concept
  ON public.playbook_concept_user_state(concept_id);

CREATE INDEX IF NOT EXISTS idx_playbook_concept_user_state_breakthrough
  ON public.playbook_concept_user_state(user_id, playbook_id, breakthrough_detected_at DESC)
  WHERE breakthrough_detected_at IS NOT NULL
    AND breakthrough_dismissed_at IS NULL;

ALTER TABLE public.playbook_concept_user_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own concept state"
  ON public.playbook_concept_user_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own concept state"
  ON public.playbook_concept_user_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own concept state"
  ON public.playbook_concept_user_state FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own concept state"
  ON public.playbook_concept_user_state FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_playbook_concept_user_state_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_playbook_concept_user_state_updated_at
  ON public.playbook_concept_user_state;

CREATE TRIGGER trigger_playbook_concept_user_state_updated_at
  BEFORE UPDATE ON public.playbook_concept_user_state
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_playbook_concept_user_state_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.playbook_concept_user_state
  TO authenticated;
