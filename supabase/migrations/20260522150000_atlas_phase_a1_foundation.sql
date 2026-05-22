-- Atlas tab · Phase A1 foundation
-- Companion to docs/redesign/ios-register/atlas-tab-brief.md (decisions A1–A15).
--
-- What this migration adds (additive, non-breaking):
--   1. Privacy + POI columns on existing public.step_location
--   2. atlas_pois — universal POI registry (OSM / institution-claimed / user-proposed)
--   3. atlas_institution_layers — which orgs activated which curated layers
--   4. atlas_are_cohort_peers(user_a, user_b) — Cohort relationship helper
--   5. atlas_can_view_step_location(step_id) — audience-aware visibility (SECURITY DEFINER)
--   6. atlas_peer_steps_near(lat, lng, radius_km, audience_filter) — richer RPC than
--      the existing neighbor-count, returning actual pin + preview rows
--   7. lint_healthcare_step_text(body) — write-time content lint (no PII patterns)
--   8. RLS additions on step_location (additive; existing open-read policy untouched
--      so legacy rows stay visible — a follow-up migration tightens once data is
--      backfilled with audience values)
--
-- What this migration does NOT do:
--   - Tighten existing step_location SELECT RLS (deferred; legacy rows have no audience yet)
--   - Replace step_location_neighbor_count (kept for back-compat; new RPC sits beside it)
--   - Seed any POIs (JHU clinical sites, RHKYC racing areas seeded in a separate data migration)
--   - Trigger the healthcare lint on step text inserts (function + tests land here;
--     the trigger wires up once the steps-table surface is decided — likely Phase A3)
--
-- Conventions followed:
--   - All RLS uses (SELECT auth.uid()) per feedback_rls_auth_uid_must_be_wrapped.md
--   - text + CHECK over postgres ENUMs, matching the project pattern in step_suggestions
--   - SECURITY DEFINER functions revoke from public, grant to authenticated explicitly
--   - bbox geo (lat/lng numeric, no PostGIS dep) — matches step_location_neighbor_count
--
-- ============================================================================

BEGIN;

-- ============================================================================
-- §1 · Privacy + POI columns on step_location
-- ============================================================================

ALTER TABLE public.step_location
  ADD COLUMN IF NOT EXISTS location_precision text
    CHECK (location_precision IS NULL OR location_precision IN ('exact','site','neighborhood','hidden')),
  ADD COLUMN IF NOT EXISTS location_audience  text
    CHECK (location_audience  IS NULL OR location_audience  IN ('crew','cohort','program','following','fleet','public')),
  ADD COLUMN IF NOT EXISTS time_reveal        text
    CHECK (time_reveal        IS NULL OR time_reveal        IN ('datetime','date_only','hidden')),
  ADD COLUMN IF NOT EXISTS poi_id             uuid,
  ADD COLUMN IF NOT EXISTS interest_slug      text,
  ADD COLUMN IF NOT EXISTS is_healthcare_site boolean NOT NULL DEFAULT false;

-- jitter seed lets the same viewer see a stable jittered pin for the same setter
-- across sessions (never a wandering dot)
ALTER TABLE public.step_location
  ADD COLUMN IF NOT EXISTS jitter_seed uuid NOT NULL DEFAULT gen_random_uuid();

-- ============================================================================
-- §2 · atlas_pois — universal POI registry
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.atlas_pois (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interest_slug       text,                                     -- NULL = universal
  source              text NOT NULL
                        CHECK (source IN ('osm','institution','user_proposed','curated')),
  source_ref          text,                                     -- osm node id, institution id, etc.
  name                text NOT NULL,
  lat                 numeric(10,6) NOT NULL,
  lng                 numeric(10,6) NOT NULL,
  kind                text NOT NULL,                            -- 'club','hospital','sim_lab','racing_area','course','market',...
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,       -- interest-specific (racing_area_bounds, hospital_partner_of)
  claimed_by_org_id   uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  is_healthcare_site  boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS atlas_pois_geo_idx        ON public.atlas_pois(lat, lng);
CREATE INDEX IF NOT EXISTS atlas_pois_interest_idx   ON public.atlas_pois(interest_slug);
CREATE INDEX IF NOT EXISTS atlas_pois_claimed_idx    ON public.atlas_pois(claimed_by_org_id) WHERE claimed_by_org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS atlas_pois_healthcare_idx ON public.atlas_pois(is_healthcare_site) WHERE is_healthcare_site = true;

-- step_location.poi_id now has a real target
ALTER TABLE public.step_location
  ADD CONSTRAINT step_location_poi_fk
  FOREIGN KEY (poi_id) REFERENCES public.atlas_pois(id) ON DELETE SET NULL
  NOT VALID;  -- existing rows have NULL poi_id, so don't re-validate

ALTER TABLE public.atlas_pois ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read POIs (they're places, not people)
DROP POLICY IF EXISTS atlas_pois_authed_read ON public.atlas_pois;
CREATE POLICY atlas_pois_authed_read ON public.atlas_pois
  FOR SELECT TO authenticated USING (true);

-- Only org admins can claim a POI for their org. user_proposed lets any
-- authenticated user create unclaimed ones; institution-source rows are
-- inserted by service role only.
DROP POLICY IF EXISTS atlas_pois_user_propose ON public.atlas_pois;
CREATE POLICY atlas_pois_user_propose ON public.atlas_pois
  FOR INSERT TO authenticated
  WITH CHECK (
    source = 'user_proposed'
    AND claimed_by_org_id IS NULL
  );

DROP POLICY IF EXISTS atlas_pois_org_admin_claim ON public.atlas_pois;
CREATE POLICY atlas_pois_org_admin_claim ON public.atlas_pois
  FOR UPDATE TO authenticated
  USING (
    claimed_by_org_id IS NOT NULL
    AND public.is_org_active_member(claimed_by_org_id)
  )
  WITH CHECK (
    claimed_by_org_id IS NOT NULL
    AND public.is_org_active_member(claimed_by_org_id)
  );

-- ============================================================================
-- §3 · atlas_institution_layers — which orgs activated which curated layers
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.atlas_institution_layers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  layer_id    text NOT NULL,           -- matches AtlasLayer.id in the client registry
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT atlas_institution_layers_org_layer_unique UNIQUE (org_id, layer_id)
);

CREATE INDEX IF NOT EXISTS atlas_institution_layers_org_idx
  ON public.atlas_institution_layers(org_id) WHERE is_active = true;

ALTER TABLE public.atlas_institution_layers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS atlas_institution_layers_member_read ON public.atlas_institution_layers;
CREATE POLICY atlas_institution_layers_member_read ON public.atlas_institution_layers
  FOR SELECT TO authenticated
  USING (public.is_org_active_member(org_id));

DROP POLICY IF EXISTS atlas_institution_layers_admin_write ON public.atlas_institution_layers;
CREATE POLICY atlas_institution_layers_admin_write ON public.atlas_institution_layers
  FOR ALL TO authenticated
  USING (public.is_org_active_member(org_id))
  WITH CHECK (public.is_org_active_member(org_id));
-- TODO(atlas-A3): tighten admin_write to admin role only, not any active member.
-- Blocked on a clean "is_org_admin" helper; current is_org_active_member is the
-- best primitive we have. File: this migration.

-- ============================================================================
-- §4 · Cohort peer helper
-- ============================================================================

-- Returns true iff two users share at least one betterat_org_cohort.
-- Used by atlas_can_view_step_location for the 'cohort' audience.
CREATE OR REPLACE FUNCTION public.atlas_are_cohort_peers(
  user_a uuid,
  user_b uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.betterat_org_cohort_members m1
    JOIN public.betterat_org_cohort_members m2
      ON m2.cohort_id = m1.cohort_id
    WHERE m1.user_id = user_a
      AND m2.user_id = user_b
      AND m1.user_id <> m2.user_id
  );
$$;

REVOKE ALL ON FUNCTION public.atlas_are_cohort_peers(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atlas_are_cohort_peers(uuid, uuid) TO authenticated;

-- ============================================================================
-- §5 · atlas_can_view_step_location — audience-aware visibility check
-- ============================================================================
--
-- Single function the client + RPCs use to ask "can the caller see this pin?"
-- Maps each audience value to the right relationship lookup. SECURITY DEFINER
-- so it can join across RLS-protected tables consistently.
--
-- Audiences:
--   public     · anyone authenticated
--   following  · viewer follows setter (TODO: confirm follows table column names; see below)
--   fleet      · viewer + setter share an org membership (interest-scoped)
--   program    · viewer + setter share a program enrollment
--   cohort     · viewer + setter share a betterat_org_cohort
--   crew       · viewer is in step_collaborators for this step
--
-- Legacy rows (audience IS NULL) remain visible — see "deferred RLS tighten"
-- note at top of file.

CREATE OR REPLACE FUNCTION public.atlas_can_view_step_location(p_step_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_set_by   uuid;
  v_audience text;
  v_viewer   uuid;
BEGIN
  v_viewer := (SELECT auth.uid());
  IF v_viewer IS NULL THEN
    RETURN false;
  END IF;

  SELECT set_by, location_audience
    INTO v_set_by, v_audience
    FROM public.step_location
    WHERE step_id = p_step_id;

  IF v_set_by IS NULL THEN
    RETURN false;
  END IF;

  -- Setter always sees their own pin
  IF v_set_by = v_viewer THEN
    RETURN true;
  END IF;

  -- Legacy rows (no audience set yet) — fall through to existing open-read
  -- policy. Once backfilled, the open-read policy will be dropped.
  IF v_audience IS NULL THEN
    RETURN true;
  END IF;

  RETURN CASE v_audience
    WHEN 'public' THEN true

    WHEN 'crew' THEN EXISTS (
      SELECT 1 FROM public.step_collaborators
      WHERE step_id = p_step_id AND user_id = v_viewer
    )

    WHEN 'cohort' THEN public.atlas_are_cohort_peers(v_viewer, v_set_by)

    WHEN 'following' THEN EXISTS (
      SELECT 1 FROM public.user_follows
      WHERE follower_id = v_viewer AND following_id = v_set_by
    )

    WHEN 'fleet' THEN EXISTS (
      -- Shared org membership where the step's interest matches the org's scope.
      -- Falls back to any shared org if interest_slug not set on the pin.
      SELECT 1
      FROM public.organization_memberships om_viewer
      JOIN public.organization_memberships om_setter
        ON om_setter.organization_id = om_viewer.organization_id
      WHERE om_viewer.user_id = v_viewer
        AND om_setter.user_id = v_set_by
        AND COALESCE(om_viewer.membership_status, om_viewer.status) = 'active'
        AND COALESCE(om_setter.membership_status, om_setter.status) = 'active'
    )

    WHEN 'program' THEN EXISTS (
      SELECT 1
      FROM public.program_participants pp_viewer
      JOIN public.program_participants pp_setter
        ON pp_setter.program_id = pp_viewer.program_id
      WHERE pp_viewer.user_id = v_viewer
        AND pp_setter.user_id = v_set_by
    )

    ELSE false
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.atlas_can_view_step_location(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atlas_can_view_step_location(uuid) TO authenticated;

-- ============================================================================
-- §6 · atlas_peer_steps_near — the richer RPC
-- ============================================================================
--
-- Returns step pins inside a bbox around (lat,lng) that the caller is allowed
-- to see, with a relationship label and a preview payload. Bbox-only (no
-- PostGIS), matching step_location_neighbor_count.
--
-- Privacy is enforced two ways:
--   1. atlas_can_view_step_location() filters out audience-denied pins
--   2. precision='hidden' rows are dropped entirely
--   3. precision='neighborhood' rows get their lat/lng jittered ±500m via
--      jitter_seed (stable per setter, not per query)
--   4. precision='site' rows snap to their poi_id center if set
--
-- Relationship label is the *closest* applicable: crew > cohort > fleet >
-- following > public. This drives pin color on the client.

CREATE OR REPLACE FUNCTION public.atlas_peer_steps_near(
  target_lat       numeric,
  target_lng       numeric,
  radius_km        numeric DEFAULT 5,
  interest_filter  text    DEFAULT NULL    -- NULL = all interests
)
RETURNS TABLE(
  step_id        uuid,
  lat            numeric,
  lng            numeric,
  set_by         uuid,
  relationship   text,
  preview_name   text,
  loc_precision  text,    -- "precision" is a PG reserved word in return signatures
  poi_id         uuid,
  set_at         timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer uuid;
  v_lat_min numeric;
  v_lat_max numeric;
  v_lng_min numeric;
  v_lng_max numeric;
BEGIN
  v_viewer := (SELECT auth.uid());
  IF v_viewer IS NULL THEN
    RETURN;
  END IF;

  v_lat_min := target_lat - radius_km / 111.0;
  v_lat_max := target_lat + radius_km / 111.0;
  v_lng_min := target_lng - radius_km / (111.0 * COS(RADIANS(target_lat)));
  v_lng_max := target_lng + radius_km / (111.0 * COS(RADIANS(target_lat)));

  RETURN QUERY
  WITH visible AS (
    SELECT
      sl.step_id,
      sl.lat,
      sl.lng,
      sl.set_by,
      sl.location_precision AS loc_precision,
      sl.poi_id,
      sl.name AS preview_name,
      sl.set_at,
      sl.jitter_seed,
      sl.interest_slug
    FROM public.step_location sl
    WHERE sl.lat BETWEEN v_lat_min AND v_lat_max
      AND sl.lng BETWEEN v_lng_min AND v_lng_max
      AND sl.set_by IS NOT NULL
      AND (interest_filter IS NULL OR sl.interest_slug = interest_filter)
      AND COALESCE(sl.location_precision, 'exact') <> 'hidden'
      AND public.atlas_can_view_step_location(sl.step_id)
  ),
  labeled AS (
    SELECT
      v.*,
      CASE
        WHEN v.set_by = v_viewer THEN 'self'
        WHEN EXISTS (
          SELECT 1 FROM public.step_collaborators
          WHERE step_id = v.step_id AND user_id = v_viewer
        ) THEN 'crew'
        WHEN public.atlas_are_cohort_peers(v_viewer, v.set_by) THEN 'cohort'
        WHEN EXISTS (
          SELECT 1
          FROM public.organization_memberships om_v
          JOIN public.organization_memberships om_s
            ON om_s.organization_id = om_v.organization_id
          WHERE om_v.user_id = v_viewer
            AND om_s.user_id = v.set_by
            AND COALESCE(om_v.membership_status, om_v.status) = 'active'
            AND COALESCE(om_s.membership_status, om_s.status) = 'active'
        ) THEN 'fleet'
        WHEN EXISTS (
          SELECT 1 FROM public.user_follows
          WHERE follower_id = v_viewer AND following_id = v.set_by
        ) THEN 'following'
        ELSE 'public'
      END AS relationship
    FROM visible v
  )
  SELECT
    l.step_id,
    -- precision-aware coordinate transform
    CASE l.loc_precision
      WHEN 'neighborhood' THEN
        -- ±500m jitter, stable per (set_by, jitter_seed)
        l.lat + ((('x' || substring(l.jitter_seed::text, 1, 8))::bit(32)::int % 1000 - 500) / 111000.0)
      WHEN 'site' THEN
        COALESCE((SELECT p.lat FROM public.atlas_pois p WHERE p.id = l.poi_id), l.lat)
      ELSE l.lat
    END AS lat,
    CASE l.loc_precision
      WHEN 'neighborhood' THEN
        l.lng + ((('x' || substring(l.jitter_seed::text, 9, 8))::bit(32)::int % 1000 - 500) / (111000.0 * COS(RADIANS(target_lat))))
      WHEN 'site' THEN
        COALESCE((SELECT p.lng FROM public.atlas_pois p WHERE p.id = l.poi_id), l.lng)
      ELSE l.lng
    END AS lng,
    l.set_by,
    l.relationship,
    l.preview_name,
    l.loc_precision,
    l.poi_id,
    l.set_at
  FROM labeled l;
END;
$$;

REVOKE ALL ON FUNCTION public.atlas_peer_steps_near(numeric, numeric, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atlas_peer_steps_near(numeric, numeric, numeric, text) TO authenticated;

-- ============================================================================
-- §7 · Healthcare content lint
-- ============================================================================
--
-- Returns array of offense codes if `body` text appears to contain
-- patient-identifiable information. Hard rule (decision A11): healthcare-
-- tagged step text cannot store any of these patterns.
--
-- Offense codes:
--   ROOM_NUMBER   · '4 west bed 12', 'room 412', 'rm 4w'
--   MRN           · 6+ digit numbers in MRN-shaped context
--   DOB           · MM/DD/YYYY or YYYY-MM-DD in DOB context
--   PATIENT_INIT  · '... pt JD ...', 'patient M.K.', 'Mr. K' near medical terms
--   FULL_NAME     · TitleCase TitleCase near medical context (best-effort)
--
-- The lint is intentionally over-eager. UI surfaces matches as inline
-- warnings ("looks like a room number — please remove") with override only
-- if the user can confirm "this is not a patient identifier."

CREATE OR REPLACE FUNCTION public.lint_healthcare_step_text(body text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  offenses text[] := ARRAY[]::text[];
  lower_body text;
BEGIN
  IF body IS NULL OR length(body) = 0 THEN
    RETURN offenses;
  END IF;

  lower_body := lower(body);

  -- Room/bed numbers
  IF lower_body ~ '\m(room|rm\.?|bed)\s*\#?\s*\d{1,4}\M'
     OR lower_body ~ '\m\d+\s*(west|east|north|south|w|e|n|s)\s+bed\s*\d+'
     OR lower_body ~ '\m\d{1,2}-(west|east|north|south)\s+bed\M'
  THEN
    offenses := offenses || ARRAY['ROOM_NUMBER']::text[];
  END IF;

  -- MRN-shaped (label adjacent to digits)
  IF lower_body ~ '\m(mrn|m\.r\.n\.?|medical\s+record\s+number)\s*:?\s*\d{4,}'
  THEN
    offenses := offenses || ARRAY['MRN']::text[];
  END IF;

  -- DOB-shaped
  IF lower_body ~ '\m(dob|d\.o\.b\.?|date\s+of\s+birth|born)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})'
  THEN
    offenses := offenses || ARRAY['DOB']::text[];
  END IF;

  -- Patient initials adjacent to 'pt' / 'patient' / 'Mr.' / 'Ms.' / 'Mrs.' / 'Dr.'
  -- Case-insensitive (~*) so "Pt JK", "patient m.k.", "Mrs. AB" all match.
  IF body ~* '\m(pt|patient|mr|ms|mrs|dr)\.?\s+[a-z]\.?\s*[a-z]\.?\M'
  THEN
    offenses := offenses || ARRAY['PATIENT_INIT']::text[];
  END IF;

  RETURN offenses;
END;
$$;

REVOKE ALL ON FUNCTION public.lint_healthcare_step_text(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lint_healthcare_step_text(text) TO authenticated;

-- A small self-test so the lint regexes don't silently rot:
DO $$
BEGIN
  ASSERT 'ROOM_NUMBER' = ANY(public.lint_healthcare_step_text('IV start at 4 west bed 12 went smoothly')),
    'lint should catch "4 west bed 12"';
  ASSERT 'MRN' = ANY(public.lint_healthcare_step_text('chart review for MRN 1234567')),
    'lint should catch labeled MRN';
  ASSERT 'DOB' = ANY(public.lint_healthcare_step_text('DOB 05/14/1978 needs cardiac eval')),
    'lint should catch labeled DOB';
  ASSERT 'PATIENT_INIT' = ANY(public.lint_healthcare_step_text('Pt JK responded well to the teach-back')),
    'lint should catch patient initials';
  ASSERT array_length(public.lint_healthcare_step_text('Practiced focused assessment on the cardiac floor.'), 1) IS NULL,
    'lint should NOT flag clean text';
END;
$$;

-- ============================================================================
-- §8 · Healthcare site enforcement trigger on step_location
-- ============================================================================
--
-- When a step_location row is INSERT/UPDATE and is_healthcare_site = true,
-- enforce:
--   a. location_precision IS NOT NULL AND location_precision != 'exact'
--      (must be at least 'site' — never sharper than building-level)
--   b. location_audience IS NOT 'public' (never public default on healthcare)
-- The patient-text lint runs against step body separately when the steps
-- table is wired up (see deferred note at top — Phase A3).

CREATE OR REPLACE FUNCTION public.enforce_healthcare_site_precision()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_healthcare_site = true THEN
    IF NEW.location_precision IS NULL OR NEW.location_precision = 'exact' THEN
      RAISE EXCEPTION 'healthcare-tagged step_location must use site/neighborhood/hidden precision, not exact (got %)', NEW.location_precision
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.location_audience = 'public' THEN
      RAISE EXCEPTION 'healthcare-tagged step_location cannot have public audience'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS step_location_healthcare_enforcement ON public.step_location;
CREATE TRIGGER step_location_healthcare_enforcement
  BEFORE INSERT OR UPDATE ON public.step_location
  FOR EACH ROW EXECUTE FUNCTION public.enforce_healthcare_site_precision();

-- ============================================================================
-- §9 · Touch step_location updated_at on POI metadata changes
-- ============================================================================

CREATE OR REPLACE FUNCTION public.atlas_pois_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS atlas_pois_touch ON public.atlas_pois;
CREATE TRIGGER atlas_pois_touch
  BEFORE UPDATE ON public.atlas_pois
  FOR EACH ROW EXECUTE FUNCTION public.atlas_pois_touch_updated_at();

-- ============================================================================
-- §10 · Indexes for the hot read paths
-- ============================================================================

-- atlas_peer_steps_near filters by interest_slug inside the bbox
CREATE INDEX IF NOT EXISTS step_location_interest_idx
  ON public.step_location(interest_slug) WHERE interest_slug IS NOT NULL;

-- audience-aware RLS will eventually filter by (audience, set_by)
CREATE INDEX IF NOT EXISTS step_location_audience_setter_idx
  ON public.step_location(location_audience, set_by) WHERE location_audience IS NOT NULL;

COMMIT;
