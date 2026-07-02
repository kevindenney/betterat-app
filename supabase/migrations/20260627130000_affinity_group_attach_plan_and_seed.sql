-- Attach a plan (timeline_blueprint) to a self-serve affinity group and seed
-- new members from it.
--
-- The "work a plan through with 5 people" flow: a member attaches their plan
-- to the group, then everyone they add gets the plan. We deliberately do NOT
-- push the whole plan onto each member's timeline. Instead:
--   • the member is SUBSCRIBED to the blueprint, so every step surfaces in
--     their living "new steps" feed to pull/adopt themselves (the existing
--     blueprint subscription model), and
--   • only the calendared ANCHORS (is_race, or a hard due_at) plus the FIRST
--     step are auto-adopted onto their timeline up front, so there's an
--     immediate starting point without dumping the entire plan on them.
-- This matches the user's explicit ask: "users should add steps themselves,
-- but add calendared steps and the first steps in addition."
--
-- Both RPCs are SECURITY DEFINER because seeding another member means writing
-- rows the caller doesn't own (their subscription, their copied steps) — the
-- self-only RLS on blueprint_subscriptions / timeline_steps would block it.

-- ---------------------------------------------------------------------------
-- 1. The attachment column
-- ---------------------------------------------------------------------------

ALTER TABLE public.affinity_groups
  ADD COLUMN IF NOT EXISTS blueprint_id uuid
    REFERENCES public.timeline_blueprints(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 2. seed_group_member_from_blueprint
-- ---------------------------------------------------------------------------
-- Subscribe p_user_id to the group's attached plan and auto-adopt only the
-- anchors + first step. Idempotent: skips steps already acted on, and never
-- re-subscribes (so the subscriber_count trigger doesn't inflate).

CREATE OR REPLACE FUNCTION public.seed_group_member_from_blueprint(
  p_group_id uuid,
  p_user_id  uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller     uuid := auth.uid();
  v_blueprint  uuid;
  v_sub_id     uuid;
  v_interest   uuid;
  v_next_sort  integer;
  v_idx        integer := 0;
  v_new_step   uuid;
  r            record;
  v_is_anchor  boolean;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  -- Caller must be an active member of the group (same gate as add-member).
  IF NOT EXISTS (
    SELECT 1 FROM affinity_group_members
    WHERE group_id = p_group_id AND user_id = v_caller AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'only members can seed people in this group';
  END IF;

  SELECT blueprint_id INTO v_blueprint
  FROM affinity_groups
  WHERE id = p_group_id AND is_active = true;

  -- No plan attached → nothing to seed.
  IF v_blueprint IS NULL THEN
    RETURN;
  END IF;

  SELECT interest_id INTO v_interest
  FROM timeline_blueprints
  WHERE id = v_blueprint;

  -- Subscribe the member (once). The unique (blueprint_id, subscriber_id)
  -- plus the subscriber_count trigger mean we must not re-insert.
  SELECT id INTO v_sub_id
  FROM blueprint_subscriptions
  WHERE blueprint_id = v_blueprint AND subscriber_id = p_user_id;

  IF v_sub_id IS NULL THEN
    INSERT INTO blueprint_subscriptions (blueprint_id, subscriber_id)
    VALUES (v_blueprint, p_user_id)
    RETURNING id INTO v_sub_id;
  END IF;

  -- Next sort_order for this member's timeline in the plan's interest.
  SELECT COALESCE(MAX(sort_order), -1) + 1 INTO v_next_sort
  FROM timeline_steps
  WHERE user_id = p_user_id AND interest_id = v_interest;

  -- Walk the curated steps in order. Auto-adopt only anchors + the first.
  FOR r IN
    SELECT s.*, bs.sort_order AS bp_sort
    FROM blueprint_steps bs
    JOIN timeline_steps s ON s.id = bs.step_id
    WHERE bs.blueprint_id = v_blueprint
    ORDER BY bs.sort_order ASC
  LOOP
    v_idx := v_idx + 1;

    -- The member already authored this step (they own the blueprint) — it's
    -- already on their timeline, so don't copy it back as a duplicate.
    IF r.user_id = p_user_id THEN
      CONTINUE;
    END IF;

    v_is_anchor := (v_idx = 1) OR COALESCE(r.is_race, false) OR (r.due_at IS NOT NULL);

    IF NOT v_is_anchor THEN
      CONTINUE; -- leave for the member to pull from their feed
    END IF;

    -- Skip if this member already acted on this source step.
    IF EXISTS (
      SELECT 1 FROM blueprint_step_actions
      WHERE subscription_id = v_sub_id AND source_step_id = r.id
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO timeline_steps (
      user_id, interest_id, organization_id,
      source_type, source_id, copied_from_user_id,
      title, description, category, status,
      starts_at, ends_at, due_at,
      location_name, location_lat, location_lng, location_place_id,
      visibility, share_approximate_location,
      sort_order, metadata, is_timed, is_race
    )
    VALUES (
      p_user_id, r.interest_id, r.organization_id,
      'copied', r.id, r.user_id,
      r.title, r.description, r.category, 'pending',
      r.starts_at, r.ends_at, r.due_at,
      r.location_name, r.location_lat, r.location_lng, r.location_place_id,
      r.visibility, r.share_approximate_location,
      v_next_sort, r.metadata, r.is_timed, r.is_race
    )
    RETURNING id INTO v_new_step;

    v_next_sort := v_next_sort + 1;

    INSERT INTO blueprint_step_actions (subscription_id, source_step_id, action, adopted_step_id)
    VALUES (v_sub_id, r.id, 'adopted', v_new_step);
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_group_member_from_blueprint(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.seed_group_member_from_blueprint IS
  'Subscribe a group member to the group''s attached plan and auto-adopt only anchors (is_race / due_at) + the first step; the rest stays pull. SECURITY DEFINER.';

-- ---------------------------------------------------------------------------
-- 3. attach_affinity_group_blueprint
-- ---------------------------------------------------------------------------
-- Attach the caller's plan to a self-serve group, publish it so members can
-- pull from it, and seed every existing active member. Idempotent.

CREATE OR REPLACE FUNCTION public.attach_affinity_group_blueprint(
  p_group_id     uuid,
  p_blueprint_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_kind   text;
  v_owner  uuid;
  r_member record;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT kind INTO v_kind
  FROM affinity_groups
  WHERE id = p_group_id AND is_active = true;

  IF v_kind IS NULL THEN
    RAISE EXCEPTION 'group not found';
  END IF;

  IF v_kind NOT IN ('crew_pod', 'practice_group') THEN
    RAISE EXCEPTION 'this group does not support attaching a plan here';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM affinity_group_members
    WHERE group_id = p_group_id AND user_id = v_caller AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'only members can attach a plan to this group';
  END IF;

  -- Only the plan's owner may attach it, so we don't hijack someone else's
  -- private blueprint into a group.
  SELECT user_id INTO v_owner
  FROM timeline_blueprints
  WHERE id = p_blueprint_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'plan not found';
  END IF;

  IF v_owner <> v_caller THEN
    RAISE EXCEPTION 'you can only attach a plan you created';
  END IF;

  -- Publishing is what lets members pull steps from their subscription feed
  -- (getNewStepsForSubscriber filters is_published = true).
  UPDATE timeline_blueprints
  SET is_published = true, updated_at = now()
  WHERE id = p_blueprint_id;

  UPDATE affinity_groups
  SET blueprint_id = p_blueprint_id
  WHERE id = p_group_id;

  -- Seed every existing active member (including the attacher).
  FOR r_member IN
    SELECT user_id FROM affinity_group_members
    WHERE group_id = p_group_id AND status = 'active'
  LOOP
    PERFORM public.seed_group_member_from_blueprint(p_group_id, r_member.user_id);
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.attach_affinity_group_blueprint(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.attach_affinity_group_blueprint IS
  'Owner attaches + publishes their plan to a self-serve group and seeds all existing members (anchors + first step). SECURITY DEFINER.';

-- ---------------------------------------------------------------------------
-- 4. Fold seeding into add_affinity_group_member
-- ---------------------------------------------------------------------------
-- Adding someone to a group that already has a plan should seed them too, so
-- the add-people flow and the attach flow converge on the same outcome.

CREATE OR REPLACE FUNCTION public.add_affinity_group_member(
  p_group_id uuid,
  p_user_id  uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_kind   text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT kind INTO v_kind
  FROM affinity_groups
  WHERE id = p_group_id AND is_active = true;

  IF v_kind IS NULL THEN
    RAISE EXCEPTION 'group not found';
  END IF;

  IF v_kind NOT IN ('crew_pod', 'practice_group') THEN
    RAISE EXCEPTION 'this group does not support adding members here';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM affinity_group_members
    WHERE group_id = p_group_id
      AND user_id  = v_caller
      AND status   = 'active'
  ) THEN
    RAISE EXCEPTION 'only members can add people to this group';
  END IF;

  INSERT INTO affinity_group_members (group_id, user_id, role, status)
  VALUES (p_group_id, p_user_id, 'member', 'active')
  ON CONFLICT (group_id, user_id)
  DO UPDATE SET status = 'active';

  -- If the group has an attached plan, seed the new member from it.
  PERFORM public.seed_group_member_from_blueprint(p_group_id, p_user_id);
END;
$$;
