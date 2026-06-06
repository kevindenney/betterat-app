-- §4.1 Make one race — admin authoring for the Org Admin Calendar.
--
-- A race is just a Step with is_race = true (D30/D31), so "new race" and "new
-- event" are the same insert with one boolean. timeline_steps RLS only lets a
-- user insert their own rows (auth.uid() = user_id), and interest_id is NOT
-- NULL with no default — so authoring goes through a SECURITY DEFINER RPC,
-- gated by is_org_admin_member (consistent with admin_org_calendar), that
-- resolves the org's interest server-side and inserts the shared org step.
--
-- D33 — lazy scoring: flipping is_race here does NOT mint a regatta_races row.
-- regatta_race_id stays null until someone actually scores the race in the
-- race cockpit. Most club races are never formally scored.
--
-- Apply to dev project qavekrwdbsobecwrfxwu.

CREATE OR REPLACE FUNCTION public.admin_create_org_event(
  p_org_id     uuid,
  p_title      text,
  p_starts_at  timestamptz DEFAULT NULL,
  p_ends_at    timestamptz DEFAULT NULL,
  p_is_race    boolean DEFAULT false,
  p_description text DEFAULT NULL,
  p_place_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title    text := NULLIF(btrim(p_title), '');
  v_interest uuid;
  v_step     uuid;
BEGIN
  IF NOT public.is_org_admin_member(p_org_id) THEN
    RAISE EXCEPTION 'Not authorized to author events for this org'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_title IS NULL THEN
    RAISE EXCEPTION 'Event title is required' USING ERRCODE = 'check_violation';
  END IF;

  -- Resolve the org's interest (timeline_steps.interest_id is NOT NULL).
  SELECT i.id INTO v_interest
  FROM public.organizations o
  JOIN public.interests i ON i.slug = o.interest_slug
  WHERE o.id = p_org_id;

  IF v_interest IS NULL THEN
    RAISE EXCEPTION 'Org has no interest configured; set one before authoring events'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.timeline_steps
    (user_id, organization_id, interest_id, source_type, title, description,
     category, status, is_race, starts_at, ends_at, visibility)
  VALUES
    ((SELECT auth.uid()), p_org_id, v_interest, 'manual', v_title,
     NULLIF(btrim(p_description), ''), 'general', 'pending',
     COALESCE(p_is_race, false), p_starts_at, p_ends_at, 'public')
  RETURNING id INTO v_step;

  -- Optional place — name only (no coords). A full course/marks pin is set up
  -- afterward in the Atlas/race cockpit; here we just carry a label.
  IF NULLIF(btrim(p_place_name), '') IS NOT NULL THEN
    INSERT INTO public.step_location (step_id, name, set_by)
    VALUES (v_step, btrim(p_place_name), (SELECT auth.uid()));
  END IF;

  RETURN v_step;
END;
$$;

COMMENT ON FUNCTION public.admin_create_org_event(uuid, text, timestamptz, timestamptz, boolean, text, text) IS
  'Org Admin Calendar authoring (§4.1). Inserts a shared org timeline_step (is_race optional). SECURITY DEFINER; gated by is_org_admin_member. D33: does not mint a scoring row.';

REVOKE ALL ON FUNCTION public.admin_create_org_event(uuid, text, timestamptz, timestamptz, boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_org_event(uuid, text, timestamptz, timestamptz, boolean, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
