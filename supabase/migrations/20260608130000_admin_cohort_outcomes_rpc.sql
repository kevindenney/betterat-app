-- admin_cohort_outcomes — per-member business-outcome rollup for the
-- org-admin / funder view (PRADAN entrepreneur vertical).
--
-- business_outcomes RLS only exposes a row to its own author or to the
-- public when the author opted their portfolio public. The field
-- officer / funder needs to see every cohort member's earnings, so this
-- SECURITY DEFINER function bypasses RLS but gates on org role exactly
-- like admin_competency_evidence_counts.
--
-- Returns one row per cohort member who has logged any outcomes, with
-- totals and a cohort-relative "last month" (the latest 4 weeks present
-- in the cohort's data, so the headline reads the same whether the demo
-- is opened today or next month).

CREATE OR REPLACE FUNCTION public.admin_cohort_outcomes(
  p_org_id uuid,
  p_cohort_id uuid DEFAULT NULL
)
RETURNS TABLE(
  user_id uuid,
  full_name text,
  weeks_logged integer,
  total_revenue_minor bigint,
  last_month_revenue_minor bigint,
  units_total integer,
  latest_week_start date,
  currency text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ref_week date;
BEGIN
  IF NOT public.has_org_role_in(p_org_id, auth.uid(),
    ARRAY['owner','admin','manager','faculty','instructor']) THEN
    RAISE EXCEPTION 'Not authorized to view org cohort outcomes' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_cohort_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.betterat_org_cohorts c WHERE c.id = p_cohort_id AND c.org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Cohort does not belong to org' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Cohort-relative reference week: the latest week any member logged.
  SELECT max(bo.week_start) INTO v_ref_week
  FROM public.business_outcomes bo
  WHERE EXISTS (
    SELECT 1 FROM public.betterat_org_cohort_members cm
    JOIN public.betterat_org_cohorts c ON c.id = cm.cohort_id
    WHERE cm.user_id = bo.user_id AND c.org_id = p_org_id
      AND (p_cohort_id IS NULL OR cm.cohort_id = p_cohort_id)
  );

  RETURN QUERY
  SELECT
    bo.user_id,
    COALESCE(pr.full_name, u.full_name, u.email) AS full_name,
    count(*)::integer AS weeks_logged,
    sum(bo.revenue_minor)::bigint AS total_revenue_minor,
    sum(bo.revenue_minor) FILTER (
      WHERE v_ref_week IS NOT NULL AND bo.week_start > v_ref_week - INTERVAL '28 days'
    )::bigint AS last_month_revenue_minor,
    sum(bo.units_sold)::integer AS units_total,
    max(bo.week_start) AS latest_week_start,
    max(bo.currency) AS currency
  FROM public.business_outcomes bo
  LEFT JOIN public.profiles pr ON pr.id = bo.user_id
  LEFT JOIN public.users u ON u.id = bo.user_id
  WHERE EXISTS (
    SELECT 1 FROM public.betterat_org_cohort_members cm
    JOIN public.betterat_org_cohorts c ON c.id = cm.cohort_id
    WHERE cm.user_id = bo.user_id AND c.org_id = p_org_id
      AND (p_cohort_id IS NULL OR cm.cohort_id = p_cohort_id)
  )
  GROUP BY bo.user_id, COALESCE(pr.full_name, u.full_name, u.email)
  ORDER BY total_revenue_minor DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_cohort_outcomes(uuid, uuid) TO authenticated;
