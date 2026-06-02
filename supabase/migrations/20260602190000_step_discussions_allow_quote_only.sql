-- Allow quote-only discussion posts: a note that carries a cross-step
-- pull-quote (quote_body) but no typed body. Previously the body CHECK
-- required length(body) >= 1, so attaching a quote without typing a
-- reflection left the composer's Send button permanently disabled and
-- the insert would have failed the constraint anyway — a quote-only post
-- was impossible. Body stays NOT NULL (callers send ''), capped at 4000,
-- and a fully-empty post (no body AND no quote) is still rejected.
--
-- Applied to dev project qavekrwdbsobecwrfxwu.

ALTER TABLE public.step_discussions
  DROP CONSTRAINT IF EXISTS step_discussions_body_check;

ALTER TABLE public.step_discussions
  ADD CONSTRAINT step_discussions_body_check
  CHECK (
    length(body) <= 4000
    AND (length(body) >= 1 OR quote_body IS NOT NULL)
  );
