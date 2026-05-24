-- F7 entrepreneur atlas_pois — reclassify existing rows that were seeded
-- with sailing kinds (club/racing_area/sim_lab) and add the rows missing
-- vs the F7 design: Bero MON haat + a mentee location near Tamar.
--
-- New kinds used here (free text — atlas_pois.kind has no enum constraint):
--   - 'haat'      — weekly market (green diamond + day-of-week badge)
--   - 'supplier'  — supplier village (white square)
--   - 'mentee'    — mentee's posting location (small green circle)
--   - 'home'      — user's home base (blue dot anchor, mirror of poi-club-anchor)

UPDATE public.atlas_pois
SET kind = 'haat',
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{day_of_week}',
      '["wed","sat"]'::jsonb
    )
WHERE name = 'Khunti haat · खुनी हाट';

UPDATE public.atlas_pois
SET kind = 'haat',
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{day_of_week}',
      '["wed"]'::jsonb
    )
WHERE name = 'Tamar haat · तमाड़ हाट';

UPDATE public.atlas_pois
SET kind = 'supplier'
WHERE name IN ('Bero supplier village', 'Sundri supplier village');

UPDATE public.atlas_pois
SET kind = 'home'
WHERE name = 'Lakshmi · home';

-- Bero MON haat (the design shows "Bero · MON" diamond).
INSERT INTO public.atlas_pois (name, kind, lat, lng, interest_slug, source, metadata)
SELECT 'Bero haat · बेरो हाट', 'haat', 23.4500, 85.0700, 'lac-craft-business', 'curated',
       '{"day_of_week":["mon"], "label_short":"Bero"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.atlas_pois WHERE name = 'Bero haat · बेरो हाट');

-- A mentee posting location near Tamar (matches the "1 mentee posted
-- nearby this morning" line in the bottom-sheet body).
INSERT INTO public.atlas_pois (name, kind, lat, lng, interest_slug, source, metadata)
SELECT 'Asha · mentee', 'mentee', 22.95, 85.59, 'lac-craft-business', 'curated',
       '{"posted_at":"this morning", "specialty":"beadwork"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.atlas_pois WHERE name = 'Asha · mentee');

-- Three more supplier villages so the network feels populated.
INSERT INTO public.atlas_pois (name, kind, lat, lng, interest_slug, source, metadata)
SELECT 'Karra supplier village', 'supplier', 23.300, 85.200, 'lac-craft-business', 'curated', '{"craft":"lac"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.atlas_pois WHERE name = 'Karra supplier village');

INSERT INTO public.atlas_pois (name, kind, lat, lng, interest_slug, source, metadata)
SELECT 'Murhu supplier village', 'supplier', 23.130, 85.340, 'lac-craft-business', 'curated', '{"craft":"bamboo"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.atlas_pois WHERE name = 'Murhu supplier village');

INSERT INTO public.atlas_pois (name, kind, lat, lng, interest_slug, source, metadata)
SELECT 'Burmu supplier village', 'supplier', 23.395, 85.460, 'lac-craft-business', 'curated', '{"craft":"dyeing"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.atlas_pois WHERE name = 'Burmu supplier village');
