-- Multi-audience demo backend hardening.
--
-- Locks the reviewed access boundaries for portfolio demos, competency
-- evidence writes, cohort-scoped insights, demo session audit, and HKDW
-- redeem-token dates.

BEGIN;

-- ---------------------------------------------------------------------------
-- Portfolio privacy
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS portfolio_public_opt_in boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.portfolio_public_opt_in IS
  'Explicit opt-in for full cross-interest portfolio visibility. profile_public alone is not enough.';

CREATE INDEX IF NOT EXISTS idx_profiles_portfolio_public_opt_in
  ON public.profiles(profile_public, portfolio_public_opt_in)
  WHERE profile_public = true AND portfolio_public_opt_in = true;

-- Demo personas opt in to public profile + full portfolio. Rows may not exist
-- in every environment yet; this is intentionally best-effort.
UPDATE public.profiles
SET profile_public = true,
    portfolio_public_opt_in = true
WHERE lower(email) IN (
  'demo-savitri@betterat.app',
  'nursing-peer-1@demo.regattaflow.io',
  'patricia.morrison@jhu-faculty-demo.edu',
  'demo-markus@regattaflow.app',
  'demo-yvonne@regattaflow.app',
  'sarah.szanton@jhu-dean-demo.edu',
  'pradan.field@betterat.app'
);

-- ---------------------------------------------------------------------------
-- Shared org role helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.has_org_role_in(
  p_org_id uuid,
  p_user_id uuid,
  p_roles text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = p_org_id
      AND om.user_id = p_user_id
      AND COALESCE(om.membership_status, om.status) = 'active'
      AND om.role = ANY (p_roles)
  ), false);
$$;

REVOKE ALL ON FUNCTION public.has_org_role_in(uuid, uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_org_role_in(uuid, uuid, text[]) TO authenticated;

COMMENT ON FUNCTION public.has_org_role_in(uuid, uuid, text[]) IS
  'SECURITY DEFINER org role check with explicit user id and role allowlist.';

-- ---------------------------------------------------------------------------
-- Competency evidence metadata + faculty/preceptor write RPC
-- ---------------------------------------------------------------------------

ALTER TABLE public.step_capability_evidence
  ADD COLUMN IF NOT EXISTS confirmed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_notes text;

CREATE INDEX IF NOT EXISTS idx_step_capability_evidence_confirmed_by
  ON public.step_capability_evidence(confirmed_by_user_id)
  WHERE confirmed_by_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_competency_evidence(
  p_step_id uuid,
  p_org_competency_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_step_user_id uuid;
  v_org_id uuid;
  v_short_label text;
  v_full_label text;
  v_evidence_id uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Sign in to record competency evidence'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT ts.user_id
    INTO v_step_user_id
  FROM public.timeline_steps ts
  WHERE ts.id = p_step_id;

  IF v_step_user_id IS NULL THEN
    RAISE EXCEPTION 'Step not found'
      USING ERRCODE = 'no_data_found';
  END IF;

  SELECT oc.org_id, oc.short_label, oc.full_label
    INTO v_org_id, v_short_label, v_full_label
  FROM public.org_competencies oc
  WHERE oc.id = p_org_competency_id
    AND oc.is_active = true;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Org competency not found'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT public.has_org_role_in(
    v_org_id,
    v_caller,
    ARRAY['owner','admin','manager','faculty','instructor','evaluator','preceptor','clinical_instructor']
  ) THEN
    RAISE EXCEPTION 'Not authorized to record competency evidence for this org'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = v_org_id
      AND om.user_id = v_step_user_id
      AND COALESCE(om.membership_status, om.status) = 'active'
  ) THEN
    RAISE EXCEPTION 'Step owner is not an active member of this org'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.step_capability_evidence (
    step_id,
    capability_id,
    capability_name,
    confirmed,
    strength,
    pip_level,
    evidence_count,
    evidence_capture_ids,
    org_competency_id,
    confirmed_by_user_id,
    confirmed_at,
    confirmed_notes
  )
  VALUES (
    p_step_id,
    p_org_competency_id::text,
    COALESCE(NULLIF(v_full_label, ''), NULLIF(v_short_label, ''), p_org_competency_id::text),
    true,
    'material',
    3,
    1,
    '{}'::text[],
    p_org_competency_id,
    v_caller,
    now(),
    NULLIF(trim(COALESCE(p_notes, '')), '')
  )
  ON CONFLICT (step_id, capability_id) DO UPDATE
    SET capability_name = EXCLUDED.capability_name,
        confirmed = true,
        strength = EXCLUDED.strength,
        pip_level = EXCLUDED.pip_level,
        evidence_count = GREATEST(public.step_capability_evidence.evidence_count, 1),
        org_competency_id = EXCLUDED.org_competency_id,
        confirmed_by_user_id = EXCLUDED.confirmed_by_user_id,
        confirmed_at = EXCLUDED.confirmed_at,
        confirmed_notes = EXCLUDED.confirmed_notes,
        updated_at = now()
  RETURNING id INTO v_evidence_id;

  RETURN v_evidence_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_competency_evidence(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_competency_evidence(uuid, uuid, text) TO authenticated;

COMMENT ON FUNCTION public.record_competency_evidence(uuid, uuid, text) IS
  'Faculty/preceptor evidence write path. Validates org role + target membership and populates step_capability_evidence from org_competencies.';

-- ---------------------------------------------------------------------------
-- Cohort-scoped insights heatmap
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.admin_competency_evidence_counts(uuid);

CREATE OR REPLACE FUNCTION public.admin_competency_evidence_counts(
  p_org_id uuid,
  p_cohort_id uuid DEFAULT NULL
)
RETURNS TABLE (
  competency_id uuid,
  poi_id uuid,
  student_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_org_role_in(
    p_org_id,
    auth.uid(),
    ARRAY['owner','admin','manager','faculty','instructor']
  ) THEN
    RAISE EXCEPTION 'Not authorized to view org competency evidence'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_cohort_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.betterat_org_cohorts c
    WHERE c.id = p_cohort_id
      AND c.org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Cohort does not belong to org'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  RETURN QUERY
  SELECT
    sce.org_competency_id AS competency_id,
    sl.poi_id,
    count(DISTINCT ts.user_id)::integer AS student_count
  FROM public.step_capability_evidence sce
  JOIN public.timeline_steps ts ON ts.id = sce.step_id
  JOIN public.step_location sl ON sl.step_id = ts.id
  JOIN public.org_competencies oc ON oc.id = sce.org_competency_id
  WHERE oc.org_id = p_org_id
    AND sce.confirmed = true
    AND sl.poi_id IS NOT NULL
    AND (
      p_cohort_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.betterat_org_cohort_members cm
        WHERE cm.cohort_id = p_cohort_id
          AND cm.user_id = ts.user_id
      )
    )
  GROUP BY sce.org_competency_id, sl.poi_id;
END;
$$;

COMMENT ON FUNCTION public.admin_competency_evidence_counts(uuid, uuid) IS
  'Insights heatmap RPC. Optional p_cohort_id narrows counts to that cohort. SECURITY DEFINER; gated by has_org_role_in.';

GRANT EXECUTE ON FUNCTION public.admin_competency_evidence_counts(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Portfolio RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_member_portfolio_org_scoped(
  target_user_id uuid,
  org_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_org_interest_slug text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Sign in to view member portfolio'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT o.interest_slug
    INTO v_org_interest_slug
  FROM public.organizations o
  WHERE o.id = org_id;

  IF v_org_interest_slug IS NULL THEN
    RAISE EXCEPTION 'Organization not found'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_caller <> target_user_id THEN
    IF NOT public.has_org_role_in(
      org_id,
      v_caller,
      ARRAY['owner','admin','manager','faculty','instructor']
    ) THEN
      RAISE EXCEPTION 'Not authorized to view org-scoped member portfolio'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.organization_memberships om
      WHERE om.organization_id = org_id
        AND om.user_id = target_user_id
        AND COALESCE(om.membership_status, om.status) = 'active'
    ) THEN
      RAISE EXCEPTION 'Target is not an active member of this org'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'scope', 'org',
    'target_user_id', target_user_id,
    'org_id', org_id,
    'profile', (
      SELECT jsonb_build_object(
        'id', p.id,
        'email', p.email,
        'full_name', COALESCE(NULLIF(trim(p.full_name), ''), u.full_name, u.email),
        'avatar_url', COALESCE(p.avatar_url, u.avatar_url),
        'profile_public', COALESCE(p.profile_public, false),
        'portfolio_public_opt_in', COALESCE(p.portfolio_public_opt_in, false)
      )
      FROM public.profiles p
      LEFT JOIN public.users u ON u.id = p.id
      WHERE p.id = target_user_id
    ),
    'organization', (
      SELECT to_jsonb(o)
      FROM (
        SELECT id, name, slug, organization_type, interest_slug
        FROM public.organizations
        WHERE id = org_id
      ) o
    ),
    'cohorts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'role', cm.role,
        'joined_at', cm.created_at
      ) ORDER BY c.name)
      FROM public.betterat_org_cohort_members cm
      JOIN public.betterat_org_cohorts c ON c.id = cm.cohort_id
      WHERE cm.user_id = target_user_id
        AND c.org_id = org_id
    ), '[]'::jsonb),
    'plans', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id,
        'title', p.title,
        'vision_statement', p.vision_statement,
        'status', p.status,
        'started_at', p.started_at,
        'ended_at', p.ended_at,
        'interest_id', p.interest_id,
        'interest_slug', i.slug
      ) ORDER BY p.started_at DESC)
      FROM public.plans p
      LEFT JOIN public.interests i ON i.id = p.interest_id
      LEFT JOIN public.blueprints b ON b.id = p.source_blueprint_id
      WHERE p.user_id = target_user_id
        AND (
          i.slug = v_org_interest_slug
          OR b.org_id = org_id
        )
    ), '[]'::jsonb),
    'recent_activity', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ts.id,
        'title', ts.title,
        'status', ts.status,
        'updated_at', ts.updated_at,
        'interest_id', ts.interest_id,
        'interest_slug', i.slug
      ) ORDER BY ts.updated_at DESC)
      FROM (
        SELECT ts.*
        FROM public.timeline_steps ts
        LEFT JOIN public.interests i ON i.id = ts.interest_id
        WHERE ts.user_id = target_user_id
          AND (
            ts.organization_id = org_id
            OR i.slug = v_org_interest_slug
          )
        ORDER BY ts.updated_at DESC
        LIMIT 20
      ) ts
      LEFT JOIN public.interests i ON i.id = ts.interest_id
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_member_portfolio_full(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_public boolean;
  v_opt_in boolean;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Sign in to view member portfolio'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT COALESCE(p.profile_public, false), COALESCE(p.portfolio_public_opt_in, false)
    INTO v_public, v_opt_in
  FROM public.profiles p
  WHERE p.id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_caller <> target_user_id AND NOT (v_public AND v_opt_in) THEN
    RAISE EXCEPTION 'Full portfolio is not public'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN jsonb_build_object(
    'scope', 'full',
    'target_user_id', target_user_id,
    'profile', (
      SELECT jsonb_build_object(
        'id', p.id,
        'email', p.email,
        'full_name', COALESCE(NULLIF(trim(p.full_name), ''), u.full_name, u.email),
        'avatar_url', COALESCE(p.avatar_url, u.avatar_url),
        'profile_public', COALESCE(p.profile_public, false),
        'portfolio_public_opt_in', COALESCE(p.portfolio_public_opt_in, false)
      )
      FROM public.profiles p
      LEFT JOIN public.users u ON u.id = p.id
      WHERE p.id = target_user_id
    ),
    'interests', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id,
        'slug', i.slug,
        'name', i.name,
        'added_at', ui.added_at
      ) ORDER BY ui.added_at DESC)
      FROM public.user_interests ui
      JOIN public.interests i ON i.id = ui.interest_id
      WHERE ui.user_id = target_user_id
    ), '[]'::jsonb),
    'organizations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', o.id,
        'name', o.name,
        'slug', o.slug,
        'interest_slug', o.interest_slug,
        'role', om.role
      ) ORDER BY o.name)
      FROM public.organization_memberships om
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE om.user_id = target_user_id
        AND COALESCE(om.membership_status, om.status) = 'active'
    ), '[]'::jsonb),
    'plans', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id,
        'title', p.title,
        'vision_statement', p.vision_statement,
        'status', p.status,
        'started_at', p.started_at,
        'ended_at', p.ended_at,
        'interest_id', p.interest_id,
        'interest_slug', i.slug
      ) ORDER BY p.started_at DESC)
      FROM public.plans p
      LEFT JOIN public.interests i ON i.id = p.interest_id
      WHERE p.user_id = target_user_id
    ), '[]'::jsonb),
    'recent_activity', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ts.id,
        'title', ts.title,
        'status', ts.status,
        'updated_at', ts.updated_at,
        'interest_id', ts.interest_id,
        'interest_slug', i.slug
      ) ORDER BY ts.updated_at DESC)
      FROM (
        SELECT *
        FROM public.timeline_steps
        WHERE user_id = target_user_id
        ORDER BY updated_at DESC
        LIMIT 30
      ) ts
      LEFT JOIN public.interests i ON i.id = ts.interest_id
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_member_portfolio_org_scoped(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_member_portfolio_full(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_member_portfolio_org_scoped(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_portfolio_full(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_member_portfolio_org_scoped(uuid, uuid) IS
  'Org-scoped member portfolio read. Self or active org owner/admin/manager/faculty/instructor of target member.';
COMMENT ON FUNCTION public.get_member_portfolio_full(uuid) IS
  'Full cross-interest portfolio read. Self or profile_public=true plus portfolio_public_opt_in=true.';

-- ---------------------------------------------------------------------------
-- Demo session audit
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.demo_session_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_key text NOT NULL,
  persona_email text,
  caller_ip text,
  user_agent text,
  redirect_to text,
  action_token_hash text UNIQUE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  consumed_at timestamptz,
  status text NOT NULL DEFAULT 'minted'
    CHECK (status IN ('minted','consumed','expired','rejected','rate_limited','failed')),
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_demo_session_audit_ip_requested
  ON public.demo_session_audit(caller_ip, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_demo_session_audit_persona_requested
  ON public.demo_session_audit(persona_key, requested_at DESC);

ALTER TABLE public.demo_session_audit ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.demo_session_audit IS
  'Service-role audit trail for demo persona session mints. No client RLS policies; edge function writes and reads via service role.';

-- ---------------------------------------------------------------------------
-- HKDW redeem token date hardening
-- ---------------------------------------------------------------------------

ALTER TABLE public.redeem_tokens
  ALTER COLUMN valid_from DROP DEFAULT,
  ALTER COLUMN valid_to DROP DEFAULT;

COMMENT ON COLUMN public.redeem_tokens.valid_from IS
  'Explicit token validity start. Do not rely on a default; event/demo mints must set this deliberately.';

COMMENT ON COLUMN public.redeem_tokens.valid_to IS
  'Explicit token validity end. The old 180-day default was removed so Worlds 2027 / November 2026 windows are set deliberately.';

-- Correct the event-name/calendar-year split where older seed data encoded
-- "2027" as the calendar year. Worlds 2027 is the event name; the Hong Kong
-- event window is November 2026.
UPDATE public.communities
SET description = 'Official community for the Dragon Worlds 2027 event in Hong Kong (November 21-29, 2026). Race discussions, local knowledge, and event updates.',
    metadata = COALESCE(metadata, '{}'::jsonb)
      || jsonb_build_object(
        'event_name', 'Dragon Worlds 2027',
        'calendar_year', 2026,
        'event_year', 2027,
        'dates', 'Nov 21-29, 2026'
      )
WHERE slug = '2027-hk-dragon-worlds';

COMMIT;
