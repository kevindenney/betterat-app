-- =============================================================================
-- Seed sailors: profile_public = true
--
-- The four hand-crafted RHKYC Dragon helms (Markus Tham, Yvonne Leung, Ricardo
-- Costa, Tomás Renart) anchor every discovery demo. They must be reachable from
-- the /discover/org/[slug] surface to non-members, which means their profile
-- rows have to pass the profile-discovery RLS:
--
--   profile_public = true
--   OR viewer follows the profile
--   OR viewer shares an org with the profile
--
-- A first-time visitor to RHKYC's club page satisfies none of those without the
-- public flag, so the "Members you may know" section comes up empty. Flipping
-- profile_public = true is the honest fix — these accounts are *explicitly*
-- discoverable personas, not real users with privacy preferences.
-- =============================================================================

UPDATE public.profiles
SET profile_public = true
WHERE id IN (
  '11111111-1111-1111-1111-000000000001',  -- Markus Tham
  '11111111-1111-1111-1111-000000000002',  -- Yvonne Leung
  '11111111-1111-1111-1111-000000000003',  -- Ricardo Costa
  '11111111-1111-1111-1111-000000000004'   -- Tomás Renart
);
