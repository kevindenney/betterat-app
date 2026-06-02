-- ============================================================================
-- Co-editable fleet plans
--
-- A fleet plan (timeline_blueprint, access_level='fleet') used to be editable by
-- its author only — "Edit plan" was gated on plan authorship. But the people who
-- run a fleet are its captains (role in owner/captain/coach), who often aren't
-- the original author. This makes a plan co-editable by ANY of the fleet's
-- captains.
--
-- Hard constraint that shapes the design: get_suggested_next_steps (and the
-- member adopt path) only surface steps WHERE ts.user_id = bp.user_id — i.e.
-- steps that live in the PLAN OWNER's timeline. So a co-added step must be
-- authored in the owner's timeline, not the editing captain's. A captain can't
-- write a row owned by another user under normal RLS, so every mutation runs
-- through a SECURITY DEFINER RPC gated on captain-role membership.
--
-- Applied to dev project qavekrwdbsobecwrfxwu.
-- ============================================================================

-- 1. Editor predicate. Active fleet member with a managing role, OR the plan's
--    own author (always allowed). SECURITY DEFINER so it can read fleet_members
--    + timeline_blueprints regardless of the caller's RLS.
CREATE OR REPLACE FUNCTION public.is_fleet_plan_editor(p_blueprint_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM timeline_blueprints b
    WHERE b.id = p_blueprint_id
      AND b.fleet_id IS NOT NULL
      AND (
        b.user_id = p_user_id
        OR EXISTS (
          SELECT 1 FROM fleet_members fm
          WHERE fm.fleet_id = b.fleet_id
            AND fm.user_id = p_user_id
            AND fm.status = 'active'
            AND fm.role IN ('owner', 'captain', 'coach')
        )
      )
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_fleet_plan_editor(uuid, uuid) TO authenticated;

-- 2. Add a step to a fleet plan. The step is authored in the plan OWNER's
--    timeline (b.user_id) so member suggestions/adoption keep working, then
--    linked into blueprint_steps at the end of the curated order.
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
  v_step_sort integer;
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

  SELECT COALESCE(max(ts.sort_order), -1) + 1
    INTO v_step_sort
    FROM timeline_steps ts
    WHERE ts.user_id = v_owner_id
      AND ts.interest_id IS NOT DISTINCT FROM v_interest_id;

  INSERT INTO timeline_steps (
    user_id, interest_id, source_type, title, description, category,
    starts_at, ends_at, location_name, visibility, sort_order
  ) VALUES (
    v_owner_id, v_interest_id, 'manual', NULLIF(btrim(p_title), ''),
    NULLIF(btrim(p_details), ''), COALESCE(p_kind, 'other'),
    p_starts_at, p_ends_at, NULLIF(btrim(p_location_name), ''), 'fleet', v_step_sort
  )
  RETURNING id INTO v_step_id;

  SELECT COALESCE(max(bs.sort_order), -1) + 1
    INTO v_link_sort
    FROM blueprint_steps bs
    WHERE bs.blueprint_id = p_blueprint_id;

  INSERT INTO blueprint_steps (blueprint_id, step_id, sort_order)
  VALUES (p_blueprint_id, v_step_id, v_link_sort)
  ON CONFLICT (blueprint_id, step_id) DO NOTHING;

  RETURN v_step_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.fleet_plan_add_step(uuid, text, text, text, timestamptz, timestamptz, text) TO authenticated;

-- 3. Remove a step from a fleet plan. Unlinks it, then deletes the underlying
--    owner-authored step (only ever a step this plan owns).
CREATE OR REPLACE FUNCTION public.fleet_plan_remove_step(
  p_blueprint_id uuid,
  p_step_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  IF NOT is_fleet_plan_editor(p_blueprint_id, (SELECT auth.uid())) THEN
    RAISE EXCEPTION 'not authorized to edit this fleet plan';
  END IF;

  SELECT b.user_id INTO v_owner_id
    FROM timeline_blueprints b
    WHERE b.id = p_blueprint_id;

  DELETE FROM blueprint_steps
    WHERE blueprint_id = p_blueprint_id AND step_id = p_step_id;

  -- Only delete the source step if it belongs to the plan owner's timeline
  -- (i.e. it is a plan item, not someone's separately-adopted copy).
  DELETE FROM timeline_steps
    WHERE id = p_step_id AND user_id = v_owner_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.fleet_plan_remove_step(uuid, uuid) TO authenticated;

-- 4. Reorder the curated steps. Sets blueprint_steps.sort_order to array index.
CREATE OR REPLACE FUNCTION public.fleet_plan_reorder_steps(
  p_blueprint_id uuid,
  p_step_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_fleet_plan_editor(p_blueprint_id, (SELECT auth.uid())) THEN
    RAISE EXCEPTION 'not authorized to edit this fleet plan';
  END IF;

  UPDATE blueprint_steps bs
    SET sort_order = idx.ord
    FROM (
      SELECT s AS step_id, (i - 1) AS ord
      FROM unnest(p_step_ids) WITH ORDINALITY AS t(s, i)
    ) idx
    WHERE bs.blueprint_id = p_blueprint_id
      AND bs.step_id = idx.step_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.fleet_plan_reorder_steps(uuid, uuid[]) TO authenticated;

-- 5. Publish / unpublish a fleet plan.
CREATE OR REPLACE FUNCTION public.fleet_plan_set_published(
  p_blueprint_id uuid,
  p_published boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_fleet_plan_editor(p_blueprint_id, (SELECT auth.uid())) THEN
    RAISE EXCEPTION 'not authorized to edit this fleet plan';
  END IF;

  UPDATE timeline_blueprints
    SET is_published = p_published,
        updated_at = now()
    WHERE id = p_blueprint_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.fleet_plan_set_published(uuid, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
