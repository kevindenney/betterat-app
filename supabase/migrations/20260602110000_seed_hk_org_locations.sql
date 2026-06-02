-- Seed organization_locations for the Hong Kong sailing-demo orgs.
--
-- Before this, organization_locations held only Johns Hopkins School of
-- Nursing's six Baltimore sites, so Atlas/Discover "Nearby" (which bbox-
-- queries organization_locations within 25km of the viewer) was always
-- empty for the HK sailing persona — even though the Atlas map plots HK
-- pins from a separate POI source. This backfills real addresses for the
-- core HK orgs so the nearest-orgs list actually populates.
--
-- Coordinates are the orgs' real premises (sourced from public listings):
--   RHKYC  : Kellett Island clubhouse + Middle Island + Shelter Cove stations
--   HKIS   : Tai Tam (Red Hill) + Repulse Bay campuses
--   HKSF   : Olympic House, So Kon Po
--   HKDA   : Dragon class base at RHKYC Middle Island
--
-- Idempotent: clears any existing rows for these four org ids first.

DELETE FROM public.organization_locations
WHERE organization_id IN (
  'a1000001-0000-0000-0000-000000000001', -- Royal Hong Kong Yacht Club
  'a1000005-0000-0000-0000-000000000005', -- Hong Kong International School
  'a1000006-0000-0000-0000-000000000006', -- Hong Kong Sailing Federation
  'aab60e8a-7712-4c89-98dd-6bc91c3d858f'  -- Hong Kong Dragon Association
);

INSERT INTO public.organization_locations
  (organization_id, name, description, lat, lng, sort_order)
VALUES
  -- Royal Hong Kong Yacht Club
  ('a1000001-0000-0000-0000-000000000001', 'Kellett Island Clubhouse',
   'Kellett Island, Causeway Bay, Hong Kong', 22.2850, 114.1822, 1),
  ('a1000001-0000-0000-0000-000000000001', 'Middle Island Station',
   'Middle Island, Repulse Bay, Hong Kong', 22.2378, 114.1853, 2),
  ('a1000001-0000-0000-0000-000000000001', 'Shelter Cove Station',
   'Port Shelter, Sai Kung, Hong Kong', 22.3640, 114.2710, 3),

  -- Hong Kong International School
  ('a1000005-0000-0000-0000-000000000005', 'Tai Tam Campus',
   '1 Red Hill Road, Tai Tam, Hong Kong', 22.2447, 114.2156, 1),
  ('a1000005-0000-0000-0000-000000000005', 'Repulse Bay Campus',
   '6 South Bay Close, Repulse Bay, Hong Kong', 22.2353, 114.1979, 2),

  -- Hong Kong Sailing Federation
  ('a1000006-0000-0000-0000-000000000006', 'Olympic House',
   'Rm 1009, Olympic House, 1 Stadium Path, So Kon Po, Causeway Bay', 22.2731, 114.1839, 1),

  -- Hong Kong Dragon Association (Dragon class, based at RHKYC Middle Island)
  ('aab60e8a-7712-4c89-98dd-6bc91c3d858f', 'RHKYC Middle Island (Dragon fleet)',
   'Middle Island, Repulse Bay, Hong Kong', 22.2378, 114.1853, 1);
