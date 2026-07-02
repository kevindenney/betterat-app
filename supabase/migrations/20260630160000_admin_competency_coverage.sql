-- admin_competency_coverage — site-independent competency coverage for the
-- dean's Overview. Counterpart to admin_competency_evidence_counts, which is
-- keyed by site (poi_id) for the geographic heatmap and therefore drops
-- evidence from steps with no clinical site (e.g. a student pulling and
-- completing a blueprint step at no location). Coverage answers the dean's
-- real question — "is competency X being evidenced at all?" — so it counts any
-- confirmed, org-linked evidence regardless of whether the step had a site.

CREATE OR REPLACE FUNCTION public.admin_competency_coverage(
  p_org_id uuid,
  p_cohort_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(competency_id uuid, student_count integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_org_role_in(p_org_id, auth.uid(),
    ARRAY['owner','admin','manager','faculty','instructor']) THEN
    RAISE EXCEPTION 'Not authorized to view org competency coverage' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_cohort_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.betterat_org_cohorts c WHERE c.id = p_cohort_id AND c.org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Cohort does not belong to org' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  RETURN QUERY
  SELECT sce.org_competency_id, count(DISTINCT ts.user_id)::integer
  FROM public.step_capability_evidence sce
  JOIN public.timeline_steps ts ON ts.id = sce.step_id
  JOIN public.org_competencies oc ON oc.id = sce.org_competency_id
  WHERE oc.org_id = p_org_id AND sce.confirmed = true
    AND (p_cohort_id IS NULL OR EXISTS (
      SELECT 1 FROM public.betterat_org_cohort_members cm
      WHERE cm.cohort_id = p_cohort_id AND cm.user_id = ts.user_id
    ))
  GROUP BY sce.org_competency_id;
END;
$function$;
