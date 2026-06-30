-- Org Admin · Site edit & claim — the write half of the Sites surface.
--
-- Today an org admin can SEE their claimed atlas_pois (useAdminOrgSites) but has
-- no way to MODIFY them: atlas_pois RLS only lets a user update rows they
-- proposed themselves (source = 'user_proposed' AND created_by = auth.uid()).
-- Org-curated sites are shared rows the member doesn't own, so every write goes
-- through a SECURITY DEFINER RPC gated by is_org_admin_member — the same gate
-- admin_org_calendar / admin_site_activity already use.
--
-- Sites are load-bearing in two places, which is why editing is gated and the
-- coordinate edit is guard-railed client-side: atlas_pois rows render as Atlas
-- pins, and a step is located at a site via step_location.poi_id, so a wrong
-- coordinate or name propagates to every located step.
--
-- Healthcare precision rule (preserved): when is_healthcare_site = true the
-- coordinates are snapped to site-level granularity (3 decimal places, ~110m)
-- server-side so an exact clinical-site coordinate can never be stored.
--
-- Apply to dev project qavekrwdbsobecwrfxwu.

-- ---------------------------------------------------------------------------
-- Round to site-level precision for healthcare sites.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._site_coord_precision(
  p_value numeric,
  p_is_healthcare boolean
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN p_is_healthcare THEN round(p_value, 3) ELSE p_value END;
$$;

-- ---------------------------------------------------------------------------
-- Edit an existing claimed site. Whitelists editable columns; merges curated
-- metadata keys rather than replacing the whole blob.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_site(
  p_org_id uuid,
  p_poi_id uuid,
  p_patch  jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_healthcare boolean;
  v_new_name   text;
  v_new_kind   text;
  v_meta_patch jsonb;
BEGIN
  IF NOT public.is_org_admin_member(p_org_id) THEN
    RAISE EXCEPTION 'Not authorized to edit sites for this org'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Only a site this org actually owns may be mutated.
  SELECT is_healthcare_site INTO v_healthcare
  FROM public.atlas_pois
  WHERE id = p_poi_id AND claimed_by_org_id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Site not found or not claimed by this org'
      USING ERRCODE = 'no_data_found';
  END IF;

  -- The healthcare flag itself may change in this patch; the precision rule
  -- follows the incoming value when present, else the existing one.
  IF p_patch ? 'is_healthcare_site' THEN
    v_healthcare := (p_patch ->> 'is_healthcare_site')::boolean;
  END IF;

  IF p_patch ? 'name' THEN
    v_new_name := NULLIF(btrim(p_patch ->> 'name'), '');
    IF v_new_name IS NULL THEN
      RAISE EXCEPTION 'Site name cannot be empty' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF p_patch ? 'kind' THEN
    v_new_kind := NULLIF(btrim(p_patch ->> 'kind'), '');
  END IF;

  -- Curated metadata keys actually surfaced today.
  v_meta_patch := jsonb_strip_nulls(jsonb_build_object(
    'city',          p_patch ->> 'city',
    'role',          p_patch ->> 'role',
    'partner_role',  p_patch ->> 'partner_role',
    'curated_label', p_patch ->> 'curated_label'
  ));

  UPDATE public.atlas_pois SET
    name               = COALESCE(v_new_name, name),
    kind               = COALESCE(v_new_kind, kind),
    is_healthcare_site = CASE WHEN p_patch ? 'is_healthcare_site'
                              THEN v_healthcare ELSE is_healthcare_site END,
    lat = CASE WHEN p_patch ? 'lat'
               THEN public._site_coord_precision((p_patch ->> 'lat')::numeric, v_healthcare)
               ELSE lat END,
    lng = CASE WHEN p_patch ? 'lng'
               THEN public._site_coord_precision((p_patch ->> 'lng')::numeric, v_healthcare)
               ELSE lng END,
    metadata = COALESCE(metadata, '{}'::jsonb) || v_meta_patch
  WHERE id = p_poi_id AND claimed_by_org_id = p_org_id;

  RETURN p_poi_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Claim an existing unclaimed POI for the org (non-destructive).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_claim_site(
  p_org_id uuid,
  p_poi_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_admin_member(p_org_id) THEN
    RAISE EXCEPTION 'Not authorized to claim sites for this org'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.atlas_pois
  SET claimed_by_org_id = p_org_id
  WHERE id = p_poi_id AND claimed_by_org_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Site not found or already claimed'
      USING ERRCODE = 'no_data_found';
  END IF;

  RETURN p_poi_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Release a claim the org holds (mirror of claim).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_unclaim_site(
  p_org_id uuid,
  p_poi_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_admin_member(p_org_id) THEN
    RAISE EXCEPTION 'Not authorized to unclaim sites for this org'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.atlas_pois
  SET claimed_by_org_id = NULL
  WHERE id = p_poi_id AND claimed_by_org_id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Site not found or not claimed by this org'
      USING ERRCODE = 'no_data_found';
  END IF;

  RETURN p_poi_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Create a brand-new POI owned by the org (claim-by-create).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_create_site(
  p_org_id        uuid,
  p_name          text,
  p_kind          text,
  p_lat           numeric,
  p_lng           numeric,
  p_is_healthcare boolean DEFAULT false,
  p_metadata      jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := NULLIF(btrim(p_name), '');
  v_kind text := COALESCE(NULLIF(btrim(p_kind), ''), 'place');
  v_poi  uuid;
BEGIN
  IF NOT public.is_org_admin_member(p_org_id) THEN
    RAISE EXCEPTION 'Not authorized to create sites for this org'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Site name is required' USING ERRCODE = 'check_violation';
  END IF;
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RAISE EXCEPTION 'Drop a pin to set the coordinates' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.atlas_pois
    (name, kind, lat, lng, source, is_healthcare_site, claimed_by_org_id,
     created_by, metadata, is_active)
  VALUES
    (v_name, v_kind,
     public._site_coord_precision(p_lat, COALESCE(p_is_healthcare, false)),
     public._site_coord_precision(p_lng, COALESCE(p_is_healthcare, false)),
     'org_admin', COALESCE(p_is_healthcare, false), p_org_id,
     (SELECT auth.uid()), COALESCE(p_metadata, '{}'::jsonb), true)
  RETURNING id INTO v_poi;

  RETURN v_poi;
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants — authenticated only; the gate is inside each function.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.admin_update_site(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_site(uuid, uuid, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_claim_site(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_claim_site(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_unclaim_site(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_unclaim_site(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_create_site(uuid, text, text, numeric, numeric, boolean, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_site(uuid, text, text, numeric, numeric, boolean, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
