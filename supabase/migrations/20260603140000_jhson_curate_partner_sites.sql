-- N4 — Curated JHU partner layer.
--
-- The nursing Atlas Sites surface gains a partnership-gated "Partner network"
-- section listing the official clinical-placement and simulation sites a
-- partner institution publishes. The link already exists in data: a partner
-- claims its sites as atlas_pois (claimed_by_org_id = org, source =
-- 'institution'). This migration adds a durable curation marker + a display
-- label for the simulation suite so the surface can read the network without
-- inferring it.
--
-- Polish only — useNursingCuratedSites derives the network from
-- claimed_by_org_id/source/is_healthcare_site regardless, and reads
-- metadata.curated_label for display when present. Names are NOT mutated:
-- clinical-placement evidence is matched to POIs BY NAME
-- (see 20260529160000_jhson_clinical_placement_pois.sql), so renaming a POI
-- would orphan its evidence. The Pinkard label lives in metadata instead.
--
-- Idempotent: re-running merges the same keys.

DO $$
DECLARE
  v_org uuid := '678e149e-2abb-422c-ac61-b76756a2150e';  -- Johns Hopkins School of Nursing
BEGIN
  -- Mark every JHSON-claimed clinical site as curated, tagged by role.
  UPDATE public.atlas_pois
  SET metadata = COALESCE(metadata, '{}'::jsonb)
        || jsonb_build_object(
             'curated', true,
             'partner_role', CASE WHEN kind = 'sim_lab' THEN 'simulation' ELSE 'placement' END
           ),
      updated_at = now()
  WHERE claimed_by_org_id = v_org
    AND source = 'institution'
    AND is_healthcare_site = true;

  -- The Anne M. Pinkard Building (525 N Wolfe St) is JHSON's simulation suite;
  -- give it the student-facing label the mockup uses without touching `name`.
  UPDATE public.atlas_pois
  SET metadata = COALESCE(metadata, '{}'::jsonb)
        || jsonb_build_object('curated_label', 'JHSON · Pinkard Sim Suite'),
      updated_at = now()
  WHERE claimed_by_org_id = v_org
    AND name = 'JHU School of Nursing — Wolfe St Building';
END $$;
