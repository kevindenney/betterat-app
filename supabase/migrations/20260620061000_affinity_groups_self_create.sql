-- Let authenticated users create lightweight peer groups. This deliberately
-- excludes institutional cohorts: those remain betterat_org_cohorts rows
-- created by organization admins.

BEGIN;

DROP POLICY IF EXISTS "affinity_groups_self_create_v1" ON public.affinity_groups;
CREATE POLICY "affinity_groups_self_create_v1"
  ON public.affinity_groups FOR INSERT
  TO authenticated
  WITH CHECK (
    kind IN ('crew_pod', 'practice_group')
    AND is_active = true
    AND parent_org_id IS NULL
  );

COMMENT ON POLICY "affinity_groups_self_create_v1" ON public.affinity_groups
  IS 'Users can create lightweight peer-run groups. Official org cohorts stay admin-created in betterat_org_cohorts.';

COMMIT;
