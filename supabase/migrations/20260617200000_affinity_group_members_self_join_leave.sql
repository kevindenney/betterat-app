-- Self-serve join/leave for affinity groups (class-fleets, cohorts,
-- crew pods, practice groups). Until now affinity_group_members had ONLY
-- a SELECT policy (and that one requires you to already be an active
-- member via is_active_group_member) — there was NO INSERT/UPDATE/DELETE
-- policy, so a user had no way to join or leave a group at all. Groups
-- were discoverable (affinity_groups SELECT is open to any authed user)
-- but the membership was a dead end.
--
-- Scope is deliberately narrow and self-only:
--   INSERT — a user may add ONLY their own row, and only as an active
--            'member' (open-join). They cannot self-promote to
--            'leader'/'coach', nor insert someone else.
--   UPDATE — a user may reactivate their own row (e.g. after a soft
--            'inactive'); same role/status guardrails via WITH CHECK.
--   DELETE — a user may remove ONLY their own row (leave).
--
-- Open-join (status='active' immediately) matches the group model: a
-- group is one primitive on three dials, and the simplest lifespan/
-- authority setting is "anyone in the interest belongs". A future
-- join-policy column can branch class_fleet (open) vs cohort
-- (roster-controlled) when an admin roster UI exists; today there is
-- none, and the ask is explicitly self-serve.
--
-- Roster control by leaders/coaches stays a separate (future) admin
-- policy, same as organization_memberships admin removal.
--
-- auth.uid() is wrapped as (SELECT auth.uid()) so Postgres caches it as
-- an initplan instead of re-evaluating per row (RLS initplan hardening).

BEGIN;

DROP POLICY IF EXISTS "affinity_group_members_self_join_v1" ON public.affinity_group_members;
CREATE POLICY "affinity_group_members_self_join_v1"
  ON public.affinity_group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND role = 'member'
    AND status = 'active'
  );

DROP POLICY IF EXISTS "affinity_group_members_self_update_v1" ON public.affinity_group_members;
CREATE POLICY "affinity_group_members_self_update_v1"
  ON public.affinity_group_members FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND role = 'member'
    AND status = 'active'
  );

DROP POLICY IF EXISTS "affinity_group_members_self_leave_v1" ON public.affinity_group_members;
CREATE POLICY "affinity_group_members_self_leave_v1"
  ON public.affinity_group_members FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

COMMENT ON POLICY "affinity_group_members_self_join_v1" ON public.affinity_group_members
  IS 'Users can self-join a group as an active member (open-join). No self-promotion to leader/coach; no inserting others.';
COMMENT ON POLICY "affinity_group_members_self_leave_v1" ON public.affinity_group_members
  IS 'Users can delete (leave) their own membership row. Leader/coach removal of others is a separate policy.';

COMMIT;
