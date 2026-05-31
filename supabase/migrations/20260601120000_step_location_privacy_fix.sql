-- Fix: Watch→Nearby / Atlas location privacy was fail-open.
--
-- step_location.location_audience and .interest_slug were never written by the
-- app (StepLocationService.syncStepLocation only writes step_id/set_by/name/
-- lat/lng), so they sat NULL. atlas_can_view_step_location treated a NULL
-- audience as world-visible — exposing every step's location at exact coords to
-- any authenticated user within 25km, regardless of the step's own visibility
-- (228 of 229 leaking rows belonged to steps already marked 'private'). The
-- privacy settings UI had no effect on this surface.
--
-- Four parts:
--   1a. BEFORE trigger: a new/updated step_location inherits audience + slug
--       from its parent timeline_step when not explicitly provided.
--   1b. AFTER trigger: changing a step's visibility/interest pushes down to its
--       location row so audience can never drift from the step.
--   2.  atlas_can_view_step_location now fails CLOSED on a NULL audience.
--   3.  Backfill existing rows from their parent step (orphans -> private).
--
-- Location audience deliberately mirrors step visibility: a step's "where" is
-- shown to exactly the audience that can see the step. Coordinate-precision
-- fuzzing (location_precision) is a separate, still-unbuilt control.

-- 0. location_audience mirrors step visibility, which includes 'private'.
--    The original CHECK omitted 'private' (only crew/cohort/program/following/
--    fleet/public), so inheriting a private step's visibility was rejected.
--    A 'private' audience is owner-only: atlas_can_view_step_location short-
--    circuits true for the owner and the CASE falls through to false for
--    everyone else (no 'private' branch), so no extra gate logic is needed.
ALTER TABLE public.step_location
  DROP CONSTRAINT IF EXISTS step_location_location_audience_check;
ALTER TABLE public.step_location
  ADD CONSTRAINT step_location_location_audience_check
  CHECK (
    location_audience IS NULL
    OR location_audience = ANY (ARRAY[
      'private', 'crew', 'cohort', 'program', 'following', 'fleet', 'public'
    ]::text[])
  );

-- 1a. Inherit audience + slug from the parent step on write.
CREATE OR REPLACE FUNCTION public.step_location_inherit_step_meta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.location_audience IS NULL THEN
    NEW.location_audience := COALESCE(
      (SELECT ts.visibility FROM public.timeline_steps ts WHERE ts.id = NEW.step_id),
      'private'
    );
  END IF;
  IF NEW.interest_slug IS NULL THEN
    NEW.interest_slug := (
      SELECT i.slug
      FROM public.timeline_steps ts
      JOIN public.interests i ON i.id = ts.interest_id
      WHERE ts.id = NEW.step_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS step_location_inherit_step_meta ON public.step_location;
CREATE TRIGGER step_location_inherit_step_meta
  BEFORE INSERT OR UPDATE ON public.step_location
  FOR EACH ROW EXECUTE FUNCTION public.step_location_inherit_step_meta();

-- 1b. Keep the location row in sync when the step's visibility/interest changes.
CREATE OR REPLACE FUNCTION public.timeline_steps_sync_location_meta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.step_location sl
  SET location_audience = NEW.visibility,
      interest_slug = COALESCE(
        (SELECT i.slug FROM public.interests i WHERE i.id = NEW.interest_id),
        sl.interest_slug
      )
  WHERE sl.step_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS timeline_steps_sync_location_meta ON public.timeline_steps;
CREATE TRIGGER timeline_steps_sync_location_meta
  AFTER UPDATE OF visibility, interest_id ON public.timeline_steps
  FOR EACH ROW
  WHEN (OLD.visibility IS DISTINCT FROM NEW.visibility
        OR OLD.interest_id IS DISTINCT FROM NEW.interest_id)
  EXECUTE FUNCTION public.timeline_steps_sync_location_meta();

-- 2. Fail CLOSED: a location with no explicit audience is private, not public.
CREATE OR REPLACE FUNCTION public.atlas_can_view_step_location(p_step_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_set_by   uuid;
  v_audience text;
  v_viewer   uuid;
BEGIN
  v_viewer := (SELECT auth.uid());
  IF v_viewer IS NULL THEN RETURN false; END IF;
  SELECT set_by, location_audience INTO v_set_by, v_audience
    FROM public.step_location WHERE step_id = p_step_id;
  IF v_set_by IS NULL THEN RETURN false; END IF;
  IF v_set_by = v_viewer THEN RETURN true; END IF;
  IF v_audience IS NULL THEN RETURN false; END IF;
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
      SELECT 1
      FROM public.organization_memberships om_viewer
      JOIN public.organization_memberships om_setter
        ON om_setter.organization_id = om_viewer.organization_id
      WHERE om_viewer.user_id = v_viewer AND om_setter.user_id = v_set_by
        AND COALESCE(om_viewer.membership_status, om_viewer.status) = 'active'
        AND COALESCE(om_setter.membership_status, om_setter.status) = 'active'
    )
    WHEN 'program' THEN EXISTS (
      SELECT 1
      FROM public.program_participants pp_viewer
      JOIN public.program_participants pp_setter
        ON pp_setter.program_id = pp_viewer.program_id
      WHERE pp_viewer.user_id = v_viewer AND pp_setter.user_id = v_set_by
    )
    ELSE false
  END;
END;
$$;

-- 3. Backfill existing NULL-audience rows from their parent step.
UPDATE public.step_location sl
SET location_audience = COALESCE(ts.visibility, 'private'),
    interest_slug = COALESCE(sl.interest_slug, i.slug)
FROM public.timeline_steps ts
LEFT JOIN public.interests i ON i.id = ts.interest_id
WHERE ts.id = sl.step_id
  AND sl.location_audience IS NULL;

-- Orphan location rows with no backing step: default to private.
UPDATE public.step_location
SET location_audience = 'private'
WHERE location_audience IS NULL;
