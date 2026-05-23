-- Phase 4p · org_invite_links
-- Tokenized invite-link sharing for the AddPersonSheet "Share invite
-- link" tab. Admin generates a URL like /redeem/<token> that pre-fills
-- role, cohort, and auto-subscribe.

CREATE TABLE IF NOT EXISTS public.org_invite_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  label text,
  role_key text NOT NULL DEFAULT 'member'
    CHECK (role_key IN ('member','faculty','preceptor','admin')),
  cohort_id uuid REFERENCES public.betterat_org_cohorts(id) ON DELETE SET NULL,
  auto_subscribe boolean NOT NULL DEFAULT true,
  max_uses integer,
  uses_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_invite_links_org ON public.org_invite_links(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_invite_links_token ON public.org_invite_links(token);

ALTER TABLE public.org_invite_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "oil_admin_read" ON public.org_invite_links;
CREATE POLICY "oil_admin_read"
  ON public.org_invite_links FOR SELECT
  USING (public.is_org_admin_member(org_id));

DROP POLICY IF EXISTS "oil_admin_write" ON public.org_invite_links;
CREATE POLICY "oil_admin_write"
  ON public.org_invite_links FOR ALL
  USING (public.is_org_admin_member(org_id))
  WITH CHECK (public.is_org_admin_member(org_id));

COMMENT ON TABLE public.org_invite_links IS
  'Shareable tokenized invite URLs scoped to an org. Admin-gated.';
