-- Org Admin Calendar — universal-model surface for an org's scheduled events.
--
-- Implements decisions D30–D32 (docs/redesign/specs/ORG_ADMIN_CALENDAR_RACE_MODEL_SPEC.md):
--   * A race is a Step with is_race = true — not a separate type (D30/D31).
--   * The org calendar = the org's scheduled timeline_steps (organization_id),
--     race ones badged via is_race. One surface, one boolean (D31).
--   * Race detail lives in a JOIN, not new columns on the universal table:
--     timeline_steps.regatta_race_id → regatta_races bridges a race step to the
--     existing scoring backend (D32).
--
-- Admins can't read other members' rows under timeline_steps RLS, so the
-- calendar reads through a SECURITY DEFINER RPC gated by is_org_admin_member,
-- consistent with the other admin-aggregation RPCs.
--
-- Apply to dev project qavekrwdbsobecwrfxwu.

-- =============================================================================
-- D32 — bridge a race step to its scoring row (nullable; non-race steps leave it null)
-- =============================================================================

ALTER TABLE public.timeline_steps
  ADD COLUMN IF NOT EXISTS regatta_race_id UUID
    REFERENCES public.regatta_races(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.timeline_steps.regatta_race_id IS
  'D32 — when is_race = true, links the universal step to its sailing scoring row in regatta_races. Null for non-race steps and for races without a scoring row yet.';

CREATE INDEX IF NOT EXISTS idx_timeline_steps_regatta_race_id
  ON public.timeline_steps(regatta_race_id) WHERE regatta_race_id IS NOT NULL;

-- =============================================================================
-- admin_org_calendar — the org's scheduled steps, for the admin Calendar surface
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_org_calendar(p_org_id uuid)
RETURNS TABLE (
  step_id uuid,
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text,
  is_race boolean,
  category text,
  place_name text,
  regatta_race_id uuid,
  owner_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_admin_member(p_org_id) THEN
    RAISE EXCEPTION 'Not authorized to view this org calendar'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    ts.id              AS step_id,
    ts.title           AS title,
    ts.starts_at       AS starts_at,
    ts.ends_at         AS ends_at,
    ts.status          AS status,
    ts.is_race         AS is_race,
    ts.category        AS category,
    sl.name            AS place_name,
    ts.regatta_race_id AS regatta_race_id,
    COALESCE(NULLIF(p.full_name, ''), NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), '') AS owner_name
  FROM public.timeline_steps ts
  LEFT JOIN public.step_location sl ON sl.step_id = ts.id
  LEFT JOIN public.profiles p ON p.id = ts.user_id
  WHERE ts.organization_id = p_org_id
  ORDER BY ts.starts_at ASC NULLS LAST, ts.created_at ASC;
END;
$$;

COMMENT ON FUNCTION public.admin_org_calendar(uuid) IS
  'Org Admin Calendar RPC. Returns the org''s scheduled timeline_steps (race ones flagged is_race). SECURITY DEFINER; gated by is_org_admin_member.';

REVOKE ALL ON FUNCTION public.admin_org_calendar(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_org_calendar(uuid) TO authenticated;

-- =============================================================================
-- Demo data — give the seeded RHKYC org events dates + race flags so the
-- Calendar renders something real. Idempotent: scoped to the org + title and
-- safe to re-run. Mirrors seed:rhkyc demo-data conventions.
-- =============================================================================

DO $$
DECLARE
  v_org uuid := 'a1000001-0000-0000-0000-000000000001'; -- Royal Hong Kong Yacht Club
BEGIN
  UPDATE public.timeline_steps
    SET starts_at = date_trunc('day', now()) + interval '3 days' + interval '9 hours',
        ends_at   = date_trunc('day', now()) + interval '3 days' + interval '13 hours',
        is_race   = true
  WHERE organization_id = v_org
    AND title = 'Dragon Saturday Series — Race Briefing';

  UPDATE public.timeline_steps
    SET starts_at = date_trunc('day', now()) + interval '10 days' + interval '10 hours',
        ends_at   = date_trunc('day', now()) + interval '10 days' + interval '12 hours',
        is_race   = false
  WHERE organization_id = v_org
    AND title = 'Learn to Sail — Dinghy Intro';

  UPDATE public.timeline_steps
    SET starts_at = date_trunc('day', now()) + interval '17 days' + interval '14 hours',
        ends_at   = date_trunc('day', now()) + interval '17 days' + interval '17 hours',
        is_race   = true
  WHERE organization_id = v_org
    AND title = 'Youth Academy — Race Coaching';
END $$;

NOTIFY pgrst, 'reload schema';
