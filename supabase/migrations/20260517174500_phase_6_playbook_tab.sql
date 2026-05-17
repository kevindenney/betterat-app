-- Phase 6 · Playbook tab
--
-- Extends the existing Playbook system with a lighter-weight concept lifecycle
-- used by the iOS register landing + concept detail surfaces.

ALTER TABLE public.playbook_concepts
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'forming'
    CHECK (state IN ('seed', 'forming', 'testing', 'settled')),
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS settled_by_promotion_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_synthesis_text TEXT,
  ADD COLUMN IF NOT EXISTS ai_synthesis_drafted_at TIMESTAMPTZ;

UPDATE public.playbook_concepts
SET body = COALESCE(NULLIF(body, ''), body_md)
WHERE body IS NULL;

CREATE INDEX IF NOT EXISTS idx_playbook_concepts_state
  ON public.playbook_concepts(user_id, interest_id, state, created_at DESC);

CREATE TABLE IF NOT EXISTS public.step_concept_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID NOT NULL REFERENCES public.timeline_steps(id) ON DELETE CASCADE,
  concept_id UUID NOT NULL REFERENCES public.playbook_concepts(id) ON DELETE CASCADE,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT step_concept_links_unique UNIQUE (step_id, concept_id)
);

CREATE INDEX IF NOT EXISTS idx_step_concept_links_step
  ON public.step_concept_links(step_id, linked_at DESC);

CREATE INDEX IF NOT EXISTS idx_step_concept_links_concept
  ON public.step_concept_links(concept_id, linked_at DESC);

ALTER TABLE public.step_concept_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Access step concept links via parent step" ON public.step_concept_links;
CREATE POLICY "Access step concept links via parent step"
  ON public.step_concept_links FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.timeline_steps ts
      WHERE ts.id = step_concept_links.step_id
        AND ts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.timeline_steps ts
      WHERE ts.id = step_concept_links.step_id
        AND ts.user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.step_concept_links
  TO authenticated;

CREATE TABLE IF NOT EXISTS public.concept_trail_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id UUID NOT NULL REFERENCES public.playbook_concepts(id) ON DELETE CASCADE,
  capture_id TEXT NOT NULL,
  quote_text TEXT NOT NULL,
  source_label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_concept_trail_quotes_concept
  ON public.concept_trail_quotes(concept_id, created_at DESC);

ALTER TABLE public.concept_trail_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own concept trail quotes" ON public.concept_trail_quotes;
CREATE POLICY "Users can view own concept trail quotes"
  ON public.concept_trail_quotes FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.playbook_concepts pc
      WHERE pc.id = concept_trail_quotes.concept_id
        AND pc.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own concept trail quotes" ON public.concept_trail_quotes;
CREATE POLICY "Users can insert own concept trail quotes"
  ON public.concept_trail_quotes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.playbook_concepts pc
      WHERE pc.id = concept_trail_quotes.concept_id
        AND pc.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own concept trail quotes" ON public.concept_trail_quotes;
CREATE POLICY "Users can update own concept trail quotes"
  ON public.concept_trail_quotes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.playbook_concepts pc
      WHERE pc.id = concept_trail_quotes.concept_id
        AND pc.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.playbook_concepts pc
      WHERE pc.id = concept_trail_quotes.concept_id
        AND pc.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own concept trail quotes" ON public.concept_trail_quotes;
CREATE POLICY "Users can delete own concept trail quotes"
  ON public.concept_trail_quotes FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.playbook_concepts pc
      WHERE pc.id = concept_trail_quotes.concept_id
        AND pc.user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.concept_trail_quotes
  TO authenticated;

ALTER TABLE public.playbook_insights
  ADD COLUMN IF NOT EXISTS refined_to_concept_id UUID REFERENCES public.playbook_concepts(id) ON DELETE SET NULL;
