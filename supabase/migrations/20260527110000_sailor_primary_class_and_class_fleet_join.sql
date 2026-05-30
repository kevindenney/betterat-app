-- Adds `primary_class` to sailor_profiles + an idempotent RPC that
-- ensures a global "Dragon Worldwide"-style class_fleet group exists
-- for the given class and adds the caller as an active member.
--
-- Called by the app when a sailor sets/updates their primary_class.
-- Net effect: declaring "I race a Dragon" automatically joins the
-- worldwide Dragon class fleet so Atlas can label cross-club Dragon
-- sailors as 'fleet' to each other.

ALTER TABLE public.sailor_profiles
  ADD COLUMN IF NOT EXISTS primary_class TEXT;

CREATE INDEX IF NOT EXISTS idx_sailor_profiles_primary_class
  ON public.sailor_profiles(primary_class)
  WHERE primary_class IS NOT NULL;

-- Normalize a free-form class name to a stable key.
--   "Dragon" / "dragon" / "  Dragon  " → "dragon"
--   "J/70" → "j-70"   "ILCA 7" → "ilca-7"
CREATE OR REPLACE FUNCTION public.normalize_class_key(input TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    regexp_replace(
      lower(trim(input)),
      '[^a-z0-9]+', '-', 'g'
    ),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.ensure_class_fleet_membership(class_key TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer UUID;
  v_normalized TEXT;
  v_title TEXT;
  v_group_id UUID;
BEGIN
  v_viewer := (SELECT auth.uid());
  IF v_viewer IS NULL THEN RETURN NULL; END IF;

  v_normalized := public.normalize_class_key(class_key);
  IF v_normalized IS NULL THEN RETURN NULL; END IF;

  v_title := initcap(replace(v_normalized, '-', ' ')) || ' · Worldwide';

  -- Find an existing global class_fleet for this key (parent_org_id IS NULL).
  SELECT id INTO v_group_id
  FROM public.affinity_groups
  WHERE kind = 'class_fleet'
    AND parent_org_id IS NULL
    AND group_key = v_normalized
  LIMIT 1;

  -- Create it if it doesn't exist.
  IF v_group_id IS NULL THEN
    INSERT INTO public.affinity_groups (kind, name, short_name, interest_slug, group_key)
    VALUES ('class_fleet', v_title, initcap(replace(v_normalized, '-', ' ')), 'sail-racing', v_normalized)
    RETURNING id INTO v_group_id;
  END IF;

  -- Idempotent membership upsert.
  INSERT INTO public.affinity_group_members (group_id, user_id, role, status)
  VALUES (v_group_id, v_viewer, 'member', 'active')
  ON CONFLICT (group_id, user_id) DO UPDATE
    SET status = 'active', role = COALESCE(public.affinity_group_members.role, 'member');

  RETURN v_group_id;
END;
$$;

COMMENT ON FUNCTION public.ensure_class_fleet_membership IS
  'Idempotently creates (if needed) a global class_fleet affinity_group for the given class and adds the caller as a member. Returns the group id.';
