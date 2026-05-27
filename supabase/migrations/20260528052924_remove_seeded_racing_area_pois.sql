-- =====================================================
-- Companion cleanup to 20260528050729 (disable seeded official
-- venue_racing_areas). Removes the 4 seeded racing-area POIs in
-- atlas_pois — the ones the user sees as pins on the map firing
-- the generic "Plan a step here" sheet.
--
-- Rows removed: Victoria Harbour, Port Shelter, Middle Island
-- channel, Lamma Channel. None of them are claimed by a real
-- organization (claimed_by_org_id IS NULL), and their shapes /
-- locations were rough approximations.
--
-- atlas_pois has no is_active column so this is a hard delete.
-- Schema stays — atlas_pois.kind = 'racing_area' is still a valid
-- kind for the future claimed-org flow.
-- =====================================================

DELETE FROM public.atlas_pois
 WHERE kind = 'racing_area'
   AND claimed_by_org_id IS NULL;
