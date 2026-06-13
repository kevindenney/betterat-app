-- Generalized per-interest gear model.
--
-- Replaces sailing-only sailor_boats / boat_equipment surfaces with one
-- primitive that can render as boats, bags, kits, tools, machines, or other
-- interest-owned equipment. Legacy sailing rows are copied in when those
-- tables exist; the old tables stay in place for compatibility during rollout.

CREATE TABLE IF NOT EXISTS public.gear_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interest_id uuid NOT NULL REFERENCES public.interests(id) ON DELETE CASCADE,
  kind text NOT NULL,
  name text NOT NULL,
  spec jsonb NOT NULL DEFAULT '{}'::jsonb,
  parent_id uuid REFERENCES public.gear_items(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'loaned', 'retired', 'backup')),
  photo_url text,
  acquired_on date,
  retired_on date,
  notes text,
  legacy_source_table text,
  legacy_source_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gear_items_user_interest_idx
  ON public.gear_items(user_id, interest_id);

CREATE INDEX IF NOT EXISTS gear_items_parent_idx
  ON public.gear_items(parent_id);

CREATE UNIQUE INDEX IF NOT EXISTS gear_items_legacy_source_uidx
  ON public.gear_items(legacy_source_table, legacy_source_id)
  WHERE legacy_source_table IS NOT NULL AND legacy_source_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS gear_items_one_primary_per_kind_uidx
  ON public.gear_items(user_id, interest_id, kind)
  WHERE is_primary = true AND status <> 'retired';

CREATE TABLE IF NOT EXISTS public.step_gear (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id uuid NOT NULL REFERENCES public.timeline_steps(id) ON DELETE CASCADE,
  gear_item_id uuid NOT NULL REFERENCES public.gear_items(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'gear',
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (step_id, gear_item_id, role)
);

CREATE INDEX IF NOT EXISTS step_gear_step_idx
  ON public.step_gear(step_id, sort_order);

CREATE INDEX IF NOT EXISTS step_gear_item_idx
  ON public.step_gear(gear_item_id);

CREATE OR REPLACE FUNCTION public.touch_gear_items_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_gear_items_updated_at ON public.gear_items;
CREATE TRIGGER trg_touch_gear_items_updated_at
  BEFORE UPDATE ON public.gear_items
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_gear_items_updated_at();

CREATE OR REPLACE FUNCTION public.can_view_step_for_gear(p_step_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.timeline_steps ts
    WHERE ts.id = p_step_id
      AND (
        ts.user_id = p_user_id
        OR ts.visibility = 'public'
        OR (
          ts.visibility IN ('crew', 'fleet')
          AND EXISTS (
            SELECT 1
            FROM public.user_follows uf
            JOIN public.profiles p ON p.id = ts.user_id
            WHERE uf.follower_id = p_user_id
              AND uf.following_id = ts.user_id
              AND p.allow_follower_sharing = true
          )
        )
        OR (
          ts.visibility IN ('crew', 'fleet', 'public')
          AND EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = ts.user_id
              AND p.allow_peer_visibility = true
          )
          AND EXISTS (
            SELECT 1
            FROM public.blueprint_subscriptions my_sub
            JOIN public.blueprint_subscriptions peer_sub
              ON my_sub.blueprint_id = peer_sub.blueprint_id
            JOIN public.timeline_blueprints bp
              ON bp.id = my_sub.blueprint_id
            WHERE my_sub.subscriber_id = p_user_id
              AND peer_sub.subscriber_id = ts.user_id
              AND bp.interest_id = ts.interest_id
              AND bp.is_published = true
          )
        )
      )
  );
$function$;

ALTER TABLE public.gear_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.step_gear ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gear_items_owner_or_attached_step_read ON public.gear_items;
CREATE POLICY gear_items_owner_or_attached_step_read
  ON public.gear_items
  FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.step_gear sg
      WHERE sg.gear_item_id = gear_items.id
        AND public.can_view_step_for_gear(sg.step_id, (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS gear_items_owner_insert ON public.gear_items;
CREATE POLICY gear_items_owner_insert
  ON public.gear_items
  FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS gear_items_owner_update ON public.gear_items;
CREATE POLICY gear_items_owner_update
  ON public.gear_items
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS gear_items_owner_delete ON public.gear_items;
CREATE POLICY gear_items_owner_delete
  ON public.gear_items
  FOR DELETE
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS step_gear_step_visible_read ON public.step_gear;
CREATE POLICY step_gear_step_visible_read
  ON public.step_gear
  FOR SELECT
  USING (
    public.can_view_step_for_gear(step_id, (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.gear_items gi
      WHERE gi.id = step_gear.gear_item_id
        AND gi.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS step_gear_owner_insert ON public.step_gear;
CREATE POLICY step_gear_owner_insert
  ON public.step_gear
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.timeline_steps ts
      WHERE ts.id = step_gear.step_id
        AND ts.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.gear_items gi
      WHERE gi.id = step_gear.gear_item_id
        AND gi.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS step_gear_owner_update ON public.step_gear;
CREATE POLICY step_gear_owner_update
  ON public.step_gear
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.timeline_steps ts
      WHERE ts.id = step_gear.step_id
        AND ts.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.timeline_steps ts
      WHERE ts.id = step_gear.step_id
        AND ts.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.gear_items gi
      WHERE gi.id = step_gear.gear_item_id
        AND gi.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS step_gear_owner_delete ON public.step_gear;
CREATE POLICY step_gear_owner_delete
  ON public.step_gear
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.timeline_steps ts
      WHERE ts.id = step_gear.step_id
        AND ts.user_id = (SELECT auth.uid())
    )
  );

DO $$
DECLARE
  v_sailing_interest_id uuid;
BEGIN
  SELECT id INTO v_sailing_interest_id
  FROM public.interests
  WHERE slug = 'sail-racing'
  LIMIT 1;

  IF v_sailing_interest_id IS NOT NULL
     AND to_regclass('public.sailor_boats') IS NOT NULL THEN
    INSERT INTO public.gear_items (
      user_id,
      interest_id,
      kind,
      name,
      spec,
      is_primary,
      status,
      acquired_on,
      notes,
      legacy_source_table,
      legacy_source_id,
      created_at,
      updated_at
    )
    SELECT
      src.sailor_id,
      v_sailing_interest_id,
      'boat',
      COALESCE(NULLIF(TRIM(src.name), ''), src.class_name, 'Boat'),
      jsonb_strip_nulls(jsonb_build_object(
        'class_id', src.class_id,
        'class_name', src.class_name,
        'sail_number', src.sail_number,
        'hull_number', src.hull_number,
        'manufacturer', src.manufacturer,
        'year', src.year_built,
        'ownership_type', src.ownership_type,
        'storage_location', src.storage_location
      )),
      COALESCE(src.is_primary, false) AND src.primary_rank = 1,
      CASE
        WHEN src.status = 'retired' OR src.status = 'sold' THEN 'retired'
        ELSE 'active'
      END,
      src.purchase_date,
      src.notes,
      'sailor_boats',
      src.id,
      COALESCE(src.created_at, now()),
      COALESCE(src.updated_at, now())
    FROM (
      SELECT
        sb.*,
        bc.name AS class_name,
        row_number() OVER (
          PARTITION BY sb.sailor_id
          ORDER BY COALESCE(sb.is_primary, false) DESC, sb.created_at ASC, sb.id ASC
        ) AS primary_rank
      FROM public.sailor_boats sb
      LEFT JOIN public.boat_classes bc ON bc.id = sb.class_id
    ) src
    ON CONFLICT (legacy_source_table, legacy_source_id)
      WHERE legacy_source_table IS NOT NULL AND legacy_source_id IS NOT NULL
    DO NOTHING;
  END IF;

  IF v_sailing_interest_id IS NOT NULL
     AND to_regclass('public.boat_equipment') IS NOT NULL THEN
    INSERT INTO public.gear_items (
      user_id,
      interest_id,
      kind,
      name,
      spec,
      parent_id,
      is_primary,
      status,
      acquired_on,
      retired_on,
      notes,
      legacy_source_table,
      legacy_source_id,
      created_at,
      updated_at
    )
    SELECT
      be.sailor_id,
      v_sailing_interest_id,
      COALESCE(NULLIF(TRIM(be.category), ''), 'gear'),
      COALESCE(NULLIF(TRIM(be.custom_name), ''), NULLIF(TRIM(be.model), ''), 'Gear item'),
      jsonb_strip_nulls(jsonb_build_object(
        'category', be.category,
        'subcategory', be.subcategory,
        'class_id', be.class_id,
        'manufacturer', be.manufacturer,
        'model', be.model,
        'serial_number', be.serial_number,
        'condition', be.condition,
        'condition_rating', be.condition_rating,
        'specifications', be.specifications
      )),
      parent.id,
      false,
      CASE
        WHEN be.status = 'retired' OR be.status = 'sold' THEN 'retired'
        WHEN be.status = 'backup' THEN 'backup'
        ELSE 'active'
      END,
      be.purchase_date,
      NULL::date,
      be.notes,
      'boat_equipment',
      be.id,
      COALESCE(be.created_at, now()),
      COALESCE(be.updated_at, now())
    FROM public.boat_equipment be
    LEFT JOIN public.gear_items parent
      ON parent.legacy_source_table = 'sailor_boats'
     AND parent.legacy_source_id = be.boat_id
    ON CONFLICT (legacy_source_table, legacy_source_id)
      WHERE legacy_source_table IS NOT NULL AND legacy_source_id IS NOT NULL
    DO NOTHING;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
