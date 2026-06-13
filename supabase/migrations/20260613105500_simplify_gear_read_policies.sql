-- Final recursion break: remove cross-table reads from the RLS predicates.
-- Owner gear management is the required v1 path. Step gear remains readable
-- when the step itself is visible via can_view_step_for_gear.

DROP POLICY IF EXISTS gear_items_owner_or_attached_step_read ON public.gear_items;
CREATE POLICY gear_items_owner_or_attached_step_read
  ON public.gear_items
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS step_gear_step_visible_read ON public.step_gear;
CREATE POLICY step_gear_step_visible_read
  ON public.step_gear
  FOR SELECT
  USING (public.can_view_step_for_gear(step_id, (SELECT auth.uid())));

NOTIFY pgrst, 'reload schema';
