-- Admin Studio · Site detail real-data RPC.
--
-- /admin/[orgId]/sites/[poiId] previously rendered a hardcoded JHU mock for
-- every site. This RPC aggregates real activity at a claimed POI so the page
-- can show genuine numbers: stat strip, competency bars (confirmed
-- step_capability_evidence on steps located at the POI), a people roster, and
-- a recent-practice feed. Follows the is_org_admin_member SECURITY DEFINER
-- pattern from admin_org_recent_practice_steps.
--
-- Names prefer profiles.full_name over users.full_name because seed personas
-- store their email in users.full_name (see feedback_seed_sailors_users_vs_profiles).

CREATE OR REPLACE FUNCTION public.admin_site_activity(p_org_id uuid, p_poi_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_stats jsonb;
  v_competencies jsonb;
  v_roster jsonb;
  v_recent jsonb;
BEGIN
  IF NOT public.is_org_admin_member(p_org_id) THEN
    RAISE EXCEPTION 'Not authorized to view site activity'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.atlas_pois
    WHERE id = p_poi_id AND claimed_by_org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Site is not claimed by this organization'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT jsonb_build_object(
    'people',        COUNT(DISTINCT ts.user_id),
    'steps',         COUNT(*),
    'settled',       COUNT(*) FILTER (WHERE ts.status = 'settled'),
    'last_activity', MAX(COALESCE(ts.completed_at, ts.created_at)),
    'evidence', (
      SELECT COUNT(*)
      FROM public.step_capability_evidence sce
      JOIN public.step_location sl2
        ON sl2.step_id = sce.step_id AND sl2.poi_id = p_poi_id
      JOIN public.org_competencies oc
        ON oc.id = sce.org_competency_id AND oc.org_id = p_org_id
      WHERE sce.confirmed = true
    )
  )
  INTO v_stats
  FROM public.step_location sl
  JOIN public.timeline_steps ts ON ts.id = sl.step_id
  WHERE sl.poi_id = p_poi_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'short_label',    t.short_label,
           'full_label',     t.full_label,
           'evidence_count', t.ev_count,
           'people',         t.people
         ) ORDER BY t.ev_count DESC), '[]'::jsonb)
  INTO v_competencies
  FROM (
    SELECT oc.short_label, oc.full_label,
           COUNT(*) AS ev_count,
           COUNT(DISTINCT ts.user_id) AS people
    FROM public.step_capability_evidence sce
    JOIN public.step_location sl ON sl.step_id = sce.step_id AND sl.poi_id = p_poi_id
    JOIN public.timeline_steps ts ON ts.id = sce.step_id
    JOIN public.org_competencies oc
      ON oc.id = sce.org_competency_id AND oc.org_id = p_org_id
    WHERE sce.confirmed = true
    GROUP BY oc.short_label, oc.full_label
    ORDER BY ev_count DESC
    LIMIT 5
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'user_id',       t.user_id,
           'user_name',     t.user_name,
           'user_initials', t.user_initials,
           'step_count',    t.step_count,
           'settled_count', t.settled_count,
           'last_active',   t.last_active
         ) ORDER BY t.step_count DESC, t.last_active DESC), '[]'::jsonb)
  INTO v_roster
  FROM (
    SELECT ts.user_id,
           COALESCE(
             NULLIF(trim(pr.full_name), ''),
             NULLIF(trim(u.full_name), ''),
             u.email,
             'Member'
           ) AS user_name,
           upper(
             COALESCE(
               substr(COALESCE(NULLIF(trim(pr.full_name), ''), NULLIF(trim(u.full_name), '')), 1, 1) ||
                 substr(split_part(COALESCE(NULLIF(trim(pr.full_name), ''), NULLIF(trim(u.full_name), '')), ' ', 2), 1, 1),
               substr(u.email, 1, 2),
               '··'
             )
           ) AS user_initials,
           COUNT(*) AS step_count,
           COUNT(*) FILTER (WHERE ts.status = 'settled') AS settled_count,
           MAX(COALESCE(ts.completed_at, ts.created_at)) AS last_active
    FROM public.step_location sl
    JOIN public.timeline_steps ts ON ts.id = sl.step_id
    JOIN public.users u ON u.id = ts.user_id
    LEFT JOIN public.profiles pr ON pr.id = ts.user_id
    WHERE sl.poi_id = p_poi_id
    GROUP BY ts.user_id, pr.full_name, u.full_name, u.email
    ORDER BY step_count DESC, last_active DESC
    LIMIT 8
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'step_id',       t.id,
           'title',         t.title,
           'status',        t.status,
           'user_name',     t.user_name,
           'user_initials', t.user_initials,
           'happened_at',   t.happened_at,
           'competencies',  to_jsonb(t.competencies)
         ) ORDER BY t.happened_at DESC), '[]'::jsonb)
  INTO v_recent
  FROM (
    SELECT ts.id, ts.title, ts.status,
           COALESCE(
             NULLIF(trim(pr.full_name), ''),
             NULLIF(trim(u.full_name), ''),
             u.email,
             'Member'
           ) AS user_name,
           upper(
             COALESCE(
               substr(COALESCE(NULLIF(trim(pr.full_name), ''), NULLIF(trim(u.full_name), '')), 1, 1) ||
                 substr(split_part(COALESCE(NULLIF(trim(pr.full_name), ''), NULLIF(trim(u.full_name), '')), ' ', 2), 1, 1),
               substr(u.email, 1, 2),
               '··'
             )
           ) AS user_initials,
           COALESCE(ts.completed_at, ts.created_at) AS happened_at,
           COALESCE(
             array_agg(DISTINCT oc.short_label) FILTER (WHERE oc.short_label IS NOT NULL),
             ARRAY[]::text[]
           ) AS competencies
    FROM public.step_location sl
    JOIN public.timeline_steps ts ON ts.id = sl.step_id
    JOIN public.users u ON u.id = ts.user_id
    LEFT JOIN public.profiles pr ON pr.id = ts.user_id
    LEFT JOIN public.step_capability_evidence sce
      ON sce.step_id = ts.id AND sce.confirmed = true
    LEFT JOIN public.org_competencies oc
      ON oc.id = sce.org_competency_id AND oc.org_id = p_org_id
    WHERE sl.poi_id = p_poi_id
    GROUP BY ts.id, ts.title, ts.status, ts.completed_at, ts.created_at,
             pr.full_name, u.full_name, u.email
    ORDER BY happened_at DESC
    LIMIT 8
  ) t;

  RETURN jsonb_build_object(
    'stats',        v_stats,
    'competencies', v_competencies,
    'roster',       v_roster,
    'recent',       v_recent
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_site_activity(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_site_activity(uuid, uuid) TO authenticated, service_role;
