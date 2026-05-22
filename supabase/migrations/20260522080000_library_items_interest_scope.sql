-- ============================================================================
-- library_items.interest_id — Phase 11 follow-up
-- ============================================================================
-- The Phase 11 library_items table was created as user-scoped only, with no
-- way to express "this PDF belongs to my Nursing interest, not my Sailing
-- one." That made the new BeforeTheShiftCard "+ Pin from library" picker
-- show cross-interest items on every step (e.g. Dragon-class boat-speed
-- references appearing on a Nursing Med-Surg shift).
--
-- This migration adds a nullable interest_id so:
--   - Future captures can be scoped to the active interest at capture time
--   - The picker can filter to items matching the step's interest
--   - Legacy rows stay accessible via a "NULL falls through" filter, giving
--     the user a chance to re-scope without losing visibility
-- ============================================================================

ALTER TABLE public.library_items
  ADD COLUMN IF NOT EXISTS interest_id uuid
  REFERENCES public.interests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS library_items_user_interest_idx
  ON public.library_items(user_id, interest_id);
