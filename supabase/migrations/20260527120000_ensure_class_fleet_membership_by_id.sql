-- UUID-keyed variant of ensure_class_fleet_membership. Lets the boat
-- add/edit flow pass an existing boat_classes.id directly instead of
-- looking up the class name first. Delegates to the text-key variant
-- via boat_classes.name → normalize_class_key.

CREATE OR REPLACE FUNCTION public.ensure_class_fleet_membership_by_id(class_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class_name TEXT;
BEGIN
  IF class_id IS NULL THEN RETURN NULL; END IF;
  SELECT name INTO v_class_name FROM public.boat_classes WHERE id = class_id;
  IF v_class_name IS NULL THEN RETURN NULL; END IF;
  RETURN public.ensure_class_fleet_membership(v_class_name);
END;
$$;

COMMENT ON FUNCTION public.ensure_class_fleet_membership_by_id IS
  'UUID-keyed variant of ensure_class_fleet_membership. Resolves boat_classes.id → name, then ensures the global class fleet group + adds caller. Returns the affinity_groups.id.';

-- One-time backfill: for every sailor who has a primary boat, ensure
-- they're a member of the worldwide class fleet for that boat's class.
-- Idempotent — running it again is a no-op.

WITH primary_boats AS (
  SELECT DISTINCT ON (b.sailor_id)
    b.sailor_id AS user_id,
    public.normalize_class_key(bc.name) AS class_key
  FROM public.sailor_boats b
  JOIN public.boat_classes bc ON bc.id = b.class_id
  WHERE b.is_primary = true AND b.sailor_id IS NOT NULL
  ORDER BY b.sailor_id, b.created_at DESC
),
ensure_groups AS (
  INSERT INTO public.affinity_groups (kind, name, short_name, interest_slug, group_key)
  SELECT DISTINCT
    'class_fleet',
    initcap(replace(class_key, '-', ' ')) || ' · Worldwide',
    initcap(replace(class_key, '-', ' ')),
    'sail-racing',
    class_key
  FROM primary_boats
  WHERE class_key IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.affinity_groups ag
      WHERE ag.kind='class_fleet' AND ag.parent_org_id IS NULL AND ag.group_key = primary_boats.class_key
    )
  RETURNING id, group_key
),
all_groups AS (
  SELECT id, group_key FROM ensure_groups
  UNION
  SELECT id, group_key FROM public.affinity_groups
  WHERE kind='class_fleet' AND parent_org_id IS NULL
    AND group_key IN (SELECT class_key FROM primary_boats)
)
INSERT INTO public.affinity_group_members (group_id, user_id, role, status)
SELECT g.id, pb.user_id, 'member', 'active'
FROM primary_boats pb
JOIN all_groups g ON g.group_key = pb.class_key
ON CONFLICT (group_id, user_id) DO UPDATE SET status='active';
