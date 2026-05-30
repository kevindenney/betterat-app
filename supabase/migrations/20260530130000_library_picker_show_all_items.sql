-- ============================================================================
-- library_items_for_picker — show ALL the caller's items
-- ============================================================================
-- The picker previously filtered to "tagged for this interest OR untagged",
-- which hid items captured under a different interest. For a polymath that
-- reads as "why don't I see all my library resources?" when pinning a
-- reference to a step.
--
-- New behaviour: return everything the caller owns. p_interest_id is now a
-- *sort hint* rather than a filter — interest-matched items surface first,
-- then untagged "everywhere" items, then items tagged only to other
-- interests. captured_at DESC breaks ties so recent captures stay on top.
-- ============================================================================

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
  ORDER BY
    CASE
      WHEN p_interest_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.library_item_interests lii
        WHERE lii.item_id = li.id AND lii.interest_id = p_interest_id
      ) THEN 0
      WHEN NOT EXISTS (
        SELECT 1 FROM public.library_item_interests lii
        WHERE lii.item_id = li.id
      ) THEN 1
      ELSE 2
    END,
    li.captured_at DESC
  LIMIT 200;
$$;
