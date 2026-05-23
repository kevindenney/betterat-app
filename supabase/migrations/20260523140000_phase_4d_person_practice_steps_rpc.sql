-- admin_person_practice_steps(org_id, user_id)
-- Returns one row per timeline_step for a cohort member, enriched with
-- site (poi) name + the org_competencies they evidenced on that step.
-- Used by /admin/[orgId]/person/[userId] (Open practice timeline action).
-- SECURITY DEFINER + is_org_admin_member gate, same pattern as
-- admin_competency_evidence_counts.

CREATE OR REPLACE FUNCTION public.admin_person_practice_steps(
  p_org_id uuid,
  p_user_id uuid
)
RETURNS TABLE (
  step_id uuid,
  title text,
  status text,
  category text,
  completed_at timestamptz,
  created_at timestamptz,
  poi_id uuid,
  poi_name text,
  competency_short_labels text[],
  competency_full_labels text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_admin_member(p_org_id) THEN
    RAISE EXCEPTION 'Not authorized to view org practice steps'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    ts.id AS step_id,
    ts.title,
    ts.status,
    ts.category,
    ts.completed_at,
    ts.created_at,
    sl.poi_id,
    ap.name AS poi_name,
    COALESCE(
      array_agg(DISTINCT oc.short_label) FILTER (WHERE oc.short_label IS NOT NULL),
      ARRAY[]::text[]
    ) AS competency_short_labels,
    COALESCE(
      array_agg(DISTINCT oc.full_label) FILTER (WHERE oc.full_label IS NOT NULL),
      ARRAY[]::text[]
    ) AS competency_full_labels
  FROM public.timeline_steps ts
  LEFT JOIN public.step_location sl ON sl.step_id = ts.id
  LEFT JOIN public.atlas_pois ap ON ap.id = sl.poi_id
  LEFT JOIN public.step_capability_evidence sce ON sce.step_id = ts.id AND sce.confirmed = true
  LEFT JOIN public.org_competencies oc ON oc.id = sce.org_competency_id AND oc.org_id = p_org_id
  WHERE ts.user_id = p_user_id
    AND (
      ts.organization_id = p_org_id
      OR oc.org_id = p_org_id
      OR ap.claimed_by_org_id = p_org_id
    )
  GROUP BY ts.id, ts.title, ts.status, ts.category, ts.completed_at, ts.created_at, sl.poi_id, ap.name
  ORDER BY COALESCE(ts.completed_at, ts.created_at) DESC;
END;
$$;

COMMENT ON FUNCTION public.admin_person_practice_steps(uuid, uuid) IS
  'Org-admin per-person practice timeline. SECURITY DEFINER + is_org_admin_member gate.';
