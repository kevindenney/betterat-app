-- Drop the overly permissive "any authenticated user reads every active
-- membership row" policy. It was added (20260325161500) to let profile pages
-- display a user's org affiliations to visitors — but the cost is too high:
--
--   * Privacy: every signed-in user can SELECT every active membership row in
--     the table (organization_id, user_id, role, joined_at). For org rosters
--     and program enrolments that data should not be globally readable.
--   * Performance: when OR'd with the other SELECT policies, the COALESCE-
--     based predicate is not sargable, so user_id-filtered queries can't
--     reliably use the user_id index.
--
-- The remaining SELECT policies still cover the legitimate read paths:
--   * org_memberships_read_own (user_id = auth.uid())
--   * org_memberships_admin_read_org (has_org_role for org admins/faculty)
--   * organization_memberships_select_own_or_org_admin_v3 (same, via
--     SECURITY DEFINER helper)
--
-- If we later need a "what orgs is this user a member of" public projection
-- for profile pages, expose it via a SECURITY DEFINER function that returns
-- only redacted columns (org name, role) — not the full row.

BEGIN;

DROP POLICY IF EXISTS "org_memberships_read_active_public"
  ON public.organization_memberships;

COMMIT;
