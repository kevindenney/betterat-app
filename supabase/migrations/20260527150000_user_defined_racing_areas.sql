-- =====================================================
-- User-defined racing areas
--
-- Atlas v1 lets sailors draw their own racing areas without needing
-- a known sailing_venues row (their club may not be in BetterAt yet).
-- Three small changes:
--   1. venue_id becomes nullable so creators can anchor an area to a
--      lat/lng instead of a venue.
--   2. verification_status defaults to 'pending' for new rows — only
--      community confirmations (3+) promote to 'verified'. Existing
--      'official' seeds keep their explicit values.
--   3. A delete policy so creators can remove their own unverified
--      community areas (verified areas are community property at that
--      point and need a different flow).
-- =====================================================

-- 1. Nullable venue_id
ALTER TABLE public.venue_racing_areas
    ALTER COLUMN venue_id DROP NOT NULL;

-- 2. Default verification_status to 'pending'
ALTER TABLE public.venue_racing_areas
    ALTER COLUMN verification_status SET DEFAULT 'pending';

-- 3. Delete policy for own unverified community areas.
--    auth.uid() wrapped in (SELECT ...) per RLS perf guidance.
DROP POLICY IF EXISTS "racing_areas_delete_own" ON public.venue_racing_areas;
CREATE POLICY "racing_areas_delete_own" ON public.venue_racing_areas
    FOR DELETE USING (
        source = 'community'
        AND created_by = (SELECT auth.uid())
        AND verification_status <> 'verified'
    );

COMMENT ON COLUMN public.venue_racing_areas.venue_id IS
    'Optional reference to sailing_venues. NULL when the area is user-defined and the venue/club is not yet in BetterAt.';
