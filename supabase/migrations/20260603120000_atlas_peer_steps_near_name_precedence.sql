-- atlas_peer_steps_near: fix set_by_name precedence.
--
-- The prior COALESCE preferred profiles.full_name, then the constructed
-- first+last name. For demo/seed sailors full_name holds their EMAIL
-- (e.g. "demo-markus@regattaflow.app") while first_name/last_name carry the
-- real name ("Markus Tham"), so the Atlas "working a step nearby" list showed
-- raw emails. Flip the precedence to prefer the structured first+last name,
-- and never surface an email-looking full_name as a display name (fall back to
-- NULL → the client renders "A Peer nearby" instead).
--
-- Signature unchanged, so a plain CREATE OR REPLACE suffices (no DROP).
-- Applied to dev project qavekrwdbsobecwrfxwu.

CREATE OR REPLACE FUNCTION public.atlas_peer_steps_near(
  target_lat numeric,
  target_lng numeric,
  radius_km numeric DEFAULT 5,
  interest_filter text DEFAULT NULL,
  restrict_user_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(
  step_id uuid,
  lat numeric,
  lng numeric,
  set_by uuid,
  relationship text,
  preview_name text,
  loc_precision text,
  poi_id uuid,
  set_at timestamptz,
  set_by_name text,
  set_by_avatar text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer uuid;
  v_lat_min numeric;
  v_lat_max numeric;
  v_lng_min numeric;
  v_lng_max numeric;
BEGIN
  v_viewer := (SELECT auth.uid());
  IF v_viewer IS NULL THEN RETURN; END IF;
  v_lat_min := target_lat - radius_km / 111.0;
  v_lat_max := target_lat + radius_km / 111.0;
  v_lng_min := target_lng - radius_km / (111.0 * COS(RADIANS(target_lat)));
  v_lng_max := target_lng + radius_km / (111.0 * COS(RADIANS(target_lat)));

  RETURN QUERY
  WITH visible AS (
    SELECT sl.step_id, sl.lat, sl.lng, sl.set_by,
           sl.location_precision AS loc_precision, sl.poi_id,
           sl.name AS preview_name, sl.set_at, sl.jitter_seed, sl.interest_slug
    FROM public.step_location sl
    WHERE sl.lat BETWEEN v_lat_min AND v_lat_max
      AND sl.lng BETWEEN v_lng_min AND v_lng_max
      AND sl.set_by IS NOT NULL
      AND (interest_filter IS NULL OR sl.interest_slug = interest_filter)
      AND COALESCE(sl.location_precision, 'exact') <> 'hidden'
      AND (
        restrict_user_ids IS NULL
        OR cardinality(restrict_user_ids) = 0
        OR sl.set_by = ANY(restrict_user_ids)
      )
      AND public.atlas_can_view_step_location(sl.step_id)
  ),
  labeled AS (
    SELECT v.*,
      CASE
        WHEN v.set_by = v_viewer THEN 'self'
        WHEN EXISTS (
          SELECT 1 FROM public.step_collaborators sc
          WHERE sc.step_id = v.step_id AND sc.user_id = v_viewer
        ) THEN 'crew'
        WHEN public.atlas_are_affinity_peers(v_viewer, v.set_by, 'crew_pod') THEN 'crew'
        WHEN public.atlas_are_cohort_peers(v_viewer, v.set_by) THEN 'cohort'
        WHEN public.atlas_are_affinity_peers(v_viewer, v.set_by, 'cohort') THEN 'cohort'
        WHEN public.atlas_are_affinity_peers(v_viewer, v.set_by, 'class_fleet') THEN 'fleet'
        WHEN public.atlas_are_affinity_peers(v_viewer, v.set_by, 'practice_group') THEN 'fleet'
        WHEN EXISTS (
          SELECT 1 FROM public.organization_memberships om_v
          JOIN public.organization_memberships om_s
            ON om_s.organization_id = om_v.organization_id
          WHERE om_v.user_id = v_viewer AND om_s.user_id = v.set_by
            AND COALESCE(om_v.membership_status, om_v.status) = 'active'
            AND COALESCE(om_s.membership_status, om_s.status) = 'active'
        ) THEN 'fleet'
        WHEN EXISTS (
          SELECT 1 FROM public.user_follows uf
          WHERE uf.follower_id = v_viewer AND uf.following_id = v.set_by
        ) THEN 'following'
        ELSE 'public'
      END AS relationship
    FROM visible v
  )
  SELECT l.step_id,
    (CASE l.loc_precision
      WHEN 'neighborhood' THEN
        l.lat + ((('x' || substring(l.jitter_seed::text, 1, 8))::bit(32)::int % 1000 - 500) / 111000.0)
      WHEN 'site' THEN
        COALESCE((SELECT p.lat::numeric FROM public.atlas_pois p WHERE p.id = l.poi_id), l.lat)
      ELSE l.lat
    END)::numeric AS lat,
    (CASE l.loc_precision
      WHEN 'neighborhood' THEN
        l.lng + ((('x' || substring(l.jitter_seed::text, 9, 8))::bit(32)::int % 1000 - 500) / (111000.0 * COS(RADIANS(target_lat))))
      WHEN 'site' THEN
        COALESCE((SELECT p.lng::numeric FROM public.atlas_pois p WHERE p.id = l.poi_id), l.lng)
      ELSE l.lng
    END)::numeric AS lng,
    l.set_by, l.relationship,
    CASE
      WHEN l.preview_name IS NULL
        OR l.preview_name ~* '^dropped pin'
        OR l.preview_name ~ '^\(?\s*-?\d+\.\d+'
      THEN COALESCE(
        (SELECT short_name FROM public.nearest_named_place(l.lat::numeric, l.lng::numeric, 1.0) LIMIT 1),
        (SELECT name FROM public.nearest_named_place(l.lat::numeric, l.lng::numeric, 1.0) LIMIT 1),
        l.preview_name
      )
      ELSE l.preview_name
    END AS preview_name,
    l.loc_precision, l.poi_id, l.set_at,
    -- Prefer the structured name; only fall back to full_name when it is
    -- present AND not an email (seed sailors store their email in full_name).
    COALESCE(
      NULLIF(trim(concat_ws(' ', pr.first_name, pr.last_name)), ''),
      CASE WHEN pr.full_name ~ '@' THEN NULL ELSE NULLIF(trim(pr.full_name), '') END
    ) AS set_by_name,
    pr.avatar_url AS set_by_avatar
  FROM labeled l
  LEFT JOIN public.profiles pr ON pr.id = l.set_by;
END;
$$;

GRANT EXECUTE ON FUNCTION public.atlas_peer_steps_near(numeric, numeric, numeric, text, uuid[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
