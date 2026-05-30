BEGIN;

ALTER TABLE IF EXISTS public.organizations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS official boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS claim_status text NOT NULL DEFAULT 'claimed',
  ADD COLUMN IF NOT EXISTS confidence text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS source_summary text,
  ADD COLUMN IF NOT EXISTS source_urls text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS risk_flags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS clubspot_apac_entry_refs integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clubspot_worlds_entry_refs integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_entry_refs integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pricing_tier text NOT NULL DEFAULT 'enterprise';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_organization_type_check'
      AND conrelid = 'public.organizations'::regclass
  ) THEN
    ALTER TABLE public.organizations
      DROP CONSTRAINT organizations_organization_type_check;
  END IF;

  ALTER TABLE public.organizations
    ADD CONSTRAINT organizations_organization_type_check
    CHECK (organization_type IN (
      'club',
      'institution',
      'association',
      'business',
      'community',
      'other',
      'yacht_club'
    ));
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizations_status_check'
      AND conrelid = 'public.organizations'::regclass
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_status_check
      CHECK (status IN ('placeholder', 'active', 'archived'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizations_claim_status_check'
      AND conrelid = 'public.organizations'::regclass
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_claim_status_check
      CHECK (claim_status IN ('unclaimed', 'claim_pending', 'claimed', 'rejected'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizations_confidence_check'
      AND conrelid = 'public.organizations'::regclass
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_confidence_check
      CHECK (confidence IS NULL OR confidence IN ('high', 'medium', 'low'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizations_pricing_tier_check'
      AND conrelid = 'public.organizations'::regclass
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_pricing_tier_check
      CHECK (pricing_tier IN ('club_free', 'club_plus', 'club_pro', 'enterprise'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS organizations_yacht_club_claim_idx
  ON public.organizations (organization_type, status, claim_status)
  WHERE organization_type = 'yacht_club';

CREATE INDEX IF NOT EXISTS organizations_source_idx
  ON public.organizations (source);

CREATE TABLE IF NOT EXISTS public.organization_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  alias text NOT NULL,
  normalized_alias text NOT NULL,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('clubspot', 'manual', 'web_evidence')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, normalized_alias)
);

CREATE INDEX IF NOT EXISTS organization_aliases_normalized_idx
  ON public.organization_aliases (normalized_alias);

CREATE TABLE IF NOT EXISTS public.organization_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entrant_name text,
  sail_number text,
  boat_name text,
  clubspot_club text,
  inferred_org text NOT NULL,
  confidence text NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  source_type text NOT NULL CHECK (
    source_type IN ('clubspot', 'official-results', 'club-site', 'class-association', 'news', 'manual-review')
  ),
  matched_on text[] NOT NULL DEFAULT '{}'::text[],
  source_url text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organization_evidence_org_idx
  ON public.organization_evidence (organization_id);

CREATE TABLE IF NOT EXISTS public.organization_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  submitted_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitted_by_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'needs_more_info')),
  verification_method text NOT NULL CHECK (
    verification_method IN ('email_domain', 'official_website_link', 'authorization_letter', 'manual_admin')
  ),
  claimant_name text NOT NULL,
  claimant_role text NOT NULL,
  claimant_message text,
  evidence_url text,
  reviewed_by_user_id uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organization_claims_status_idx
  ON public.organization_claims (status, created_at DESC);

CREATE INDEX IF NOT EXISTS organization_claims_org_idx
  ON public.organization_claims (organization_id, status);

CREATE OR REPLACE FUNCTION public.is_betterat_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'platform_admin', 'betterat_admin')
    OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'platform_admin', 'betterat_admin')
    OR (auth.jwt() -> 'app_metadata' -> 'roles') ?| ARRAY['admin', 'platform_admin', 'betterat_admin'],
    false
  );
$$;

ALTER TABLE public.organization_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organization_aliases_public_read" ON public.organization_aliases;
CREATE POLICY "organization_aliases_public_read"
  ON public.organization_aliases FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "organization_evidence_public_read" ON public.organization_evidence;
CREATE POLICY "organization_evidence_public_read"
  ON public.organization_evidence FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "organization_claims_insert_own" ON public.organization_claims;
CREATE POLICY "organization_claims_insert_own"
  ON public.organization_claims FOR INSERT
  TO authenticated
  WITH CHECK (
    submitted_by_user_id = auth.uid()
    AND status = 'pending'
  );

DROP POLICY IF EXISTS "organization_claims_read_own_or_platform_admin" ON public.organization_claims;
CREATE POLICY "organization_claims_read_own_or_platform_admin"
  ON public.organization_claims FOR SELECT
  TO authenticated
  USING (
    submitted_by_user_id = auth.uid()
    OR public.is_betterat_platform_admin()
  );

DROP POLICY IF EXISTS "organization_claims_platform_admin_update" ON public.organization_claims;
CREATE POLICY "organization_claims_platform_admin_update"
  ON public.organization_claims FOR UPDATE
  TO authenticated
  USING (public.is_betterat_platform_admin())
  WITH CHECK (public.is_betterat_platform_admin());

CREATE OR REPLACE FUNCTION public.set_organization_claim_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.organizations
  SET claim_status = 'claim_pending',
      updated_at = COALESCE(now(), updated_at)
  WHERE id = NEW.organization_id
    AND claim_status = 'unclaimed'
    AND status = 'placeholder';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_organization_claim_pending ON public.organization_claims;
CREATE TRIGGER trg_set_organization_claim_pending
  AFTER INSERT ON public.organization_claims
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_claim_pending();

CREATE OR REPLACE FUNCTION public.review_organization_claim(
  p_claim_id uuid,
  p_decision text,
  p_review_note text DEFAULT NULL
)
RETURNS public.organization_claims
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim public.organization_claims%ROWTYPE;
BEGIN
  IF NOT public.is_betterat_platform_admin() THEN
    RAISE EXCEPTION 'Platform admin required';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected', 'needs_more_info') THEN
    RAISE EXCEPTION 'Invalid claim decision: %', p_decision;
  END IF;

  SELECT * INTO v_claim
  FROM public.organization_claims
  WHERE id = p_claim_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found';
  END IF;

  UPDATE public.organization_claims
  SET status = p_decision,
      reviewed_by_user_id = auth.uid(),
      reviewed_at = now(),
      review_note = p_review_note,
      updated_at = now()
  WHERE id = p_claim_id
  RETURNING * INTO v_claim;

  IF p_decision = 'approved' THEN
    UPDATE public.organizations
    SET claim_status = 'claimed',
        official = true,
        status = 'active',
        pricing_tier = COALESCE(NULLIF(pricing_tier, ''), 'club_free'),
        updated_at = now()
    WHERE id = v_claim.organization_id;

    INSERT INTO public.organization_memberships (
      organization_id,
      user_id,
      role,
      status,
      membership_status,
      is_verified,
      verification_source,
      verified_at,
      joined_at,
      metadata
    )
    VALUES (
      v_claim.organization_id,
      v_claim.submitted_by_user_id,
      'admin',
      'active',
      'active',
      true,
      'yacht_club_claim',
      now(),
      now(),
      jsonb_build_object('claim_id', v_claim.id, 'claimant_role', v_claim.claimant_role)
    )
    ON CONFLICT DO NOTHING;
  ELSIF p_decision = 'rejected' THEN
    UPDATE public.organizations
    SET claim_status = 'rejected',
        official = false,
        status = 'placeholder',
        updated_at = now()
    WHERE id = v_claim.organization_id;
  END IF;

  RETURN v_claim;
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_organization_claim(uuid, text, text) TO authenticated;

WITH seed(canonical_name, slug, aliases, apac_refs, worlds_refs, total_refs, confidence, source_summary, source_urls) AS (
  VALUES
    ('Royal Hong Kong Yacht Club', 'royal-hong-kong-yacht-club', ARRAY['RHKYC','Rhkyc','Royal Hong Kong yacht club'], 6, 12, 18, 'high', 'ClubSpot has the strongest entrant signal. RHKYC Dragon page corroborates active Dragon class and boats including Kam Loong.', ARRAY['https://www.rhkyc.org.hk/en/sailing/classes/classes/dragon']),
    ('Norddeutscher Regatta Verein', 'norddeutscher-regatta-verein', ARRAY['NRV','Norddeutscher Regatta Verein'], 5, 8, 13, 'high', 'ClubSpot abbreviation resolves to NRV. RRS and Sydney Hobart public profiles corroborate Christopher Opielok / Rockall as NRV.', ARRAY['https://www.rrs.sh/competitors/7130/event','https://www.rolexsydneyhobart.com/the-yachts/2017/rockall/']),
    ('Royal Freshwater Bay Yacht Club', 'royal-freshwater-bay-yacht-club', ARRAY['RFBYC','Royal Freshwater Bay Yacht Club'], 2, 3, 5, 'high', 'ClubSpot names RFBYC explicitly. RFBYC results corroborate Sandy Anderson / Blue Marlin AUS219 and David Lynn / Relentless.', ARRAY['https://rfbyc.asn.au/dragon-state-championship','https://rfbyc.asn.au/documents/20124/665433/Saturday%2BSummer%2B2024-25%2BSeries%2BResults.pdf/fbeb3819-bc11-a6d6-462e-120f6f2d4665?t=1763437514319']),
    ('Royal Yacht Squadron', 'royal-yacht-squadron', ARRAY['RYS','Royal Yacht Squadron'], 2, 3, 5, 'high', 'ClubSpot lists RYS/Royal Yacht Squadron. Public Dragon results corroborate Graham Bailey / Bluebottle GBR192 as Royal Yacht Squadron.', ARRAY['https://www.scyc.co.uk/wp-content/uploads/2024/07/Dragon-Northerns-2024-1.pdf']),
    ('Yacht Club Sanremo', 'yacht-club-sanremo', ARRAY['Yacht club Sanremo','Yacht Club Sanremo'], 1, 1, 2, 'high', 'ClubSpot lists Yacht Club Sanremo. Club and result sources corroborate Yevgen Braslavets / Transbunker ITA79.', ARRAY['https://www.yachtclubsanremo.it/en/a-great-summer-of-victories-for-our-members/','https://s3.amazonaws.com/rrs.prod/pxmbteuw6zvmevrra914dnv1ha0f?response-content-disposition=inline%3B+filename%3D%22THIRD+LEG+RESULTS.pdf%22']),
    ('Royal Danish Yacht Club', 'royal-danish-yacht-club', ARRAY['KDY','KDY / HS','Royal Danish Yachtclub'], 1, 1, 2, 'high', 'ClubSpot has KDY / HS. Public Dragon results and IDA references connect Jens Christensen / Out of Bounce DEN410 with KDY/Royal Danish Yacht Club.', ARRAY['https://www.sailarena.com/en/se/club/marstrands-segelsallskap/sm-drake2/ParticipantList/','https://www.yachtsandyachting.com/news/263196/Dragon-class-Marblehead-Trophy-in-Venice']),
    ('Kalev Yacht Club', 'kalev-yacht-club', ARRAY['Kalev Yacht Club','Kalevi Jahtklubi'], 0, 3, 3, 'medium', 'ClubSpot has three Worlds references. Public club feed corroborates Kristian Allikmaa / Tiamat EST55 with Kalevi Jahtklubi, but this should be manually reviewed.', ARRAY['https://jahtklubi1.rssing.com/chan-72049127/latest.php']),
    ('Royal Gothenburg Yacht Club / GKSS', 'royal-gothenburg-yacht-club-gkss', ARRAY['GKSS','Gothenburg Royal Yacht Club'], 1, 2, 3, 'medium', 'ClubSpot has GKSS references. Public Swedish Dragon result snippets show GKSS as common Dragon club, but entrant-specific evidence should be enriched before marking high confidence.', ARRAY['https://www.sailarena.com/contentassets/3e2e1583e55546388df388b623dab9e0/swedish-champoinship-dragon-at-2021.pdf']),
    ('Kansai Yacht Club', 'kansai-yacht-club', ARRAY['KANSAI YACHT CLUB','Kansai Yacht Club'], 0, 3, 3, 'medium', 'ClubSpot has three Worlds references. Needs web enrichment against specific entrant names before official claim outreach.', ARRAY[]::text[]),
    ('Cowes Corinthian Yacht Club', 'cowes-corinthian-yacht-club', ARRAY['CCYC','Cowes Corinthian Yacht Club','Cowes Corinthians Yacht Club'], 1, 2, 3, 'medium', 'ClubSpot has Cowes Corinthian strings. Public Dragon results show related CCYC abbreviations but entrant-specific evidence should be reviewed.', ARRAY['https://www.scyc.co.uk/wp-content/uploads/2024/07/Dragon-Northerns-2024-1.pdf']),
    ('Royal Norwegian Yacht Club', 'royal-norwegian-yacht-club', ARRAY['Royal Norwegian Yachtclub','Royal Norwegian Yacht Club'], 0, 2, 2, 'medium', 'ClubSpot has two Worlds references after alias normalization. Needs entrant-specific enrichment before outreach.', ARRAY[]::text[]),
    ('Royal St George Yacht Club', 'royal-st-george-yacht-club', ARRAY['Royal St George Yacht Club'], 0, 2, 2, 'medium', 'ClubSpot has two Worlds references. Public Dragon results corroborate the club as an active Dragon club, but entrant-specific evidence should be attached.', ARRAY['https://www.scyc.co.uk/wp-content/uploads/2024/07/Dragon-Northerns-2024-1.pdf']),
    ('Newport Harbor Yacht Club', 'newport-harbor-yacht-club', ARRAY['Newport Harbor YC','Newport Harbor Yacht Club'], 1, 1, 2, 'high', 'Public Dragon results corroborate USA325 Magic / William Swigart as Newport Harbor YC. ClubSpot also contains Newport Harbor YC / RHKYC, so RHKYC should stay as a secondary affiliation until claimed.', ARRAY['https://results.rtyc.org/hosted2025/2025SWChampionships.htm','https://www.britishdragons.org/champagne-sailing-and-fierce-competition-on-day-two-of-the-edinburgh-cup/']),
    ('Hornbaek', 'hornbaek', ARRAY['Hornbaek','Hornbæk'], 1, 1, 2, 'high', 'Public Dragon Gold Cup and Sanremo results corroborate Bo Sejr Johansen / Deja Vu as Hornbaek.', ARRAY['https://results.kyc.ie/2024/24GoldCup.html','https://s3.amazonaws.com/rrs.prod/mtqpeak8dkoyfd8lj19iqjgcmac3?response-content-disposition=inline%3B+filename%3D%22RESULTS.pdf%22']),
    ('Verein Seglerhaus am Wannsee', 'verein-seglerhaus-am-wannsee', ARRAY['VSAW','VsAW','Verein Seglerhaus am Wannsee'], 1, 1, 2, 'medium', 'Public results corroborate Axel Schulz / Blue Defender as VSAW-SCE. Because this is a two-club affiliation, seed carefully and review before outreach.', ARRAY['https://s3.amazonaws.com/rrs.prod/k6yzgdcb6odgf6l2ge9fo1h91mqt?response-content-disposition=inline%3B+filename%3D%22CLASSIFICA+SECOND+LEG.pdf%22']),
    ('Hellerup Sailing Club', 'hellerup-sailing-club', ARRAY['Hellerup Sailing Club','Hellerup Club','Hellerup SK'], 0, 1, 1, 'medium', 'ClubSpot lists Blue Lady with Hellerup, Dragoer, and Faaborg. Older Dragon result corroborates Philipp Skafte Holm / Blue Lady with Hellerup Club.', ARRAY['https://www.ycbw.de/wp-content/uploads/Drachen2015-YCSR-ItalianDragonCup-Corinthian.pdf']),
    ('Düsseldorfer Yachtclub', 'dusseldorfer-yachtclub', ARRAY['Düsseldorfer Yachtclub','Duesseldorfer Yachtclub'], 0, 1, 1, 'medium', 'Older Dragon result lists Dirk Neukirchen / Flotter Dreier GER1171 as Düsseldorfer Yachtclub. Current ClubSpot value is unknown, so review before outreach.', ARRAY['https://www.sail-world.com/news/265588/75th-Edinburgh-Cup-and-UK-Dragon-Grand-Prix-overall'])
),
inserted AS (
  INSERT INTO public.organizations (
    id,
    name,
    slug,
    organization_type,
    status,
    official,
    claim_status,
    confidence,
    source,
    source_summary,
    source_urls,
    aliases,
    risk_flags,
    clubspot_apac_entry_refs,
    clubspot_worlds_entry_refs,
    total_entry_refs,
    pricing_tier,
    metadata,
    join_mode,
    interest_slug,
    is_active
  )
  SELECT
    gen_random_uuid(),
    canonical_name,
    slug,
    'yacht_club',
    'placeholder',
    false,
    'unclaimed',
    confidence,
    'dragon_worlds_clubspot',
    source_summary,
    source_urls,
    aliases || canonical_name,
    CASE
      WHEN confidence = 'medium' THEN ARRAY['manual_review_before_outreach']::text[]
      ELSE ARRAY[]::text[]
    END,
    apac_refs,
    worlds_refs,
    total_refs,
    'club_free',
    jsonb_build_object('created_by', 'seed_import', 'source', 'dragon_worlds_clubspot'),
    'request_to_join',
    'sail-racing',
    true
  FROM seed
  ON CONFLICT (slug) DO UPDATE SET
    organization_type = EXCLUDED.organization_type,
    status = CASE WHEN public.organizations.claim_status = 'claimed' THEN public.organizations.status ELSE EXCLUDED.status END,
    official = CASE WHEN public.organizations.claim_status = 'claimed' THEN public.organizations.official ELSE EXCLUDED.official END,
    confidence = EXCLUDED.confidence,
    source = EXCLUDED.source,
    source_summary = EXCLUDED.source_summary,
    source_urls = EXCLUDED.source_urls,
    aliases = EXCLUDED.aliases,
    risk_flags = EXCLUDED.risk_flags,
    clubspot_apac_entry_refs = EXCLUDED.clubspot_apac_entry_refs,
    clubspot_worlds_entry_refs = EXCLUDED.clubspot_worlds_entry_refs,
    total_entry_refs = EXCLUDED.total_entry_refs,
    pricing_tier = CASE WHEN public.organizations.organization_type = 'yacht_club' THEN public.organizations.pricing_tier ELSE EXCLUDED.pricing_tier END,
    metadata = COALESCE(public.organizations.metadata, '{}'::jsonb) || jsonb_build_object('created_by', 'seed_import', 'source', 'dragon_worlds_clubspot'),
    updated_at = now()
  RETURNING id, name, aliases, confidence, source_summary, source_urls
)
INSERT INTO public.organization_aliases (organization_id, alias, normalized_alias, source)
SELECT DISTINCT
  inserted.id,
  alias_value,
  lower(regexp_replace(alias_value, '\s+', ' ', 'g')),
  'clubspot'
FROM inserted
CROSS JOIN LATERAL unnest(inserted.aliases) AS alias_value
WHERE trim(alias_value) <> ''
ON CONFLICT (organization_id, normalized_alias) DO NOTHING;

INSERT INTO public.organization_evidence (
  organization_id,
  inferred_org,
  confidence,
  source_type,
  matched_on,
  source_url,
  note
)
SELECT
  o.id,
  o.name,
  COALESCE(o.confidence, 'medium'),
  CASE
    WHEN url LIKE '%rhkyc.org.hk%' OR url LIKE '%yachtclubsanremo.it%' THEN 'club-site'
    ELSE 'official-results'
  END,
  ARRAY['club-name']::text[],
  url,
  o.source_summary
FROM public.organizations o
CROSS JOIN LATERAL unnest(o.source_urls) AS url
WHERE o.source = 'dragon_worlds_clubspot'
  AND url IS NOT NULL
  AND trim(url) <> ''
ON CONFLICT DO NOTHING;

COMMENT ON COLUMN public.organizations.status IS 'For DragonWorlds yacht clubs: placeholder until claimed, active after BetterAt approval.';
COMMENT ON COLUMN public.organizations.official IS 'False for imported ClubSpot placeholders; true only after claim approval or first-party setup.';
COMMENT ON COLUMN public.organizations.claim_status IS 'Yacht-club claim workflow state: unclaimed, claim_pending, claimed, rejected.';
COMMENT ON COLUMN public.organizations.pricing_tier IS 'Separate yacht-club pricing tier. DragonWorlds placeholders default to club_free.';
COMMENT ON TABLE public.organization_claims IS 'Claims submitted by representatives for placeholder BetterAt organizations.';

COMMIT;
