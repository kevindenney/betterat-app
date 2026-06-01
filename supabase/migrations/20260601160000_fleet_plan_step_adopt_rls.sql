-- ============================================================================
-- Fleet plan step adoption RLS
--
-- A fleet plan's steps are authored in the captain's own timeline at
-- visibility='fleet'. Members preview them via the SECURITY DEFINER
-- get_fleet_plan_steps RPC, but ADOPTING a step (adoptStep) reads the source
-- row directly from timeline_steps under the caller's JWT. The existing
-- follower-read policy additionally requires the author's
-- profiles.allow_follower_sharing = true — a global toggle a captain shouldn't
-- have to flip just to let their fleet adopt plan steps.
--
-- Add a targeted policy: an active fleet member may SELECT any timeline_step
-- that is curated into a PUBLISHED fleet plan for a fleet they belong to. This
-- exposes only plan-curated steps, only to active members of that fleet.
--
-- Applied to dev project qavekrwdbsobecwrfxwu.
-- ============================================================================

DROP POLICY IF EXISTS "Fleet members can view fleet plan steps" ON public.timeline_steps;
CREATE POLICY "Fleet members can view fleet plan steps"
  ON public.timeline_steps
  FOR SELECT
  USING (
    visibility IN ('crew', 'fleet', 'public')
    AND EXISTS (
      SELECT 1
      FROM public.blueprint_steps bs
      JOIN public.timeline_blueprints b ON b.id = bs.blueprint_id
      WHERE bs.step_id = timeline_steps.id
        AND b.fleet_id IS NOT NULL
        AND b.is_published = true
        AND public.is_active_fleet_member(b.fleet_id, (SELECT auth.uid()))
    )
  );
