-- Step discussion cross-step quote.
--
-- A discussion note may quote another step the author can read. The picker
-- in the composer enforces "any step the viewer can read" at write time —
-- the column itself is a plain FK with no extra constraint, so a quoted
-- step that later becomes private still renders as the existing quote_body
-- snapshot (we never re-fetch the live step body).
--
-- quote_body is a free-text snippet the author picks/edits at compose time
-- so the quote stays meaningful even if the original step's plan changes.

BEGIN;

ALTER TABLE public.step_discussions
  ADD COLUMN IF NOT EXISTS quoted_step_id UUID
    REFERENCES public.timeline_steps(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quote_body TEXT
    CHECK (quote_body IS NULL OR length(quote_body) BETWEEN 1 AND 600);

CREATE INDEX IF NOT EXISTS idx_step_discussions_quoted_step
  ON public.step_discussions (quoted_step_id)
  WHERE quoted_step_id IS NOT NULL;

COMMENT ON COLUMN public.step_discussions.quoted_step_id IS
  'Optional FK to a step this note quotes (Discuss tab cross-step reference).';
COMMENT ON COLUMN public.step_discussions.quote_body IS
  'Snippet captured at compose time so the quote stays meaningful even if the source step changes.';

COMMIT;
