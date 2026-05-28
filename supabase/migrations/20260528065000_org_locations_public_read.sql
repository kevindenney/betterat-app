-- organization_locations: public read for the org-detail embedded map
--
-- The old `org_locations_read` policy required the viewing user to be
-- a member of the org. The org detail page (linked from Atlas and
-- Discover) is a discovery surface — a prospective Johns Hopkins
-- nursing student must see all six Baltimore sites without first
-- joining. Without this fix the SELECT returns zero rows silently and
-- the embedded MapLibre canvas renders its empty state.
--
-- Writes (insert/update/delete) remain owner/admin-only via the
-- existing `org_locations_manage` policy.

DROP POLICY IF EXISTS org_locations_read ON public.organization_locations;

CREATE POLICY org_locations_public_read
  ON public.organization_locations
  FOR SELECT
  TO anon, authenticated
  USING (true);
