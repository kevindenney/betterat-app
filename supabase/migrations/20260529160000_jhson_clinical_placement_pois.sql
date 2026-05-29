-- Restore JHSON clinical-placement hospital POIs for the dean's Insights
-- heatmap + faculty competency-convergence view.
--
-- Root cause this heals:
--   supabase/seeds/jhson_competency_evidence_phase_4d.sql places 189
--   confirmed evidence rows across 5 clinical-placement hospitals, matched
--   to atlas_pois BY NAME ('Johns Hopkins Hospital — East Baltimore',
--   'Johns Hopkins Bayview Medical Center', 'Suburban Hospital',
--   'Sibley Memorial Hospital', 'Howard County General Hospital').
--   Migration 20260528070000 later DELETEs every JHSON hospital POI and
--   re-mirrors only the six organization_locations buildings. Because
--   step_location.poi_id → atlas_pois.id is ON DELETE SET NULL
--   (step_location_poi_fk), that DELETE nulls all 189 poi_ids and the RPC
--   admin_competency_evidence_counts returns zero real cells — the hook
--   silently falls back to pseudo data.
--
-- Fix: ensure the 5 clinical-placement hospitals exist as claimed POIs,
-- then re-link the evidence step_locations by name. Idempotent and
-- order-independent vs the seed (heals null poi_ids whether the seed ran
-- before or after this migration). Runs after 20260528070000 so its blanket
-- DELETE can't strip these again.
--
-- Note: clinical-placement hospitals are intentionally POI-only (not in
-- organization_locations), so the org-detail page keeps showing the six
-- buildings the school operates from while the Atlas + Insights surfaces
-- gain the rotation sites. JHH appears on Atlas as "— East Baltimore"
-- (campus / rotation framing) vs the org page's building label.

DO $$
DECLARE
  v_org uuid := '678e149e-2abb-422c-ac61-b76756a2150e';
BEGIN
  -- Reuse the mirrored JHH building POI as the East Baltimore rotation site
  -- (it carries no evidence under its building name).
  UPDATE public.atlas_pois
  SET name = 'Johns Hopkins Hospital — East Baltimore',
      lat = 39.296600, lng = -76.591900, updated_at = now()
  WHERE claimed_by_org_id = v_org
    AND name = 'Johns Hopkins Hospital — Nelson/Harvey';

  -- Claim the rotation hospitals that aren't org buildings.
  INSERT INTO public.atlas_pois
    (interest_slug, source, source_ref, name, lat, lng, kind, claimed_by_org_id, is_healthcare_site, metadata)
  SELECT 'nursing', 'institution', 'clinical_placement:' || v.name,
         v.name, v.lat, v.lng, 'hospital', v_org, true, '{}'::jsonb
  FROM (VALUES
    ('Suburban Hospital', 39.002900, -77.103700),
    ('Sibley Memorial Hospital', 38.940400, -77.107500),
    ('Howard County General Hospital', 39.210400, -76.862500)
  ) AS v(name, lat, lng)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.atlas_pois p
    WHERE p.claimed_by_org_id = v_org AND p.name = v.name
  );

  -- Heal evidence step_locations whose poi_id was nulled (or never set).
  UPDATE public.step_location sl
  SET poi_id = p.id
  FROM public.atlas_pois p
  WHERE p.claimed_by_org_id = v_org
    AND p.name = sl.name
    AND sl.poi_id IS NULL
    AND sl.step_id IN (
      SELECT sce.step_id
      FROM public.step_capability_evidence sce
      JOIN public.org_competencies oc ON oc.id = sce.org_competency_id
      WHERE oc.org_id = v_org
    );
END $$;
