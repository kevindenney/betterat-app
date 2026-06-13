-- Break recursive RLS between gear_items and step_gear.
-- The original gear_items read policy queried step_gear, and the step_gear
-- read policy queried gear_items, so INSERT ... RETURNING on gear_items could
-- fail with "infinite recursion detected in policy for relation gear_items".

CREATE OR REPLACE FUNCTION public.gear_item_owned_by(
  p_gear_item_id uuid,
  p_user_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.gear_items gi
    WHERE gi.id = p_gear_item_id
      AND gi.user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.gear_item_attached_step_visible(
  p_gear_item_id uuid,
  p_user_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.step_gear sg
    WHERE sg.gear_item_id = p_gear_item_id
      AND public.can_view_step_for_gear(sg.step_id, p_user_id)
  );
$$;

REVOKE ALL ON FUNCTION public.gear_item_owned_by(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gear_item_attached_step_visible(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gear_item_owned_by(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gear_item_attached_step_visible(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS gear_items_owner_or_attached_step_read ON public.gear_items;
CREATE POLICY gear_items_owner_or_attached_step_read
  ON public.gear_items
  FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR public.gear_item_attached_step_visible(id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS step_gear_step_visible_read ON public.step_gear;
CREATE POLICY step_gear_step_visible_read
  ON public.step_gear
  FOR SELECT
  USING (
    public.can_view_step_for_gear(step_id, (SELECT auth.uid()))
    OR public.gear_item_owned_by(gear_item_id, (SELECT auth.uid()))
  );

NOTIFY pgrst, 'reload schema';
