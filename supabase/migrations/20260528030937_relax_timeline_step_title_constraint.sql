-- =====================================================
-- Allow empty/null titles on timeline_steps + create_timeline_step
-- =====================================================
--
-- Context: the Atlas long-press → "Plan a step here" flow creates
-- a draft step, then navigates the user to /step/[id] with the
-- expectation that they immediately type a title. The previous
-- constraint (20260418130000) forced the caller to ship a
-- placeholder ("Sailing step" / "Untitled"), and the auto-save
-- debounce hit a 23514 check-violation as soon as the user cleared
-- it to retype. Drop the non-empty CHECK and remove the empty-
-- title guard from create_timeline_step; downstream renderers
-- already use `step.title || 'Untitled step'` fallbacks.
-- =====================================================

ALTER TABLE timeline_steps
  DROP CONSTRAINT IF EXISTS timeline_steps_title_non_empty;

ALTER TABLE timeline_steps
  ALTER COLUMN title DROP NOT NULL;

CREATE OR REPLACE FUNCTION create_timeline_step(p_input JSONB)
RETURNS SETOF timeline_steps
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id UUID := (p_input->>'user_id')::UUID;
  v_interest_id UUID := (p_input->>'interest_id')::UUID;
  v_title TEXT := btrim(COALESCE(p_input->>'title', ''));
  v_visibility TEXT;
  v_sort_order INTEGER;
  v_starts_at TIMESTAMPTZ;
BEGIN
  -- title may be empty: caller is creating a draft and the user
  -- types into the title input on the step detail screen.

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
    metadata
  ) VALUES (
    v_user_id,
    v_interest_id,
    NULLIF(p_input->>'organization_id', '')::UUID,
    NULLIF(p_input->>'program_session_id', '')::UUID,
    COALESCE(p_input->>'source_type', 'manual'),
    NULLIF(p_input->>'source_id', '')::UUID,
    NULLIF(v_title, ''),
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
    COALESCE(p_input->'metadata', '{}'::jsonb)
  )
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION create_timeline_step(JSONB) TO authenticated;

COMMENT ON FUNCTION create_timeline_step(JSONB) IS
  'Creates a timeline step in a single round-trip. title may be empty/null for drafts (caller expects user to type a title on the step detail screen); downstream renderers fall back to placeholder copy.';
