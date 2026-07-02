-- Let a blueprint's author (an active org member) link/unlink cohorts, not just
-- org admins. The Studio blueprint editor is shown to faculty authors, but the
-- prior blueprint_cohorts INSERT/DELETE policies required is_org_admin_member,
-- so a faculty author tapping "Assign to cohort" hit a silent RLS rejection.
-- Authoring a cohort assignment for your own blueprint is a teaching action and
-- should be available to the author.

DROP POLICY IF EXISTS blueprint_cohorts_insert_admin_v1 ON public.blueprint_cohorts;
CREATE POLICY blueprint_cohorts_insert_admin_v1 ON public.blueprint_cohorts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.blueprints b
      WHERE b.id = blueprint_cohorts.blueprint_id
        AND (
          is_org_admin_member(b.org_id)
          OR (
            b.author_user_id = (SELECT auth.uid())
            AND is_org_active_member(b.org_id)
          )
        )
    )
  );

DROP POLICY IF EXISTS blueprint_cohorts_delete_admin_v1 ON public.blueprint_cohorts;
CREATE POLICY blueprint_cohorts_delete_admin_v1 ON public.blueprint_cohorts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.blueprints b
      WHERE b.id = blueprint_cohorts.blueprint_id
        AND (
          is_org_admin_member(b.org_id)
          OR (
            b.author_user_id = (SELECT auth.uid())
            AND is_org_active_member(b.org_id)
          )
        )
    )
  );
