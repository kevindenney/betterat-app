-- Phase 4o · org_sso_config + org_verified_domains
-- SAML 2.0 config, attribute mappings, auto-add policy, and the
-- verified domains the admin Security surface (SSO & domain) needs to
-- persist.

CREATE TABLE IF NOT EXISTS public.org_sso_config (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  idp_entity_id text,
  acs_url text,
  sp_entity_id text,
  metadata_filename text,
  metadata_size_bytes integer,
  metadata_uploaded_at timestamptz,
  metadata_uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_metadata_exchange_at timestamptz,
  attribute_mappings jsonb NOT NULL DEFAULT '[]'::jsonb,
  auto_add_verified_domain boolean NOT NULL DEFAULT true,
  require_sso_for_verified_domain boolean NOT NULL DEFAULT true,
  default_cohort_id uuid REFERENCES public.betterat_org_cohorts(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.org_sso_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sso_admin_read" ON public.org_sso_config;
CREATE POLICY "sso_admin_read"
  ON public.org_sso_config FOR SELECT
  USING (public.is_org_admin_member(org_id));

DROP POLICY IF EXISTS "sso_admin_write" ON public.org_sso_config;
CREATE POLICY "sso_admin_write"
  ON public.org_sso_config FOR ALL
  USING (public.is_org_admin_member(org_id))
  WITH CHECK (public.is_org_admin_member(org_id));

COMMENT ON TABLE public.org_sso_config IS
  'SAML 2.0 / SSO config and auto-add policy for one org. Admin-gated.';

CREATE TABLE IF NOT EXISTS public.org_verified_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  domain text NOT NULL,
  txt_record text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','failed')),
  is_primary boolean NOT NULL DEFAULT false,
  is_alias boolean NOT NULL DEFAULT false,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  UNIQUE (org_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_org_verified_domains_org ON public.org_verified_domains(org_id);

ALTER TABLE public.org_verified_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ovd_admin_read" ON public.org_verified_domains;
CREATE POLICY "ovd_admin_read"
  ON public.org_verified_domains FOR SELECT
  USING (public.is_org_admin_member(org_id));

DROP POLICY IF EXISTS "ovd_admin_write" ON public.org_verified_domains;
CREATE POLICY "ovd_admin_write"
  ON public.org_verified_domains FOR ALL
  USING (public.is_org_admin_member(org_id))
  WITH CHECK (public.is_org_admin_member(org_id));

COMMENT ON TABLE public.org_verified_domains IS
  'Verified email domains for an org. Underpins auto-add policy.';
