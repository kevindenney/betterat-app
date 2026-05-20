-- Aggregates step_location pins within a radius of (target_lat, target_lng).
-- Powers the "see what other sailors did here" social-proof tagline on the
-- Plan tab's Where card. Bbox-only approximation (no PostGIS dependency):
-- 1 degree of latitude ≈ 111 km; longitude is adjusted by cos(lat).
--
-- SECURITY INVOKER + the existing step_location RLS keep this honest — the
-- function only sees rows the caller could already SELECT directly.

CREATE OR REPLACE FUNCTION public.step_location_neighbor_count(
  target_lat numeric,
  target_lng numeric,
  radius_km numeric DEFAULT 5
)
RETURNS TABLE(sailors bigint, pins bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH bbox AS (
    SELECT
      target_lat - radius_km / 111.0 AS lat_min,
      target_lat + radius_km / 111.0 AS lat_max,
      target_lng - radius_km / (111.0 * COS(RADIANS(target_lat))) AS lng_min,
      target_lng + radius_km / (111.0 * COS(RADIANS(target_lat))) AS lng_max
  )
  SELECT
    COUNT(DISTINCT set_by)::bigint AS sailors,
    COUNT(*)::bigint AS pins
  FROM public.step_location, bbox
  WHERE lat BETWEEN bbox.lat_min AND bbox.lat_max
    AND lng BETWEEN bbox.lng_min AND bbox.lng_max
    AND set_by IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.step_location_neighbor_count(numeric, numeric, numeric)
  TO authenticated, anon;
