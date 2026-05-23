-- Phase 4d · competency evidence join
-- Bridges step_capability_evidence (free-text capability_id today) to the
-- formal org_competencies framework so /admin/[orgId]/insights can render
-- real (competency × site × student) counts.
--
-- Two pieces:
--   1. Nullable FK step_capability_evidence.org_competency_id → org_competencies(id)
--      (kept nullable so existing free-text evidence rows still validate)
--   2. SQL function admin_competency_evidence_counts(p_org_id) returning
--      one row per non-empty (competency, poi) cell with a DISTINCT student
--      count. security invoker — caller must have SELECT on the underlying
--      tables (admin RLS still applies).

ALTER TABLE public.step_capability_evidence
  ADD COLUMN IF NOT EXISTS org_competency_id uuid NULL
    REFERENCES public.org_competencies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_step_capability_evidence_org_competency
  ON public.step_capability_evidence(org_competency_id);

CREATE INDEX IF NOT EXISTS idx_step_location_poi
  ON public.step_location(poi_id);

-- SECURITY DEFINER because the caller (org admin) does not own the
-- step_capability_evidence rows of cohort members, so RLS would hide them.
-- Authorization is gated explicitly via is_org_admin_member.
CREATE OR REPLACE FUNCTION public.admin_competency_evidence_counts(p_org_id uuid)
RETURNS TABLE (
  competency_id uuid,
  poi_id uuid,
  student_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_admin_member(p_org_id) THEN
    RAISE EXCEPTION 'Not authorized to view org competency evidence'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    sce.org_competency_id AS competency_id,
    sl.poi_id,
    count(DISTINCT ts.user_id)::integer AS student_count
  FROM public.step_capability_evidence sce
  JOIN public.timeline_steps ts ON ts.id = sce.step_id
  JOIN public.step_location sl ON sl.step_id = ts.id
  JOIN public.org_competencies oc ON oc.id = sce.org_competency_id
  WHERE oc.org_id = p_org_id
    AND sce.confirmed = true
    AND sl.poi_id IS NOT NULL
  GROUP BY sce.org_competency_id, sl.poi_id;
END;
$$;

COMMENT ON FUNCTION public.admin_competency_evidence_counts(uuid) IS
  'Insights heatmap RPC. SECURITY DEFINER so org admins see all cohort evidence; gated by is_org_admin_member.';
