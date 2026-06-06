-- =============================================================================
-- org_active_member_count RPC
--
-- The public org showcase (app/org/[slug].web.tsx) wants a single headline
-- number: how many active, non-staff members an org has — e.g. "6 women
-- running their own business". A direct read of organization_memberships can't
-- power this for a non-member/anonymous visitor: RLS on that table only exposes
-- rows belonging to auth.uid() or to orgs auth.uid() administers, so the
-- showcase rendered 0.
--
-- This is a SECURITY DEFINER COUNT (no PII leaves the function) that bypasses
-- the owner-only RLS and exposes only the aggregate. It excludes admin/owner/
-- staff so the number reflects participants (students, sailors, the women), not
-- the field team running the org. Granted to anon + authenticated because the
-- showcase is a public marketing surface.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.org_active_member_count(p_org_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COUNT(*)::int
  FROM public.organization_memberships om
  WHERE om.organization_id = p_org_id
    AND (om.status = 'active' OR om.membership_status = 'active')
    AND (om.role IS NULL OR om.role NOT IN ('admin', 'owner', 'staff'));
$$;

REVOKE ALL ON FUNCTION public.org_active_member_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_active_member_count(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.org_active_member_count(uuid) IS
  'Public aggregate count of active non-staff members for an org, for the public org showcase. SECURITY DEFINER bypasses owner-only RLS on organization_memberships and returns only the integer count (no PII). Excludes admin/owner/staff.';
