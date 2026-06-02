-- ============================================================================
-- Decouple fleet-plan templates from the personal timeline
--
-- A fleet plan (timeline_blueprint, access_level='fleet') stores its steps as
-- timeline_steps owned by the plan author, linked through blueprint_steps. Those
-- same rows ARE the author's personal-timeline rows, and blueprint_steps.step_id
-- is ON DELETE CASCADE — so when the captain deleted a race from their personal
-- timeline, it silently cascaded out of the published plan for every member.
--
-- Fix: mark plan-author template rows with is_plan_template = true and exclude
-- them from the personal-timeline query (getUserTimeline). The author keeps their
-- own private adopted copy (auto-adopted by the backfill below) just like any
-- member, so deleting from the personal timeline only ever touches a copy — never
-- the published template. Members already adopt their own copies, so they are
-- unaffected. Plan editing still goes through the fleet_plan_* SECURITY DEFINER
-- RPCs, which operate on the template rows directly.
--
-- Applied to dev project qavekrwdbsobecwrfxwu.
-- ============================================================================

-- 1. Marker column.
ALTER TABLE public.timeline_steps
  ADD COLUMN IF NOT EXISTS is_plan_template boolean NOT NULL DEFAULT false;

-- 2. Auto-adopt backfill. For every plan-author template row, ensure the author
--    holds a personal copy so nothing disappears from their timeline when the
--    template is hidden in step 3. Skips authors who already adopted a copy under
--    either adoption convention (source_id = template id OR = blueprint_steps id).
INSERT INTO public.timeline_steps (
  user_id, interest_id, organization_id, source_type, source_id,
  source_blueprint_id, source_blueprint_step_id, copied_from_user_id,
  title, description, category, status,
  starts_at, ends_at, location_name, location_lat, location_lng, location_place_id,
  visibility, sort_order, metadata, is_plan_template
)
SELECT
  t.user_id, t.interest_id, t.organization_id, 'copied', t.id,
  b.id, bs.id, t.user_id,
  t.title, t.description, t.category, 'pending',
  t.starts_at, t.ends_at, t.location_name, t.location_lat, t.location_lng, t.location_place_id,
  'private', t.sort_order, '{}'::jsonb, false
FROM public.timeline_steps t
JOIN public.blueprint_steps bs ON bs.step_id = t.id
JOIN public.timeline_blueprints b ON b.id = bs.blueprint_id
WHERE b.fleet_id IS NOT NULL
  AND t.user_id = b.user_id
  AND NOT EXISTS (
    SELECT 1 FROM public.timeline_steps c
    WHERE c.user_id = t.user_id
      AND c.is_plan_template = false
      AND (c.source_id = t.id OR c.source_id = bs.id)
  );

-- 3. Hide the template rows from their author's personal timeline.
UPDATE public.timeline_steps t
  SET is_plan_template = true
  FROM public.blueprint_steps bs
  JOIN public.timeline_blueprints b ON b.id = bs.blueprint_id
  WHERE bs.step_id = t.id
    AND b.fleet_id IS NOT NULL
    AND t.user_id = b.user_id;

-- 4. New plan steps authored via fleet_plan_add_step must also be templates.
CREATE OR REPLACE FUNCTION public.fleet_plan_add_step(
  p_blueprint_id uuid,
  p_kind text,
  p_title text,
  p_details text DEFAULT NULL,
  p_starts_at timestamptz DEFAULT NULL,
  p_ends_at timestamptz DEFAULT NULL,
  p_location_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_interest_id uuid;
  v_step_id uuid;
  v_link_sort integer;
BEGIN
  IF NOT is_fleet_plan_editor(p_blueprint_id, (SELECT auth.uid())) THEN
    RAISE EXCEPTION 'not authorized to edit this fleet plan';
  END IF;

  SELECT b.user_id, b.interest_id
    INTO v_owner_id, v_interest_id
    FROM timeline_blueprints b
    WHERE b.id = p_blueprint_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'fleet plan not found';
  END IF;

  SELECT COALESCE(max(bs.sort_order), -1) + 1
    INTO v_link_sort
    FROM blueprint_steps bs
    WHERE bs.blueprint_id = p_blueprint_id;

  INSERT INTO timeline_steps (
    user_id, interest_id, source_type, title, description, category,
    starts_at, ends_at, location_name, visibility, sort_order, is_plan_template
  ) VALUES (
    v_owner_id, v_interest_id, 'manual', NULLIF(btrim(p_title), ''),
    NULLIF(btrim(p_details), ''), COALESCE(p_kind, 'other'),
    p_starts_at, p_ends_at, NULLIF(btrim(p_location_name), ''), 'fleet', v_link_sort, true
  )
  RETURNING id INTO v_step_id;

  INSERT INTO blueprint_steps (blueprint_id, step_id, sort_order)
  VALUES (p_blueprint_id, v_step_id, v_link_sort)
  ON CONFLICT (blueprint_id, step_id) DO NOTHING;

  RETURN v_step_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.fleet_plan_add_step(uuid, text, text, text, timestamptz, timestamptz, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
