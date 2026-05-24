-- Phase 4x · org_sso_directory_cache
-- Mirrors what an Okta / Azure AD SCIM sync would surface for an org.
-- For demo + mock: a manual seed; in production this would be filled
-- by a background sync job pulling from the configured IdP.

CREATE TABLE IF NOT EXISTS public.org_sso_directory_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sso_user_id text NOT NULL,
  email text NOT NULL,
  first_name text,
  last_name text,
  role_hint text,
  department text,
  title text,
  is_active boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, sso_user_id),
  UNIQUE (org_id, email)
);

CREATE INDEX IF NOT EXISTS idx_org_sso_directory_org
  ON public.org_sso_directory_cache(org_id, last_synced_at DESC);

ALTER TABLE public.org_sso_directory_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ssodir_admin_read" ON public.org_sso_directory_cache;
CREATE POLICY "ssodir_admin_read"
  ON public.org_sso_directory_cache FOR SELECT
  USING (public.is_org_admin_member(org_id));

DROP POLICY IF EXISTS "ssodir_admin_write" ON public.org_sso_directory_cache;
CREATE POLICY "ssodir_admin_write"
  ON public.org_sso_directory_cache FOR ALL
  USING (public.is_org_admin_member(org_id))
  WITH CHECK (public.is_org_admin_member(org_id));

COMMENT ON TABLE public.org_sso_directory_cache IS
  'Last-synced view of users from the org SSO directory (Okta/Azure SCIM). Source of truth for "From SSO directory" bulk invite picker.';
