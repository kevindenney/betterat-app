-- Close the step_location world-read hole.
--
-- The base SELECT policy was `USING (true)` for role `authenticated`, exposing
-- every user's exact lat/lng/name — including 228 private-audience rows — to any
-- caller holding the public anon key plus any session, straight off PostgREST
-- (`GET /rest/v1/step_location`). The entire location-privacy model (owner check,
-- audience tiers, neighborhood jitter, 'hidden' precision) lived only inside the
-- atlas_peer_steps_near SECURITY DEFINER RPC; the base table bypassed all of it.
--
-- Gate the base table on the same owner-or-audience check the RPC uses. The
-- helper is SECURITY DEFINER, so it reads step_location as its owner and does not
-- recurse through this policy.

DROP POLICY IF EXISTS step_location_authed_read ON public.step_location;

CREATE POLICY step_location_authed_read ON public.step_location
  FOR SELECT TO authenticated
  USING (
    set_by = (SELECT auth.uid())
    OR public.atlas_can_view_step_location(step_id)
  );

-- The "N sailors nearby" aggregate counted pins via a SECURITY INVOKER function
-- that depended on the now-removed open read policy; under the tightened policy it
-- would only see the viewer's own + audience-visible rows and undercount. Flip it
-- to SECURITY DEFINER so it still counts across all pins. It returns only coarse
-- counts (sailors, pins) within a bounding box — never coordinates — so this does
-- not re-open the coordinate leak.
CREATE OR REPLACE FUNCTION public.step_location_neighbor_count(
  target_lat numeric,
  target_lng numeric,
  radius_km numeric DEFAULT 5
)
RETURNS TABLE(sailors bigint, pins bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;
