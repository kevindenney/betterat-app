-- Mirror Johns Hopkins School of Nursing's organization_locations into
-- atlas_pois so the org-detail page list and the Atlas map render the
-- exact same six institutional sites.
--
-- Before this migration the two surfaces showed different six-pin sets
-- (only "Bayview" overlapped verbatim). The org page was treated as the
-- source of truth — buildings the institution actually operates from —
-- and the Atlas map mirrored that, plus its existing preceptors.
--
-- Long-term, the Atlas pin source should read organization_locations
-- directly instead of duplicating into atlas_pois. This is a seed-time
-- one-shot sync; the architectural cleanup is a separate task.

DELETE FROM public.atlas_pois
WHERE claimed_by_org_id = '678e149e-2abb-422c-ac61-b76756a2150e'
  AND kind IN ('hospital', 'sim_lab');

INSERT INTO public.atlas_pois (
  interest_slug, source, source_ref, name, lat, lng, kind,
  claimed_by_org_id, is_healthcare_site, metadata
)
SELECT
  'nursing',
  'institution',
  'org_location:' || id::text,
  name,
  lat,
  lng,
  CASE
    -- SoN building + Simulation Center map to sim_lab so the canvas
    -- renders the SIM badge. Everything else (community nursing
    -- center, hospital wings, clinic) reads as a hospital pin.
    WHEN name ILIKE '%school of nursing%' THEN 'sim_lab'
    WHEN name ILIKE '%simulation%' THEN 'sim_lab'
    ELSE 'hospital'
  END,
  organization_id,
  true,
  '{}'::jsonb
FROM public.organization_locations
WHERE organization_id = '678e149e-2abb-422c-ac61-b76756a2150e'
ORDER BY sort_order;
