-- ============================================================================
-- Cohort step activity feed (Watch tab "Groups" lens, org cohorts)
--
-- Fleets are sailing-only, so the Watch → Groups lens had nothing to show for
-- non-sailing interests (a nursing student in a JHU cohort saw an empty lens or
-- a sailing fleet bleeding in). This is the cohort analogue of
-- get_fleet_step_activity: recent non-private timeline_steps authored by OTHER
-- members of an org cohort, in the FollowedStepItem shape WatchCard renders.
--
-- SECURITY DEFINER + gated on the caller being a member of the cohort, so a
-- cohort-mate reads across peers' steps without each author following everyone.
-- Excludes the caller's own steps (a group feed is about other members).
--
-- Applied to dev project qavekrwdbsobecwrfxwu.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_cohort_step_activity(
  p_cohort_id uuid,
  p_interest_id uuid DEFAULT NULL,
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  person_name text,
  avatar_url text,
  title text,
  description text,
  status text,
  interest_id uuid,
  organization_id uuid,
  organization_name text,
  source_blueprint_id uuid,
  location_name text,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ts.id,
    ts.user_id,
    COALESCE(
      p.full_name,
      NULLIF(trim(concat_ws(' ', p.first_name, p.last_name)), '')
    ) AS person_name,
    p.avatar_url,
    ts.title,
    ts.description,
    ts.status,
    ts.interest_id,
    ts.organization_id,
    o.name AS organization_name,
    ts.source_blueprint_id,
    ts.location_name,
    ts.updated_at
  FROM betterat_org_cohort_members cm
  JOIN timeline_steps ts ON ts.user_id = cm.user_id
  LEFT JOIN profiles p ON p.id = ts.user_id
  LEFT JOIN organizations o ON o.id = ts.organization_id
  WHERE cm.cohort_id = p_cohort_id
    AND ts.user_id <> (SELECT auth.uid())
    AND ts.visibility <> 'private'
    AND (p_interest_id IS NULL OR ts.interest_id = p_interest_id OR ts.interest_id IS NULL)
    AND EXISTS (
      SELECT 1 FROM betterat_org_cohort_members me
      WHERE me.cohort_id = p_cohort_id AND me.user_id = (SELECT auth.uid())
    )
  ORDER BY ts.updated_at DESC
  LIMIT p_limit;
$$;
GRANT EXECUTE ON FUNCTION public.get_cohort_step_activity(uuid, uuid, int) TO authenticated;

NOTIFY pgrst, 'reload schema';
