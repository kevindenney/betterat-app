-- Affinity groups: a generic sub-org grouping primitive that unifies
-- class-fleets (Dragon worldwide, J/70 fleet HK), cohorts (JHSON 2026
-- Anesthesia), crew pods (Wed-night Tigers), and practice groups.
--
-- The Atlas RPC currently labels users 'fleet' only when they share an
-- organization_memberships row. That misses two real cases:
--   1. Class-fleet kinship across clubs (Dragon sailor at RHKYC ↔ Dragon
--      sailor at NYYC — same boat class, no shared org).
--   2. Cohort kinship inside a large org (JHSON 2026 Anesthesia student
--      ↔ another 2026 Anesthesia student — same org, but the meaningful
--      grouping is the cohort, not the whole nursing school).

CREATE TABLE IF NOT EXISTS public.affinity_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('class_fleet', 'cohort', 'crew_pod', 'practice_group')),
  name TEXT NOT NULL,
  short_name TEXT,
  description TEXT,
  parent_org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  interest_slug TEXT,
  group_key TEXT,
  anchor_lat DECIMAL(10, 7),
  anchor_lng DECIMAL(10, 7),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affinity_groups_kind ON public.affinity_groups (kind);
CREATE INDEX IF NOT EXISTS idx_affinity_groups_parent_org ON public.affinity_groups (parent_org_id);
CREATE INDEX IF NOT EXISTS idx_affinity_groups_interest ON public.affinity_groups (interest_slug);
CREATE INDEX IF NOT EXISTS idx_affinity_groups_group_key ON public.affinity_groups (group_key);

CREATE TABLE IF NOT EXISTS public.affinity_group_members (
  group_id UUID NOT NULL REFERENCES public.affinity_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'leader', 'coach')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_affinity_group_members_user ON public.affinity_group_members (user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_affinity_group_members_group ON public.affinity_group_members (group_id) WHERE status = 'active';

ALTER TABLE public.affinity_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affinity_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY affinity_groups_read ON public.affinity_groups
  FOR SELECT
  USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY affinity_group_members_read ON public.affinity_group_members
  FOR SELECT
  USING (
    (SELECT auth.uid()) IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.affinity_group_members agm
      WHERE agm.group_id = affinity_group_members.group_id
        AND agm.user_id = (SELECT auth.uid())
        AND agm.status = 'active'
    )
  );

COMMENT ON TABLE public.affinity_groups IS
  'Sub-org affinity groupings (class-fleets, cohorts, crew pods, practice groups). Used to label peer relationships beyond the broader organization_memberships join.';
COMMENT ON TABLE public.affinity_group_members IS
  'User → affinity_group membership with role + status. Drives Atlas relationship labeling.';

CREATE OR REPLACE FUNCTION public.atlas_are_affinity_peers(
  viewer_id UUID,
  other_id UUID,
  group_kind TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.affinity_group_members agm_v
    JOIN public.affinity_group_members agm_o ON agm_o.group_id = agm_v.group_id
    LEFT JOIN public.affinity_groups ag ON ag.id = agm_v.group_id
    WHERE agm_v.user_id = viewer_id
      AND agm_o.user_id = other_id
      AND agm_v.status = 'active'
      AND agm_o.status = 'active'
      AND (group_kind IS NULL OR ag.kind = group_kind)
  );
$$;

COMMENT ON FUNCTION public.atlas_are_affinity_peers IS
  'True when two users share at least one active affinity_group. Optional kind filter (class_fleet / cohort / crew_pod / practice_group).';
