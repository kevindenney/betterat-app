-- =============================================================================
-- discover_members_at_org RPC
--
-- The /discover/org/[slug] detail surface wants to show "Members you may know"
-- — a small, curated list of other sailors at this club — to non-members so
-- that joining the club is a richer signal than a cold Request-to-join button.
--
-- The straight `organization_memberships` table read can't power this: RLS on
-- that table only exposes rows belonging to auth.uid() OR to orgs auth.uid()
-- administers. A non-member discovering the club gets zero rows back. That's
-- the right default for the table; the wrong default for discovery.
--
-- This RPC is a SECURITY DEFINER read of the same table that exposes only a
-- privacy-respecting subset: active, non-admin/owner/staff members. The
-- caller can layer profile/follow-graph data on top via separate (RLS-safe)
-- queries against `profiles` and `user_follows`.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.discover_members_at_org(
  p_org_id uuid,
  p_limit  int DEFAULT 12
)
RETURNS TABLE (
  user_id    uuid,
  role       text,
  joined_at  timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    om.user_id,
    om.role,
    om.joined_at
  FROM public.organization_memberships om
  WHERE om.organization_id = p_org_id
    AND om.status = 'active'
    AND om.role NOT IN ('admin', 'owner', 'staff')
    AND om.user_id IS NOT NULL
  ORDER BY om.joined_at NULLS LAST
  LIMIT GREATEST(1, LEAST(p_limit, 50));
$$;

REVOKE ALL ON FUNCTION public.discover_members_at_org(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.discover_members_at_org(uuid, int) TO authenticated;

COMMENT ON FUNCTION public.discover_members_at_org(uuid, int) IS
  'Discovery read of org rosters for the /discover/org detail surface. SECURITY DEFINER bypasses the owner-only RLS on organization_memberships and exposes only active non-admin members so the "Members you may know" section can render to non-members. Caller layers profiles/follow-graph data on top.';
