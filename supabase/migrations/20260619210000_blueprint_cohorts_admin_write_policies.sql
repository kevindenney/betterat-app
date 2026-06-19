-- blueprint_cohorts: add admin write policies.
--
-- RLS was enabled with only an org-member SELECT policy
-- ("blueprint_cohorts_org_member_read"), so INSERT/DELETE from the
-- authenticated role were default-denied. That left the Creator Studio
-- "Add a cohort" control (link a blueprint to an org cohort) unable to
-- persist. Mirror the betterat_org_cohorts/_cohort_members pattern: an org
-- admin of the BLUEPRINT's org may link and unlink cohorts. The cohort_id
-- FK already constrains the target to public.betterat_org_cohorts.

DROP POLICY IF EXISTS "blueprint_cohorts_insert_admin_v1" ON public.blueprint_cohorts;
CREATE POLICY "blueprint_cohorts_insert_admin_v1"
  ON public.blueprint_cohorts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.blueprints b
      WHERE b.id = blueprint_id
        AND public.is_org_admin_member(b.org_id)
    )
  );

DROP POLICY IF EXISTS "blueprint_cohorts_delete_admin_v1" ON public.blueprint_cohorts;
CREATE POLICY "blueprint_cohorts_delete_admin_v1"
  ON public.blueprint_cohorts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.blueprints b
      WHERE b.id = blueprint_id
        AND public.is_org_admin_member(b.org_id)
    )
  );
