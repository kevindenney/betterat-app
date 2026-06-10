-- Fold venue_racing_areas into atlas_pois (the fold's data half).
-- UUIDs are preserved across the move so every FK repoint is a direct copy.
-- DELIBERATE FEATURE REMOVAL: the community confirmation machinery
-- (venue_racing_area_confirmations + 3-confirmations-auto-verify triggers) is
-- dropped, not ported — 1 data row, UI orphaned. verification_status survives
-- as a real atlas_pois column (the delete-block RLS policy reads it).

-- 1. Remove the duplicate point rows that shadowed the real polygon table.
DELETE FROM public.atlas_pois WHERE kind = 'racing_area';

-- 2. Move every racing area across, preserving ids. lat/lng are NOT NULL on
--    atlas_pois, so fall back to the first polygon-ring / point coordinate
--    when center_lat/lng were never written (official seeds predate them).
INSERT INTO public.atlas_pois
  (id, interest_slug, source, source_ref, name, lat, lng, kind, metadata,
   geometry, created_by, is_active, verification_status, created_at, updated_at)
SELECT
  vra.id,
  'sail-racing',
  CASE WHEN vra.source = 'community' THEN 'user_proposed' ELSE 'curated' END,
  'venue_racing_areas',
  vra.area_name,
  COALESCE(
    vra.center_lat,
    CASE
      WHEN vra.geometry->>'type' = 'Polygon' THEN (vra.geometry->'coordinates'->0->0->>1)::numeric
      WHEN vra.geometry->>'type' = 'Point' THEN (vra.geometry->'coordinates'->>1)::numeric
    END
  ),
  COALESCE(
    vra.center_lng,
    CASE
      WHEN vra.geometry->>'type' = 'Polygon' THEN (vra.geometry->'coordinates'->0->0->>0)::numeric
      WHEN vra.geometry->>'type' = 'Point' THEN (vra.geometry->'coordinates'->>0)::numeric
    END
  ),
  'racing_area',
  jsonb_strip_nulls(jsonb_build_object(
    'venue_id', vra.venue_id,
    'area_type', vra.area_type,
    'classes_used', to_jsonb(vra.classes_used),
    'typical_courses', to_jsonb(vra.typical_courses),
    'description', vra.description,
    'radius_meters', vra.radius_meters,
    'stroke_color', vra.stroke_color,
    'stroke_width', vra.stroke_width,
    'fill_color', vra.fill_color,
    'fill_opacity', vra.fill_opacity
  )),
  vra.geometry,
  vra.created_by,
  vra.is_active,
  vra.verification_status,
  vra.created_at,
  vra.updated_at
FROM public.venue_racing_areas vra;

DO $$
DECLARE moved integer;
BEGIN
  SELECT count(*) INTO moved FROM public.atlas_pois WHERE kind = 'racing_area';
  IF moved <> (SELECT count(*) FROM public.venue_racing_areas) THEN
    RAISE EXCEPTION 'racing-area fold row count mismatch: % POIs vs % source rows',
      moved, (SELECT count(*) FROM public.venue_racing_areas);
  END IF;
END $$;

-- 3. Repoint discussion anchors (same UUIDs → direct copy), then collapse the
--    dual anchor: poi_id is the only place anchor from here on. The CHECK must
--    go first — it rejects rows that briefly hold both anchors mid-backfill.
ALTER TABLE public.venue_discussions
  DROP CONSTRAINT IF EXISTS venue_discussions_single_anchor;

UPDATE public.venue_discussions
SET poi_id = racing_area_id
WHERE racing_area_id IS NOT NULL;

ALTER TABLE public.venue_discussions DROP COLUMN IF EXISTS racing_area_id;
ALTER TABLE public.venue_knowledge_documents DROP COLUMN IF EXISTS racing_area_id;
ALTER TABLE public.venue_knowledge_insights DROP COLUMN IF EXISTS racing_area_id;

-- 4. Race courses keep their column name (zero TS churn) but the FK now
--    targets atlas_pois. Same UUIDs, so no data rewrite is needed.
ALTER TABLE public.venue_race_courses
  DROP CONSTRAINT IF EXISTS venue_race_courses_racing_area_id_fkey;
ALTER TABLE public.venue_race_courses
  ADD CONSTRAINT venue_race_courses_racing_area_id_fkey
  FOREIGN KEY (racing_area_id) REFERENCES public.atlas_pois(id) ON DELETE CASCADE;

-- 5. Drop the confirmation machinery, the nearby-RPC (sole caller is the
--    deleted CommunityVenueCreationService), and finally the table itself.
--    update_venue_racing_areas_updated_at() is KEPT — the venue_race_courses
--    updated_at trigger reuses it.
DROP TABLE IF EXISTS public.venue_racing_area_confirmations;
DROP FUNCTION IF EXISTS public.check_racing_area_verification();
DROP FUNCTION IF EXISTS public.decrement_racing_area_confirmation();
DROP FUNCTION IF EXISTS public.find_nearby_racing_areas(numeric, numeric, numeric);
DROP TABLE IF EXISTS public.venue_racing_areas;
