-- Atlas Phase A1 seed data
-- Run after migration 20260522150000_atlas_phase_a1_foundation has been applied.
-- Idempotent: ON CONFLICT DO NOTHING via source_ref uniqueness check (manual,
-- since the table doesn't have a unique constraint on source_ref yet — if you
-- re-run, delete the matching rows first or add the constraint).
--
-- Seeds:
--   - 5 RHKYC POIs (Royal Hong Kong Yacht Club + 4 racing areas) for the
--     sail-racing interest
--   - 6 JHSON POIs (Pinkard campus + 5 affiliated hospitals) for the nursing
--     interest, 5 marked is_healthcare_site
--   - 4 atlas_institution_layers entries activating the appropriate curated
--     layers for each org
--
-- Org IDs are pre-existing and stable in the dev/prod databases:
--   RHKYC : a1000001-0000-0000-0000-000000000001
--   JHSON : 678e149e-2abb-422c-ac61-b76756a2150e

-- ============================================================================
-- RHKYC POIs (sail-racing)
-- ============================================================================

INSERT INTO public.atlas_pois
  (interest_slug, source, source_ref, name, lat, lng, kind, claimed_by_org_id, metadata)
VALUES
  ('sail-racing', 'institution', 'rhkyc-clubhouse',
   'Royal Hong Kong Yacht Club',
   22.2823, 114.1880, 'club',
   'a1000001-0000-0000-0000-000000000001',
   '{"role":"clubhouse","city":"Hong Kong","district":"Causeway Bay","island":"Kellett Island"}'::jsonb),
  ('sail-racing', 'institution', 'rhkyc-victoria-harbour',
   'Victoria Harbour',
   22.2978, 114.1850, 'racing_area',
   'a1000001-0000-0000-0000-000000000001',
   '{"role":"main_racing_area","typical_conditions":"variable","tide_relevant":true,"radius_km":3}'::jsonb),
  ('sail-racing', 'institution', 'rhkyc-port-shelter',
   'Port Shelter',
   22.3683, 114.2920, 'racing_area',
   'a1000001-0000-0000-0000-000000000001',
   '{"role":"secondary_racing_area","typical_conditions":"open_water","radius_km":5}'::jsonb),
  ('sail-racing', 'institution', 'rhkyc-middle-island',
   'Middle Island channel',
   22.2280, 114.1880, 'racing_area',
   'a1000001-0000-0000-0000-000000000001',
   '{"role":"secondary_racing_area","radius_km":2}'::jsonb),
  ('sail-racing', 'institution', 'rhkyc-lamma-channel',
   'Lamma Channel',
   22.2150, 114.1280, 'racing_area',
   'a1000001-0000-0000-0000-000000000001',
   '{"role":"secondary_racing_area","radius_km":3}'::jsonb);

-- ============================================================================
-- JHSON POIs (nursing) — healthcare sites locked to site-level precision floor
-- ============================================================================

INSERT INTO public.atlas_pois
  (interest_slug, source, source_ref, name, lat, lng, kind, claimed_by_org_id, is_healthcare_site, metadata)
VALUES
  ('nursing', 'institution', 'jhson-pinkard',
   'JHU School of Nursing — Pinkard Building',
   39.2998, -76.5912, 'sim_lab',
   '678e149e-2abb-422c-ac61-b76756a2150e',
   false,
   '{"role":"campus","city":"Baltimore","state":"MD","includes":["sim_suite","library","faculty_offices"]}'::jsonb),
  ('nursing', 'institution', 'jhson-east-baltimore',
   'Johns Hopkins Hospital — East Baltimore',
   39.2966, -76.5919, 'hospital',
   '678e149e-2abb-422c-ac61-b76756a2150e',
   true,
   '{"role":"primary_clinical_site","city":"Baltimore","state":"MD","accreditation":["ACGME","Magnet"]}'::jsonb),
  ('nursing', 'institution', 'jhson-bayview',
   'Johns Hopkins Bayview Medical Center',
   39.2912, -76.5489, 'hospital',
   '678e149e-2abb-422c-ac61-b76756a2150e',
   true,
   '{"role":"primary_clinical_site","city":"Baltimore","state":"MD"}'::jsonb),
  ('nursing', 'institution', 'jhson-sibley',
   'Sibley Memorial Hospital',
   38.9404, -77.1075, 'hospital',
   '678e149e-2abb-422c-ac61-b76756a2150e',
   true,
   '{"role":"affiliated_clinical_site","city":"Washington","state":"DC"}'::jsonb),
  ('nursing', 'institution', 'jhson-suburban',
   'Suburban Hospital',
   39.0029, -77.1037, 'hospital',
   '678e149e-2abb-422c-ac61-b76756a2150e',
   true,
   '{"role":"affiliated_clinical_site","city":"Bethesda","state":"MD"}'::jsonb),
  ('nursing', 'institution', 'jhson-howard-county',
   'Howard County General Hospital',
   39.2104, -76.8625, 'hospital',
   '678e149e-2abb-422c-ac61-b76756a2150e',
   true,
   '{"role":"affiliated_clinical_site","city":"Columbia","state":"MD"}'::jsonb);

-- ============================================================================
-- Institution layer activations
-- ============================================================================

INSERT INTO public.atlas_institution_layers (org_id, layer_id, is_active)
VALUES
  ('a1000001-0000-0000-0000-000000000001', 'sailing.race_marks',         true),
  ('a1000001-0000-0000-0000-000000000001', 'institution.curated_sites', true),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'core.healthcare_pois',      true),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'institution.curated_sites', true)
ON CONFLICT (org_id, layer_id) DO NOTHING;
