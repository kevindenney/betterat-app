-- nearest_named_place — given a lat/lng, return the closest "named
-- place" (club or sailing POI) within `max_km`. Used by the Plan-tab
-- "Where" card and Atlas pin tooltips to swap raw "Dropped pin
-- (22.366, 114.270)" labels with the nearest recognized venue name.
--
-- Clubs are joined via the PostGIS `location` geography column;
-- sailing_pois use explicit latitude/longitude. Returns NULL when
-- nothing is in range.

CREATE OR REPLACE FUNCTION public.nearest_named_place(
  target_lat numeric,
  target_lng numeric,
  max_km numeric DEFAULT 0.5
)
RETURNS TABLE(
  name text,
  short_name text,
  kind text,
  distance_km numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  WITH candidates AS (
    -- Clubs via PostGIS location column.
    SELECT
      c.name,
      c.short_name,
      'club'::text AS kind,
      extensions.ST_Y(c.location::extensions.geometry)::numeric AS lat,
      extensions.ST_X(c.location::extensions.geometry)::numeric AS lng
    FROM public.clubs c
    WHERE c.location IS NOT NULL
      AND c.is_active IS NOT FALSE
      AND extensions.ST_DWithin(
        c.location,
        extensions.ST_SetSRID(extensions.ST_MakePoint(target_lng, target_lat), 4326)::extensions.geography,
        max_km * 1000.0
      )
    UNION ALL
    -- Sailing POIs with explicit lat/lng columns.
    SELECT
      sp.name,
      sp.short_name,
      sp.kind,
      sp.latitude::numeric AS lat,
      sp.longitude::numeric AS lng
    FROM public.sailing_pois sp
    WHERE sp.latitude IS NOT NULL AND sp.longitude IS NOT NULL
      AND sp.latitude BETWEEN target_lat - max_km / 111.0 AND target_lat + max_km / 111.0
      AND sp.longitude BETWEEN target_lng - max_km / (111.0 * COS(RADIANS(target_lat)))
                            AND target_lng + max_km / (111.0 * COS(RADIANS(target_lat)))
  )
  SELECT
    name, short_name, kind,
    SQRT(
      POWER((lat - target_lat) * 111.0, 2) +
      POWER((lng - target_lng) * 111.0 * COS(RADIANS(target_lat)), 2)
    )::numeric AS distance_km
  FROM candidates
  ORDER BY distance_km ASC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.nearest_named_place IS
  'Return the nearest named place (club or sailing POI) to lat/lng within max_km. Used to swap raw "Dropped pin (...)" labels with recognizable venue names.';
