-- Cohort audience for venue knowledge (spec §Open questions #1): a post can
-- be addressed to a betterat_org_cohort, visible only to its members.
-- Membership in betterat_org_cohort_members has no status column — row
-- presence is membership.

ALTER TABLE venue_discussions
  DROP CONSTRAINT IF EXISTS venue_discussions_scope_type_check;

ALTER TABLE venue_discussions
  ADD CONSTRAINT venue_discussions_scope_type_check
    CHECK (scope_type IN ('public', 'private', 'fleet', 'org', 'blueprint', 'cohort'));

CREATE OR REPLACE FUNCTION public.can_access_venue_scope(
  p_scope_type TEXT,
  p_scope_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_user_id IS NULL OR p_scope_id IS NULL THEN false
    WHEN p_scope_type = 'fleet' THEN EXISTS (
      SELECT 1 FROM fleet_members fm
      WHERE fm.fleet_id = p_scope_id
        AND fm.user_id = p_user_id
        AND fm.status = 'active'
    )
    WHEN p_scope_type = 'org' THEN EXISTS (
      SELECT 1 FROM organization_memberships om
      WHERE om.organization_id = p_scope_id
        AND om.user_id = p_user_id
        AND (om.status = 'active' OR om.membership_status = 'active')
    )
    WHEN p_scope_type = 'blueprint' THEN EXISTS (
      SELECT 1 FROM blueprint_subscriptions bs
      WHERE bs.blueprint_id = p_scope_id
        AND bs.subscriber_id = p_user_id
    ) OR EXISTS (
      SELECT 1 FROM timeline_blueprints bp
      WHERE bp.id = p_scope_id
        AND bp.user_id = p_user_id
    )
    WHEN p_scope_type = 'cohort' THEN EXISTS (
      SELECT 1 FROM betterat_org_cohort_members cm
      WHERE cm.cohort_id = p_scope_id
        AND cm.user_id = p_user_id
    )
    ELSE false
  END;
$$;

COMMENT ON COLUMN venue_discussions.scope_id IS
  'fleets.id / organizations.id / timeline_blueprints.id / betterat_org_cohorts.id when scope_type is fleet/org/blueprint/cohort; NULL for public/private.';
