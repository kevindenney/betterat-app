-- Consolidate the expensive peer-visibility SELECT policies on timeline_steps.
--
-- Why: the `authenticated` role has an 8s statement timeout. timeline_steps had
-- 10 ORed permissive SELECT policies; five of them carried inline EXISTS
-- subqueries (blueprint-viewers, co-subscribers, fleet, faculty, followed).
-- Because permissive policies are ORed into a single predicate at PLAN time,
-- every read of the table — even a single-row getStepById on your OWN step —
-- forced the planner to expand all five into 200+ sub-plans (~160ms planning,
-- ~1700 planning buffers per query). Under the concurrency the Atlas screen
-- generates (getStepById + createStep's returning-SELECT + useMyTimeline + AI
-- edge fns all at once) this plan-cost amplification blew past 8s and surfaced
-- as Postgres 57014 "canceling statement due to statement timeout" — i.e. the
-- "Step creation failed" / "Failed to fetch step by ID" errors.
--
-- Fix: move those five rules behind one STABLE SECURITY DEFINER boolean function.
-- The planner treats the function call as opaque (no inlining), so planning
-- collapses. The cheap policies (self, collaborators, public-share) and the two
-- already-opaque get_*_ids policies are left untouched. Semantics are preserved:
-- the function body is the exact OR of the five replaced USING expressions.

CREATE OR REPLACE FUNCTION public.can_view_peer_timeline_step(
  p_viewer_id uuid,
  p_step_id uuid,
  p_step_user_id uuid,
  p_interest_id uuid,
  p_visibility text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- "Blueprint viewers can see author steps"
    (
      p_visibility <> 'private'
      AND EXISTS (
        SELECT 1
        FROM timeline_blueprints bp
        WHERE bp.user_id = p_step_user_id
          AND bp.interest_id = p_interest_id
          AND bp.is_published = true
          AND (
            bp.access_level = 'public'
            OR bp.access_level = 'paid'
            OR (bp.access_level = 'org_members' AND is_org_active_member(bp.organization_id))
          )
      )
    )
    -- "Co-subscribers can see peer steps"
    OR (
      p_visibility = ANY (ARRAY['crew', 'fleet', 'public'])
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = p_step_user_id
          AND profiles.allow_peer_visibility = true
      )
      AND EXISTS (
        SELECT 1
        FROM blueprint_subscriptions my_sub
          JOIN blueprint_subscriptions peer_sub ON my_sub.blueprint_id = peer_sub.blueprint_id
          JOIN timeline_blueprints bp ON bp.id = my_sub.blueprint_id
        WHERE my_sub.subscriber_id = p_viewer_id
          AND peer_sub.subscriber_id = p_step_user_id
          AND bp.interest_id = p_interest_id
          AND bp.is_published = true
      )
    )
    -- "Fleet members can view fleet plan steps"
    OR (
      p_visibility = ANY (ARRAY['crew', 'fleet', 'public'])
      AND EXISTS (
        SELECT 1
        FROM blueprint_steps bs
          JOIN timeline_blueprints b ON b.id = bs.blueprint_id
        WHERE bs.step_id = p_step_id
          AND b.fleet_id IS NOT NULL
          AND b.is_published = true
          AND is_active_fleet_member(b.fleet_id, p_viewer_id)
      )
    )
    -- "faculty_read_org_member_steps_v1"
    OR EXISTS (
      SELECT 1
      FROM organization_memberships viewer_om
        JOIN organization_memberships student_om
          ON student_om.organization_id = viewer_om.organization_id
         AND student_om.user_id = p_step_user_id
         AND COALESCE(student_om.membership_status, student_om.status) = 'active'
      WHERE viewer_om.user_id = p_viewer_id
        AND COALESCE(viewer_om.membership_status, viewer_om.status) = 'active'
        AND viewer_om.role = ANY (ARRAY[
          'owner', 'admin', 'manager', 'faculty', 'instructor',
          'evaluator', 'preceptor', 'clinical_instructor'
        ])
    )
    -- "Users can view followed users timeline steps"
    OR (
      p_visibility = ANY (ARRAY['crew', 'fleet', 'public'])
      AND EXISTS (
        SELECT 1 FROM user_follows
        WHERE user_follows.follower_id = p_viewer_id
          AND user_follows.following_id = p_step_user_id
      )
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = p_step_user_id
          AND profiles.allow_follower_sharing = true
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_view_peer_timeline_step(uuid, uuid, uuid, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.can_view_peer_timeline_step(uuid, uuid, uuid, uuid, text) TO authenticated;

-- Replace the five inlined policies with one opaque call.
DROP POLICY IF EXISTS "Blueprint viewers can see author steps" ON timeline_steps;
DROP POLICY IF EXISTS "Co-subscribers can see peer steps" ON timeline_steps;
DROP POLICY IF EXISTS "Fleet members can view fleet plan steps" ON timeline_steps;
DROP POLICY IF EXISTS "faculty_read_org_member_steps_v1" ON timeline_steps;
DROP POLICY IF EXISTS "Users can view followed users timeline steps" ON timeline_steps;

CREATE POLICY "Peers can view shared timeline steps"
  ON timeline_steps
  FOR SELECT
  USING (
    public.can_view_peer_timeline_step(
      (SELECT auth.uid()),
      id,
      user_id,
      interest_id,
      visibility
    )
  );
