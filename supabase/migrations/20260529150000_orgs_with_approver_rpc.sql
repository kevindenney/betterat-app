-- Returns the subset of the given org ids that have at least one active
-- owner/admin/manager who could actually approve a join request.
-- SECURITY DEFINER because organization_memberships RLS is owner-only, so a
-- prospective (non-member) joiner cannot count approvers client-side.
CREATE OR REPLACE FUNCTION public.orgs_with_approver(p_org_ids uuid[])
RETURNS TABLE (organization_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT m.organization_id
  FROM organization_memberships m
  WHERE m.organization_id = ANY(p_org_ids)
    AND m.role IN ('owner', 'admin', 'manager')
    AND m.status = 'active';
$$;

GRANT EXECUTE ON FUNCTION public.orgs_with_approver(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.orgs_with_approver(uuid[]) TO anon;
