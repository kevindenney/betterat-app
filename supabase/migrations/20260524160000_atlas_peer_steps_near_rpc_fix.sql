-- atlas_peer_steps_near — bbox-bounded peer step lookup for the Atlas tab.
--
-- This migration creates (or replaces) the function with two bug fixes vs.
-- earlier ad-hoc versions discovered while diagnosing missing peer pins:
--
--   1) Bare `step_id` inside the step_collaborators EXISTS subquery was
--      ambiguous against the RETURNS TABLE output variable named `step_id`
--      (PG 42702). Qualifying the subquery alias (`sc.step_id`) resolves it.
--      Same rule as memory/feedback_pg_returns_table_column_shadow.md.
--
--   2) atlas_pois.lat/lng are double precision but the RPC returns numeric.
--      COALESCE(double, numeric) widens to double → return-type mismatch
--      on RETURN QUERY. Cast the POI lookup to numeric and wrap the whole
--      CASE in ::numeric so the return shape stays stable.

CREATE OR REPLACE FUNCTION public.atlas_peer_steps_near(
  target_lat numeric,
  target_lng numeric,
  radius_km numeric DEFAULT 5,
  interest_filter text DEFAULT NULL
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
  set_at timestamptz
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
        WHEN public.atlas_are_cohort_peers(v_viewer, v.set_by) THEN 'cohort'
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
    l.set_by, l.relationship, l.preview_name, l.loc_precision, l.poi_id, l.set_at
  FROM labeled l;
END;
$$;
