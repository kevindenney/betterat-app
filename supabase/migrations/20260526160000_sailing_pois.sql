-- Sailing POIs: marinas, sail lofts, chandlers, and other land-side
-- venues a sailor cares about that aren't yacht clubs. Clubs already
-- live in `clubs`; this table is for the everything-else POIs that
-- show up as the "Sail services" + "Marinas" Atlas layers.
--
-- POIs are public by design (institutional, geographic) — RLS allows
-- read to everyone, writes only to authenticated users with the
-- service-role or an `atlas_pois_editor` claim. Seeding happens via
-- the service-role from a curation pipeline; users do not create POIs
-- ad hoc.

CREATE TABLE IF NOT EXISTS public.sailing_pois (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('marina', 'sail_loft', 'chandler', 'repair', 'rigging')),
  name TEXT NOT NULL,
  short_name TEXT,
  description TEXT,

  -- Location
  country TEXT,
  country_code CHAR(2),
  region TEXT,
  city TEXT,
  address TEXT,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,

  -- Optional links
  website TEXT,
  phone TEXT,
  email TEXT,

  -- Affiliated club (when the POI lives at or partners with a club —
  -- e.g. RHKYC's on-site chandler). Soft link; POIs are NOT required
  -- to belong to a club.
  club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,

  -- Curation metadata
  is_verified BOOLEAN NOT NULL DEFAULT false,
  source TEXT,  -- 'manual' | 'osm-import' | 'community-submission'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sailing_pois_kind ON public.sailing_pois (kind);
CREATE INDEX IF NOT EXISTS idx_sailing_pois_club_id ON public.sailing_pois (club_id);
CREATE INDEX IF NOT EXISTS idx_sailing_pois_country_region ON public.sailing_pois (country_code, region);

-- Geographic-radius search support (used by atlas_sailing_pois_near RPC).
-- Simple bbox search via lat/lng indexes; full PostGIS not required at
-- v1 — Atlas's pin queries are bounded by a small bounding box.
CREATE INDEX IF NOT EXISTS idx_sailing_pois_latlng ON public.sailing_pois (latitude, longitude);

ALTER TABLE public.sailing_pois ENABLE ROW LEVEL SECURITY;

-- Public read: anyone (auth'd or not) can see sailing POIs. They're
-- institutional/geographic facts, not personal data.
CREATE POLICY sailing_pois_public_read ON public.sailing_pois
  FOR SELECT
  USING (true);

-- Writes go through service-role keys (seed + curation pipelines).
-- No INSERT/UPDATE/DELETE policies for authenticated users at v1 —
-- a future migration can grant write to `atlas_pois_editor` claims.

COMMENT ON TABLE public.sailing_pois IS
  'Sailing-specific land-side POIs (marinas, sail lofts, chandlers, repair shops, rigging shops). Rendered as the "Sail services" + "Marinas" toggles on the Atlas tab.';

-- ============================================================================
-- atlas_sailing_pois_near RPC
-- ============================================================================
-- Returns sailing POIs inside a bounding box, optionally filtered by kind.
-- Atlas calls this when the user has Marinas or Sail-services toggled on
-- and the camera region changes.

CREATE OR REPLACE FUNCTION public.atlas_sailing_pois_near(
  min_lat DECIMAL,
  max_lat DECIMAL,
  min_lng DECIMAL,
  max_lng DECIMAL,
  kinds TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  kind TEXT,
  name TEXT,
  short_name TEXT,
  latitude DECIMAL,
  longitude DECIMAL,
  club_id UUID
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT p.id, p.kind, p.name, p.short_name, p.latitude, p.longitude, p.club_id
  FROM public.sailing_pois p
  WHERE p.latitude BETWEEN min_lat AND max_lat
    AND p.longitude BETWEEN min_lng AND max_lng
    AND (kinds IS NULL OR p.kind = ANY(kinds))
  ORDER BY p.is_verified DESC, p.name ASC
  LIMIT 200;
$$;

COMMENT ON FUNCTION public.atlas_sailing_pois_near IS
  'Sailing POIs inside a bounding box. Optional kinds filter for layer-toggle scoping.';
