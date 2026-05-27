-- =====================================================
-- RHKYC placeholder organization — membership audit cleanup
-- =====================================================
--
-- Follow-up to the RHKYC POI removal (20260528050729). Audit of the
-- 9 organization_memberships rows that referenced the placeholder
-- org a1000001-0000-0000-0000-000000000001 revealed:
--
--   - 5 demo seed sailor memberships (user_ids like '11111111-%')
--   - 1 rejected jhu2+denneyke membership (dead state)
--   - 1 pending demo-sailor membership
--   - 3 admin memberships owned by real user accounts
--     (denneyke@gmail.com, kdenney@me.com, Apple privaterelay)
--
-- Delete the 7 cruft rows. Keep the 3 admin rows — those are real
-- user interactions and removing them would unexpectedly revoke
-- access. The placeholder organizations row itself stays in place
-- because of those 3; a future decision is needed about renaming
-- the placeholder when a real RHKYC claim shows up.
-- =====================================================

DELETE FROM public.organization_memberships
 WHERE organization_id = 'a1000001-0000-0000-0000-000000000001'
   AND (
     user_id::text LIKE '11111111-%'
     OR status = 'rejected'
     OR id = '18128ba0-ab36-46f6-badb-134d6f6777e4'  -- demo-sailor leftover
   );
