-- atlas_org_steps_near — located steps PUBLISHED BY an organization, near a point.
--
-- Sibling to atlas_peer_steps_near, but a different lens: instead of "who in my
-- graph has a step near here," this answers "what attendable activity have my /
-- nearby organizations put on the map here." The org is the step's provenance
-- (timeline_steps.organization_id), surfaced as a badge so the row reads as
-- "RHKYC · Dragon Saturday Series," not a bare clubhouse address.
--
-- Motivation: a bare "organizations nearby" list (clubhouse addresses ranked by
-- distance) is a one-time directory lookup, not recurring map value. The useful
-- unit is org-originated *located steps/events* you can show up to.
--
-- Key differences from the peer RPC:
--   * Org events are NOT privacy-jittered — you need the exact spot to show up.
--   * Visibility gate is org-shaped: a 'public' org step is visible to anyone;
--     non-public org steps only to active members of that org.
--   * Returns org + blueprint provenance columns instead of relationship.
--
-- Applied to dev project qavekrwdbsobecwrfxwu.

CREATE OR REPLACE FUNCTION public.atlas_org_steps_near(
  target_lat numeric,
  target_lng numeric,
  radius_km numeric DEFAULT 25,
  interest_filter text DEFAULT NULL
)
RETURNS TABLE(
  step_id uuid,
  lat numeric,
  lng numeric,
  title text,
  place_name text,
  org_id uuid,
  org_name text,
  org_slug text,
  blueprint_title text,
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
  SELECT
    sl.step_id,
    sl.lat::numeric AS lat,
    sl.lng::numeric AS lng,
    ts.title AS title,
    sl.name AS place_name,
    o.id AS org_id,
    o.name AS org_name,
    o.slug AS org_slug,
    bp.title AS blueprint_title,
    sl.set_at AS set_at
  FROM public.step_location sl
  JOIN public.timeline_steps ts ON ts.id = sl.step_id
  JOIN public.organizations o ON o.id = ts.organization_id
  LEFT JOIN public.timeline_blueprints bp ON bp.id = ts.source_blueprint_id
  WHERE sl.lat BETWEEN v_lat_min AND v_lat_max
    AND sl.lng BETWEEN v_lng_min AND v_lng_max
    AND ts.organization_id IS NOT NULL
    AND (interest_filter IS NULL OR sl.interest_slug = interest_filter)
    AND COALESCE(sl.location_precision, 'exact') <> 'hidden'
    AND (
      ts.visibility = 'public'
      OR EXISTS (
        SELECT 1 FROM public.organization_memberships om
        WHERE om.organization_id = ts.organization_id
          AND om.user_id = v_viewer
          AND COALESCE(om.membership_status, om.status) = 'active'
      )
    )
  ORDER BY sl.set_at DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.atlas_org_steps_near(numeric, numeric, numeric, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
