-- Extend atlas_pois so it can absorb venue_racing_areas (the fold's schema half).
-- atlas_pois becomes the single place primitive: point POIs keep geometry NULL,
-- racing areas (and future area-shaped places) carry GeoJSON in `geometry`.

ALTER TABLE public.atlas_pois
  ADD COLUMN IF NOT EXISTS geometry jsonb,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS verification_status text
    CHECK (verification_status IN ('pending', 'verified', 'disputed'));

CREATE INDEX IF NOT EXISTS atlas_pois_kind_active_idx
  ON public.atlas_pois (kind, is_active);

-- Anonymous read parity: venue_racing_areas was public-read and the anonymous
-- web embed (app/embed/discuss.tsx) renders place labels. Places, not people.
DROP POLICY IF EXISTS atlas_pois_anon_read ON public.atlas_pois;
CREATE POLICY atlas_pois_anon_read ON public.atlas_pois
  FOR SELECT TO anon USING (true);

-- Tighten the existing user-propose INSERT now that created_by exists, and add
-- the community UPDATE/DELETE policies venue_racing_areas had. Delete stays
-- blocked once a row is verified (mirrors the old community-area rule).
DROP POLICY IF EXISTS atlas_pois_user_propose ON public.atlas_pois;
CREATE POLICY atlas_pois_user_propose ON public.atlas_pois
  FOR INSERT TO authenticated
  WITH CHECK (
    source = 'user_proposed'
    AND claimed_by_org_id IS NULL
    AND created_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS atlas_pois_user_update_own ON public.atlas_pois;
CREATE POLICY atlas_pois_user_update_own ON public.atlas_pois
  FOR UPDATE TO authenticated
  USING (source = 'user_proposed' AND created_by = (SELECT auth.uid()))
  WITH CHECK (source = 'user_proposed' AND created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS atlas_pois_user_delete_own ON public.atlas_pois;
CREATE POLICY atlas_pois_user_delete_own ON public.atlas_pois
  FOR DELETE TO authenticated
  USING (
    source = 'user_proposed'
    AND created_by = (SELECT auth.uid())
    AND verification_status IS DISTINCT FROM 'verified'
  );
