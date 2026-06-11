-- Atlas venue mastery (Phase V.3) · fleet stats at one racing area.
--
-- Returns the viewer's fleet roster activity at a venue: who has raced
-- here (top fleetmates by completed count) and how many are planning a
-- race inside an optional event window ("N of M boats in").
--
-- Privacy: roster comes from the viewer's own active class_fleet
-- (fallback practice_group) affinity group, so membership is already
-- mutual. Per-step inclusion is still audience-gated: steps with a
-- step_location row go through atlas_can_view_step_location (the
-- server-side gate every Atlas surface uses); steps without one fall
-- back to timeline_steps.visibility — fleet/public visible, crew only
-- when the viewer is a collaborator, private excluded.
--
-- Names prefer profiles names over users.full_name because seed
-- personas store their email in users.full_name
-- (see feedback_seed_sailors_users_vs_profiles).

CREATE OR REPLACE FUNCTION public.atlas_fleet_venue_stats(
  p_poi_id uuid,
  p_event_window tstzrange DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_viewer uuid;
  v_group_id uuid;
  v_group_name text;
  v_fleet_size int;
  v_result jsonb;
BEGIN
  v_viewer := (SELECT auth.uid());
  IF v_viewer IS NULL THEN RETURN NULL; END IF;

  SELECT ag.id, COALESCE(NULLIF(trim(ag.short_name), ''), ag.name)
    INTO v_group_id, v_group_name
  FROM public.affinity_group_members agm
  JOIN public.affinity_groups ag
    ON ag.id = agm.group_id AND ag.is_active
  WHERE agm.user_id = v_viewer
    AND agm.status = 'active'
    AND ag.kind IN ('class_fleet', 'practice_group')
  ORDER BY CASE ag.kind WHEN 'class_fleet' THEN 0 ELSE 1 END, agm.joined_at
  LIMIT 1;

  IF v_group_id IS NULL THEN RETURN NULL; END IF;

  SELECT COUNT(*) INTO v_fleet_size
  FROM public.affinity_group_members
  WHERE group_id = v_group_id AND status = 'active';

  WITH roster AS (
    SELECT agm.user_id
    FROM public.affinity_group_members agm
    WHERE agm.group_id = v_group_id AND agm.status = 'active'
  ),
  area_steps AS (
    SELECT ts.id, ts.user_id, ts.status, ts.starts_at
    FROM public.timeline_steps ts
    JOIN roster r ON r.user_id = ts.user_id
    WHERE ts.is_race = true
      AND ts.metadata -> 'race_plan' ->> 'area_id' = p_poi_id::text
      AND (
        ts.user_id = v_viewer
        OR (
          EXISTS (SELECT 1 FROM public.step_location sl WHERE sl.step_id = ts.id)
          AND public.atlas_can_view_step_location(ts.id)
        )
        OR (
          NOT EXISTS (SELECT 1 FROM public.step_location sl WHERE sl.step_id = ts.id)
          AND (
            ts.visibility IN ('fleet', 'public')
            OR (
              ts.visibility = 'crew'
              AND (
                v_viewer::text = ANY (COALESCE(ts.collaborator_user_ids, '{}'))
                OR EXISTS (
                  SELECT 1 FROM public.step_collaborators sc
                  WHERE sc.step_id = ts.id AND sc.user_id = v_viewer
                )
              )
            )
          )
        )
      )
  )
  SELECT jsonb_build_object(
    'fleet_name', v_group_name,
    'fleet_size', v_fleet_size,
    'planned_in_window', (
      SELECT COUNT(DISTINCT s.user_id)
      FROM area_steps s
      WHERE s.status IN ('pending', 'in_progress')
        AND (
          p_event_window IS NULL
          OR (s.starts_at IS NOT NULL AND s.starts_at <@ p_event_window)
        )
    ),
    'fleetmates', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'user_id', t.user_id,
          'display_name', t.display_name,
          'completed_count', t.completed_count
        )
        ORDER BY t.completed_count DESC
      )
      FROM (
        SELECT s.user_id,
          COALESCE(
            NULLIF(trim(concat_ws(' ', pr.first_name, pr.last_name)), ''),
            CASE WHEN pr.full_name ~ '@' THEN NULL ELSE NULLIF(trim(pr.full_name), '') END,
            'Fleetmate'
          ) AS display_name,
          COUNT(*) FILTER (WHERE s.status = 'completed') AS completed_count
        FROM area_steps s
        LEFT JOIN public.profiles pr ON pr.id = s.user_id
        WHERE s.user_id <> v_viewer
        GROUP BY s.user_id, pr.first_name, pr.last_name, pr.full_name
        HAVING COUNT(*) FILTER (WHERE s.status = 'completed') > 0
        ORDER BY completed_count DESC
        LIMIT 5
      ) t
    ), '[]'::jsonb)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.atlas_fleet_venue_stats IS
  'Viewer''s fleet record at one racing area: top fleetmates by completed races + how many fleetmates plan a race in the window. Audience-gated per step.';

REVOKE ALL ON FUNCTION public.atlas_fleet_venue_stats(uuid, tstzrange) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atlas_fleet_venue_stats(uuid, tstzrange) TO authenticated, service_role;
