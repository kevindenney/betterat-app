-- Bridge fleets -> organizations (the modern org model), and seed the three
-- missing yacht-club placeholders so every club-owned fleet can attach to an org.
--
-- Background: fleets carry two ownership links, legacy `club_id` -> public.clubs
-- (an 8-row stub used only by fleets) and modern `organization_id` ->
-- public.organizations (the claimable Dragon-class placeholders surfaced in
-- Library discovery). `organization_id` was 0/26 populated, so every org
-- placeholder showed zero fleets (FleetDiscoveryService.getFleetsByOrganization
-- filters on organization_id). This reconciles the fleet's legacy club to an
-- organization by name/alias and backfills organization_id.
--
-- Of the four clubs fleets actually use, only RHKYC already existed as an org.
-- Step 1 seeds SFYC / RSYS / Miami YC as unclaimed placeholders mirroring the
-- dragon_worlds seed shape so their fleets bridge too. Club-less region fleets
-- (the generic "Hong Kong <class> Fleet" rows) own no club and stay null by
-- design -- they are open region fleets, not club-owned.

-- 1. Seed the three missing club orgs as unclaimed placeholders.
INSERT INTO public.organizations (
  name, slug, organization_type, verification_mode, allowed_email_domains,
  metadata, is_active, join_mode, interest_slug, status, official, claim_status,
  confidence, source, source_urls, aliases, risk_flags,
  clubspot_apac_entry_refs, clubspot_worlds_entry_refs, total_entry_refs,
  pricing_tier, creation_source
)
SELECT
  v.name, v.slug, 'yacht_club', 'none', '{}'::text[],
  jsonb_build_object('source', 'fleet_bridge_backfill', 'created_by', 'seed_import'),
  true, 'request_to_join', 'sail-racing', 'placeholder', false, 'unclaimed',
  'high', 'fleet_bridge_backfill', '{}'::text[], v.aliases, '{}'::text[],
  0, 0, 0, 'club_free', 'seeded'
FROM (VALUES
  ('San Francisco Yacht Club',   'san-francisco-yacht-club',    ARRAY['SFYC', 'San Francisco Yacht Club']),
  ('Royal Sydney Yacht Squadron','royal-sydney-yacht-squadron', ARRAY['RSYS', 'Royal Sydney Yacht Squadron']),
  ('Miami Yacht Club',           'miami-yacht-club',            ARRAY['MYC', 'Miami Yacht Club'])
) AS v(name, slug, aliases)
WHERE NOT EXISTS (
  SELECT 1 FROM public.organizations o WHERE lower(o.name) = lower(v.name)
);

-- 2. FK + index so a fleet can declare its owning org and reads stay fast.
ALTER TABLE public.fleets DROP CONSTRAINT IF EXISTS fleets_organization_id_fkey;
ALTER TABLE public.fleets
  ADD CONSTRAINT fleets_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS fleets_organization_id_idx
  ON public.fleets(organization_id);

-- 3. Backfill organization_id by reconciling the fleet's legacy club to an org
--    via name or alias. Connects all 12 club-owned fleets; orgless / club-less
--    fleets stay null.
UPDATE public.fleets f
SET organization_id = o.id
FROM public.clubs c
JOIN public.organizations o
  ON lower(o.name) = lower(c.name)
  OR c.name       = ANY(o.aliases)
  OR c.short_name = ANY(o.aliases)
WHERE f.club_id = c.id
  AND f.organization_id IS NULL;
