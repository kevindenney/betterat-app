-- Generalize playbook_insights into the capture-first Inbox (per
-- docs/redesign/specs/BETTERAT_INBOX_SPEC.md). The table already models
-- "dump now, refine later" for text/voice → concept; this makes it the
-- universal capture pile: links become a first-class kind, a triage state
-- machine (status) tracks unsorted → kept | archived | refined, and a
-- polymorphic refined_to_* pair lets a capture graduate into a step, concept,
-- resource, OR blueprint (not just a concept). Additive; no breaking change.

BEGIN;

-- kind gains 'link' alongside text/voice. A link capture sets source_url;
-- content holds the user's optional one-line note.
ALTER TABLE public.playbook_insights
  DROP CONSTRAINT IF EXISTS playbook_insights_kind_check;
ALTER TABLE public.playbook_insights
  ADD CONSTRAINT playbook_insights_kind_check
  CHECK (kind = ANY (ARRAY['text'::text, 'voice'::text, 'link'::text]));

ALTER TABLE public.playbook_insights
  ADD COLUMN IF NOT EXISTS source_url      TEXT,
  ADD COLUMN IF NOT EXISTS title           TEXT,
  ADD COLUMN IF NOT EXISTS status          TEXT NOT NULL DEFAULT 'unsorted',
  ADD COLUMN IF NOT EXISTS refined_to_type TEXT,
  ADD COLUMN IF NOT EXISTS refined_to_id   UUID;

ALTER TABLE public.playbook_insights
  DROP CONSTRAINT IF EXISTS playbook_insights_status_check;
ALTER TABLE public.playbook_insights
  ADD CONSTRAINT playbook_insights_status_check
  CHECK (status IN ('unsorted', 'kept', 'archived', 'refined'));

ALTER TABLE public.playbook_insights
  DROP CONSTRAINT IF EXISTS playbook_insights_refined_to_type_check;
ALTER TABLE public.playbook_insights
  ADD CONSTRAINT playbook_insights_refined_to_type_check
  CHECK (refined_to_type IS NULL
         OR refined_to_type IN ('step', 'concept', 'resource', 'blueprint'));

-- Back-fill the legacy single-target column into the polymorphic pair so the
-- Inbox sees already-refined concepts as refined. refined_to_concept_id is
-- retained for back-compat; new refinements write the polymorphic pair.
UPDATE public.playbook_insights
SET refined_to_type = 'concept',
    refined_to_id   = refined_to_concept_id,
    status          = 'refined'
WHERE refined_to_concept_id IS NOT NULL
  AND refined_to_type IS NULL;

-- The Inbox surface lists unsorted items newest-first, scoped to the viewer.
CREATE INDEX IF NOT EXISTS playbook_insights_user_status_idx
  ON public.playbook_insights (user_id, status, created_at DESC);

COMMIT;
