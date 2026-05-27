-- =====================================================
-- Soft-disable the seeded "official" racing areas and remove the
-- RHKYC placeholder POI.
-- =====================================================
--
-- Context: the venue_racing_areas rows with source='official' were
-- seeded with rough circle/rectangle approximations of HK racing
-- water (Clearwater Bay, Lamma Channel, Middle Island, Port Shelter,
-- Victoria Harbour). They're misinformation — wrong shapes, wrong
-- exact locations — and they don't belong to any real organization.
-- Until a real yacht club claims itself in BetterAt and draws their
-- own area, showing these placeholders does more harm than good.
--
-- Strategy: flip is_active=false (preserves the row for inspection /
-- restore via UPDATE) rather than DELETE, so the schema +
-- "official" source flag stay ready for the eventual claim flow.
--
-- The RHKYC atlas_pois row is the only club POI in the table and
-- exists as a placeholder for a club that hasn't claimed BetterAt.
-- atlas_pois has no is_active column so we delete it — schema is
-- preserved, the placeholder isn't.
-- =====================================================

UPDATE public.venue_racing_areas
   SET is_active = false,
       updated_at = NOW()
 WHERE source = 'official'
   AND is_active = true;

-- Remove the RHKYC placeholder POI. It's linked to a placeholder
-- organization row (id a1000001-0000-0000-0000-000000000001) that
-- isn't a real claim. The organization row itself stays in place
-- because 9 organization_memberships reference it — those need a
-- separate audit + cleanup pass before the placeholder org can be
-- removed safely. Removing the POI is enough to take RHKYC off the
-- map for now.
DELETE FROM public.atlas_pois
 WHERE id = '75e4d40d-7e71-4783-bb24-4897444d2eed'
   AND name = 'Royal Hong Kong Yacht Club';
