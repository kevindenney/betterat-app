-- Bridge fleets to their organization (the club-native link).
--
-- fleets had no org linkage: fleets.club_id points at the legacy `clubs` table
-- (8 rows), an island separate from `organizations` (where the claimable yacht
-- clubs, programs, blueprints, and billing all live). So a claimed club owned no
-- fleets and discoverable fleets belonged to no club. Add a direct FK to
-- organizations; `club_id`/`clubs` stays as a legacy column (not dropped, not
-- migrated).

ALTER TABLE public.fleets
  ADD COLUMN IF NOT EXISTS organization_id uuid
  REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fleets_organization_id
  ON public.fleets(organization_id);

-- Let active members of an org read that org's club-visibility fleets — the
-- payoff of the bridge ("join your club, see its fleets"). Existing policies are
-- unchanged and OR-combined: public fleets stay public, private stays
-- creator-only, and club fleets with no organization stay hidden from outsiders.
DROP POLICY IF EXISTS "Org members view their org club fleets" ON public.fleets;
CREATE POLICY "Org members view their org club fleets"
  ON public.fleets FOR SELECT
  USING (
    visibility = 'club'
    AND organization_id IS NOT NULL
    AND organization_id IN (
      SELECT om.organization_id
      FROM public.organization_memberships om
      WHERE om.user_id = (SELECT auth.uid())
        AND (om.status = 'active' OR om.membership_status = 'active')
    )
  );
