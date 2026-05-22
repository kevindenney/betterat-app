-- ============================================================================
-- library_item_interests — Phase 11 follow-up
-- ============================================================================
-- The Phase 11 library_items table got a single nullable interest_id in
-- 20260522080000 to stop cross-interest leakage in the BeforeTheShiftCard
-- picker. But BetterAt users are polymaths — a Bates physical-exam video
-- applies to Nursing AND ER fellowship; a leadership podcast spans
-- coaching, work, and parenting. Single-interest scope forces them to
-- duplicate-capture, which is wrong for who the product is for.
--
-- This migration adds a many-to-many join: library_item_interests. The
-- existing library_items.interest_id stays as "primary / captured-in" for
-- sort/display purposes, but picker filtering goes through this join so
-- one item can live in every interest it's relevant to.
--
-- Semantics:
--   - Item with tags in join → relevant only to those interests
--   - Item with NO tags in join → "everywhere" fallback (legacy + casual)
--
-- The accompanying RPC library_items_for_picker(p_interest_id) wraps the
-- "tagged for this interest OR completely untagged" query so the JS
-- client can express it in one round-trip.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.library_item_interests (
  item_id     uuid NOT NULL REFERENCES public.library_items(id) ON DELETE CASCADE,
  interest_id uuid NOT NULL REFERENCES public.interests(id) ON DELETE CASCADE,
  added_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, interest_id)
);

CREATE INDEX IF NOT EXISTS library_item_interests_interest_idx
  ON public.library_item_interests(interest_id, item_id);

ALTER TABLE public.library_item_interests ENABLE ROW LEVEL SECURITY;

-- Owner of the library_item manages the tags.
DROP POLICY IF EXISTS library_item_interests_owner_rw ON public.library_item_interests;
CREATE POLICY library_item_interests_owner_rw ON public.library_item_interests
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.library_items li
    WHERE li.id = library_item_interests.item_id
      AND li.user_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.library_items li
    WHERE li.id = library_item_interests.item_id
      AND li.user_id = (SELECT auth.uid())
  ));

-- Backfill: any existing library_items row that has a captured-in interest_id
-- gets a starting tag in the join. (Zero rows today since CaptureSheet
-- hasn't been wired to write interest_id yet, but keep this future-safe.)
INSERT INTO public.library_item_interests (item_id, interest_id)
SELECT id, interest_id
FROM public.library_items
WHERE interest_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Picker RPC: items where EITHER tagged for this interest OR completely
-- untagged. If p_interest_id is NULL, return everything the caller owns
-- (caller is the global-picker case once one exists).
CREATE OR REPLACE FUNCTION public.library_items_for_picker(p_interest_id uuid DEFAULT NULL)
RETURNS SETOF public.library_items
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT li.*
  FROM public.library_items li
  WHERE li.user_id = (SELECT auth.uid())
    AND (
      p_interest_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.library_item_interests lii
        WHERE lii.item_id = li.id AND lii.interest_id = p_interest_id
      )
      OR NOT EXISTS (
        SELECT 1 FROM public.library_item_interests lii
        WHERE lii.item_id = li.id
      )
    )
  ORDER BY li.captured_at DESC
  LIMIT 200;
$$;
