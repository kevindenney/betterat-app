-- Commit 2 of ATLAS_RACE_SOURCE_OF_TRUTH_SPEC — Option A series link.
--
-- Series-on-map needs the race step to reach a series. Per the spec's Option A,
-- add season_id directly to the race step and reuse the existing `seasons`
-- table (Phase I infra) rather than forking a generalized `series` schema.
-- Race steps sharing (course_id | area_id, season_id) are "N races in {Season}".
--
-- Additive + nullable, ON DELETE SET NULL: deleting a season detaches its race
-- steps without removing them. RLS is unaffected — same row owner.

ALTER TABLE timeline_steps
  ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES seasons(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_timeline_steps_season_id
  ON timeline_steps(season_id);

-- The create_timeline_step RPC has an explicit INSERT column list, so it
-- silently drops any season_id passed in p_input (same gotcha that dropped
-- is_race before 20260603180000). Re-create it with season_id wired through so
-- the race composer can stamp the active season.

CREATE OR REPLACE FUNCTION create_timeline_step(p_input JSONB)
RETURNS SETOF timeline_steps
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id UUID := (p_input->>'user_id')::UUID;
  v_interest_id UUID := (p_input->>'interest_id')::UUID;
  v_visibility TEXT;
  v_sort_order INTEGER;
  v_starts_at TIMESTAMPTZ;
BEGIN
  -- Visibility: explicit value wins; otherwise run the cascade
  IF p_input ? 'visibility' AND p_input->>'visibility' IS NOT NULL THEN
    v_visibility := p_input->>'visibility';
  ELSE
    SELECT COALESCE(
      (
        SELECT up.interest_visibility_defaults ->> (v_interest_id::TEXT)
          FROM user_preferences up
         WHERE up.user_id = v_user_id
         LIMIT 1
      ),
      (
        SELECT p.default_step_visibility
          FROM profiles p
         WHERE p.id = v_user_id
         LIMIT 1
      ),
      'followers'
    ) INTO v_visibility;
  END IF;

  -- sort_order: explicit value wins; otherwise epoch-delta seconds
  IF p_input ? 'sort_order' AND p_input->>'sort_order' IS NOT NULL THEN
    v_sort_order := (p_input->>'sort_order')::INTEGER;
  ELSE
    v_sort_order := (
      EXTRACT(EPOCH FROM NOW())
      - EXTRACT(EPOCH FROM TIMESTAMPTZ '2024-01-01 00:00:00+00')
    )::INTEGER;
  END IF;

  -- starts_at: caller may pass explicit null to mean "unscheduled"; only
  -- default to NOW() when the key is absent entirely.
  IF p_input ? 'starts_at' THEN
    v_starts_at := NULLIF(p_input->>'starts_at', '')::TIMESTAMPTZ;
  ELSE
    v_starts_at := NOW();
  END IF;

  RETURN QUERY
  INSERT INTO timeline_steps (
    user_id,
    interest_id,
    organization_id,
    program_session_id,
    source_type,
    source_id,
    title,
    description,
    category,
    status,
    starts_at,
    ends_at,
    location_name,
    location_lat,
    location_lng,
    location_place_id,
    visibility,
    share_approximate_location,
    sort_order,
    is_race,
    season_id,
    metadata
  ) VALUES (
    v_user_id,
    v_interest_id,
    NULLIF(p_input->>'organization_id', '')::UUID,
    NULLIF(p_input->>'program_session_id', '')::UUID,
    COALESCE(p_input->>'source_type', 'manual'),
    NULLIF(p_input->>'source_id', '')::UUID,
    p_input->>'title',
    p_input->>'description',
    COALESCE(p_input->>'category', 'general'),
    COALESCE(p_input->>'status', 'pending'),
    v_starts_at,
    NULLIF(p_input->>'ends_at', '')::TIMESTAMPTZ,
    p_input->>'location_name',
    NULLIF(p_input->>'location_lat', '')::DOUBLE PRECISION,
    NULLIF(p_input->>'location_lng', '')::DOUBLE PRECISION,
    p_input->>'location_place_id',
    v_visibility,
    COALESCE((p_input->>'share_approximate_location')::BOOLEAN, FALSE),
    v_sort_order,
    COALESCE((p_input->>'is_race')::BOOLEAN, FALSE),
    NULLIF(p_input->>'season_id', '')::UUID,
    COALESCE(p_input->'metadata', '{}'::jsonb)
  )
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION create_timeline_step(JSONB) TO authenticated;
