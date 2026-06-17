-- Self-serve "leave organization": let a member delete their own
-- membership row. Until now organization_memberships had INSERT
-- (open_join / request_to_join) and admin UPDATE (approve/reject)
-- policies but NO DELETE policy, so a user who joined had no way out —
-- a self-delete silently affected 0 rows under RLS.
--
-- Scope is deliberately narrow: a user may remove ONLY their own row
-- (user_id = auth.uid()). Admin removal of other members stays a
-- separate (future) admin policy. Sole-owner orphan protection is
-- enforced in the app layer (the Leave control is hidden for owners,
-- who must transfer or archive the org first); a DB-level trigger guard
-- is a possible follow-up.
--
-- auth.uid() is wrapped as (SELECT auth.uid()) so Postgres caches it as
-- an initplan instead of re-evaluating per row (see the RLS initplan
-- hardening migrations).

BEGIN;

DROP POLICY IF EXISTS "organization_memberships_delete_own_v1" ON public.organization_memberships;
CREATE POLICY "organization_memberships_delete_own_v1"
  ON public.organization_memberships FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

COMMENT ON POLICY "organization_memberships_delete_own_v1" ON public.organization_memberships
  IS 'Users can delete (leave) their own membership row. Admin removal of others is a separate policy.';

COMMIT;
