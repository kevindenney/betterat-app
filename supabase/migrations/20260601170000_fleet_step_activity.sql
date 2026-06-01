-- ============================================================================
-- Fleet step activity feed (Watch tab "By group")
--
-- A sail racer wants to read the Watch feed for THEIR fleet — fleetmates'
-- recent practice steps (planning / doing / reflecting), not the administrative
-- fleet activity log (document_uploaded, announcement, member_joined). The
-- existing followed-steps feed only surfaces people the viewer FOLLOWS, and
-- following != fleet membership, so it can't stand in for a fleet feed.
--
-- This RPC returns recent non-private timeline_steps authored by ACTIVE members
-- of a fleet, in the same shape useFollowedStepsFeed produces, so WatchCard can
-- render it unchanged. SECURITY DEFINER + gated on is_active_fleet_member so a
-- member reads across fleetmates' steps without each author having to follow
-- everyone or flip allow_follower_sharing.
--
-- Applied to dev project qavekrwdbsobecwrfxwu.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_fleet_step_activity(
  p_fleet_id uuid,
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
  FROM fleet_members fm
  JOIN timeline_steps ts ON ts.user_id = fm.user_id
  LEFT JOIN profiles p ON p.id = ts.user_id
  LEFT JOIN organizations o ON o.id = ts.organization_id
  WHERE fm.fleet_id = p_fleet_id
    AND fm.status = 'active'
    AND ts.visibility <> 'private'
    AND (p_interest_id IS NULL OR ts.interest_id = p_interest_id OR ts.interest_id IS NULL)
    AND is_active_fleet_member(p_fleet_id, (SELECT auth.uid()))
  ORDER BY ts.updated_at DESC
  LIMIT p_limit;
$$;
GRANT EXECUTE ON FUNCTION public.get_fleet_step_activity(uuid, uuid, int) TO authenticated;

NOTIFY pgrst, 'reload schema';
