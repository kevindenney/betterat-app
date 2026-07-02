-- Library Groups now reads from affinity_groups for every interest, including
-- Sail Racing. Preserve useful seeded/demo fleet data by copying legacy
-- fleets into affinity_groups, then use the affinity group memberships as the
-- Library source of truth.

BEGIN;

-- Make the 2027 Four Peaks event interest a Sail Racing child so browsing
-- Sail Racing includes groups scoped to that event interest.
UPDATE public.interests child
SET parent_id = parent.id,
    updated_at = now()
FROM public.interests parent
WHERE child.slug = '2027-four-peaks-race'
  AND parent.slug = 'sail-racing'
  AND child.parent_id IS DISTINCT FROM parent.id;

-- Backfill legacy fleets as class_fleet affinity groups. The group_key makes
-- the migration idempotent without needing to keep the old fleet id visible in
-- the UI.
WITH legacy_fleets AS (
  SELECT
    f.id,
    f.name,
    f.description,
    f.organization_id,
    f.created_at,
    f.updated_at
  FROM public.fleets f
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.affinity_groups ag
    WHERE ag.group_key = 'legacy-fleet-' || f.id::text
  )
),
inserted_groups AS (
  INSERT INTO public.affinity_groups (
    kind,
    name,
    description,
    parent_org_id,
    interest_slug,
    group_key,
    is_active,
    created_at,
    updated_at
  )
  SELECT
    'class_fleet',
    lf.name,
    lf.description,
    lf.organization_id,
    'sail-racing',
    'legacy-fleet-' || lf.id::text,
    true,
    COALESCE(lf.created_at, now()),
    COALESCE(lf.updated_at, now())
  FROM legacy_fleets lf
  RETURNING id, group_key
),
all_legacy_groups AS (
  SELECT id, group_key FROM inserted_groups
  UNION ALL
  SELECT ag.id, ag.group_key
  FROM public.affinity_groups ag
  WHERE ag.group_key LIKE 'legacy-fleet-%'
),
active_legacy_members AS (
  SELECT
    fm.fleet_id,
    fm.user_id,
    CASE
      WHEN fm.role IN ('owner', 'captain') THEN 'leader'
      WHEN fm.role = 'coach' THEN 'coach'
      ELSE 'member'
    END AS affinity_role,
    fm.joined_at
  FROM public.fleet_members fm
  WHERE fm.status = 'active'
)
INSERT INTO public.affinity_group_members (group_id, user_id, role, status, joined_at)
SELECT
  ag.id,
  alm.user_id,
  alm.affinity_role,
  'active',
  COALESCE(alm.joined_at, now())
FROM active_legacy_members alm
JOIN all_legacy_groups ag
  ON ag.group_key = 'legacy-fleet-' || alm.fleet_id::text
ON CONFLICT (group_id, user_id)
DO UPDATE SET
  status = 'active',
  role = EXCLUDED.role;

COMMIT;
