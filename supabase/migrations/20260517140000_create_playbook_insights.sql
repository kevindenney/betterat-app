-- Phase 2 · iOS register · Universal + sheet
-- Captures dropped via the "💡 A concept to come back to" action route to this
-- table. The Playbook UI to refine these into concepts lands in Phase 6 (the
-- `refined_to_concept_id` foreign key fills in when that refinement happens).
--
-- Distinct semantics from `ai_interest_insights` (AI-derived strengths/patterns)
-- and from `playbook_concepts` (refined knowledge). This table is the raw
-- inbox of user-captured ideas.

CREATE TABLE IF NOT EXISTS playbook_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interest_id UUID,
  kind TEXT NOT NULL CHECK (kind IN ('text', 'voice')),
  content TEXT NOT NULL,
  audio_uri TEXT,
  refined_to_concept_id UUID REFERENCES playbook_concepts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_playbook_insights_user_created
  ON playbook_insights(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_playbook_insights_unrefined
  ON playbook_insights(user_id, created_at DESC)
  WHERE refined_to_concept_id IS NULL;

ALTER TABLE playbook_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "playbook_insights_owner_select"
  ON playbook_insights FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "playbook_insights_owner_insert"
  ON playbook_insights FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "playbook_insights_owner_update"
  ON playbook_insights FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "playbook_insights_owner_delete"
  ON playbook_insights FOR DELETE
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON playbook_insights TO authenticated;
