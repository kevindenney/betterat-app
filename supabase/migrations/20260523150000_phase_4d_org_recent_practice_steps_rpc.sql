-- admin_org_recent_practice_steps(p_org_id, p_limit)
-- Org-wide recent practice feed for the Overview dashboard.
-- Returns one row per timeline_step across all cohort members, sorted
-- newest-first, enriched with the actor's display name + initials + the
-- step's site + competencies. SECURITY DEFINER + is_org_admin_member gate.

CREATE OR REPLACE FUNCTION public.admin_org_recent_practice_steps(
  p_org_id uuid,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  step_id uuid,
  user_id uuid,
  user_name text,
  user_initials text,
  title text,
  status text,
  completed_at timestamptz,
  created_at timestamptz,
  poi_id uuid,
  poi_name text,
  competency_short_labels text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_admin_member(p_org_id) THEN
    RAISE EXCEPTION 'Not authorized to view org recent practice steps'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  WITH org_members AS (
    SELECT DISTINCT m.user_id
    FROM public.betterat_org_cohort_members m
    JOIN public.betterat_org_cohorts c ON c.id = m.cohort_id
    WHERE c.org_id = p_org_id
  )
  SELECT
    ts.id AS step_id,
    ts.user_id,
    COALESCE(NULLIF(trim(u.full_name), ''), u.email, 'Member') AS user_name,
    upper(
      COALESCE(
        substr(NULLIF(trim(u.full_name), ''), 1, 1) ||
          substr(split_part(NULLIF(trim(u.full_name), ''), ' ', 2), 1, 1),
        substr(u.email, 1, 2),
        '··'
      )
    ) AS user_initials,
    ts.title,
    ts.status,
    ts.completed_at,
    ts.created_at,
    sl.poi_id,
    ap.name AS poi_name,
    COALESCE(
      array_agg(DISTINCT oc.short_label) FILTER (WHERE oc.short_label IS NOT NULL),
      ARRAY[]::text[]
    ) AS competency_short_labels
  FROM public.timeline_steps ts
  JOIN org_members om ON om.user_id = ts.user_id
  JOIN public.users u ON u.id = ts.user_id
  LEFT JOIN public.step_location sl ON sl.step_id = ts.id
  LEFT JOIN public.atlas_pois ap ON ap.id = sl.poi_id
  LEFT JOIN public.step_capability_evidence sce ON sce.step_id = ts.id AND sce.confirmed = true
  LEFT JOIN public.org_competencies oc ON oc.id = sce.org_competency_id AND oc.org_id = p_org_id
  WHERE (
    ts.organization_id = p_org_id
    OR oc.org_id = p_org_id
    OR ap.claimed_by_org_id = p_org_id
  )
  GROUP BY ts.id, ts.user_id, u.full_name, u.email, ts.title, ts.status,
           ts.completed_at, ts.created_at, sl.poi_id, ap.name
  ORDER BY COALESCE(ts.completed_at, ts.created_at) DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.admin_org_recent_practice_steps(uuid, integer) IS
  'Org Admin Overview recent-activity feed. SECURITY DEFINER + is_org_admin_member gate.';
