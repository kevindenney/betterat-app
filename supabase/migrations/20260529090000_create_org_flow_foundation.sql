-- Create-org flow foundation (slice 1)
-- See docs/redesign/specs/CREATE_ORG_FLOW_SPEC.md
--
-- Adds the schema surface for self-serve org creation, verified adoption,
-- and blueprint carryover. Reuses existing claim_status / verification_mode /
-- join_mode / status columns; adds only what is genuinely new.
--
-- Vocabulary inheritance (vocabulary_parent_id) is deliberately deferred —
-- per-org vocab forking needs its own table design and is out of scope here.

-- 1. New organization_type kinds for self-serve.
ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_organization_type_check;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_organization_type_check
  CHECK (organization_type = ANY (ARRAY[
    'club'::text,
    'institution'::text,
    'association'::text,
    'business'::text,
    'community'::text,
    'other'::text,
    'yacht_club'::text,
    'fleet'::text,
    'training_squad'::text,
    'study_group'::text,
    'lab_group'::text,
    'chapter'::text
  ]));

-- 2. Origin axis (separate from claim_status, which is about claim lifecycle).
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS creation_source text NOT NULL DEFAULT 'seeded'
    CHECK (creation_source = ANY (ARRAY['seeded'::text, 'user'::text, 'verified'::text]));

-- 3. Parent-org hierarchy (fleet under club, chapter under association, etc.).
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS parent_org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS organizations_parent_org_id_idx
  ON public.organizations(parent_org_id)
  WHERE parent_org_id IS NOT NULL;

-- 4. Timestamps for adoption + archival.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS adopted_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- 5. Carryover flag for blueprints adopted with an org.
ALTER TABLE public.blueprints
  ADD COLUMN IF NOT EXISTS adopted_at timestamptz;

COMMENT ON COLUMN public.blueprints.adopted_at IS
  'Non-NULL when this blueprint existed before the org was adopted by a verified parent. NULL = born under verified parent.';

-- 6. Verification request queue.
CREATE TABLE IF NOT EXISTS public.org_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'needs_info'::text])),
  proof jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);

CREATE INDEX IF NOT EXISTS org_verification_requests_org_idx
  ON public.org_verification_requests(organization_id);

CREATE INDEX IF NOT EXISTS org_verification_requests_pending_idx
  ON public.org_verification_requests(created_at DESC)
  WHERE status = 'pending';

ALTER TABLE public.org_verification_requests ENABLE ROW LEVEL SECURITY;

-- Requester reads their own request rows.
CREATE POLICY org_verification_requests_requester_select
  ON public.org_verification_requests
  FOR SELECT
  TO authenticated
  USING (requested_by = (SELECT auth.uid()));

-- Requester inserts (must be themselves and must be an admin of the org).
-- Convention from 20260308100500_org_membership_admin_access_requests_rls.sql:
-- - role IN ('owner', 'admin', 'manager')
-- - COALESCE(membership_status, status) = 'active' to handle the split column.
CREATE POLICY org_verification_requests_requester_insert
  ON public.org_verification_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    requested_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.organization_memberships m
      WHERE m.organization_id = org_verification_requests.organization_id
        AND m.user_id = (SELECT auth.uid())
        AND m.role IN ('owner', 'admin', 'manager')
        AND COALESCE(m.membership_status, m.status) = 'active'
    )
  );

-- Admin reviewer policies will be added in slice 3 when the queue UI lands.
-- For now, ops reviews directly via Supabase MCP with service-role.

-- 7. Backfill: every existing org is admin-seeded, so mark as such.
--    (creation_source defaulted to 'seeded' for new column, but be explicit.)
UPDATE public.organizations
SET creation_source = 'seeded'
WHERE creation_source IS NULL OR creation_source = '';

-- 8. Comments for posterity.
COMMENT ON COLUMN public.organizations.creation_source IS
  'How this org entered the system: seeded (admin-curated), user (self-serve), verified (created via verified path).';

COMMENT ON COLUMN public.organizations.parent_org_id IS
  'Optional parent org. Set when a fleet is adopted under a club, a chapter under an association, etc.';

COMMENT ON COLUMN public.organizations.adopted_at IS
  'Timestamp the org was adopted by a verified parent. NULL = never adopted.';

COMMENT ON COLUMN public.organizations.archived_at IS
  'Timestamp the org was soft-archived via abandonment cleanup. Pair with status=archived.';
