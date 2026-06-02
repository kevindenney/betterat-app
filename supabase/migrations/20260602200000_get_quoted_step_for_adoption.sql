-- get_quoted_step_for_adoption — let a discussion participant read the
-- step that was pull-quoted into a note, so they can adopt (copy) it into
-- their own timeline.
--
-- A quote-carrying note references another user's timeline_step via
-- quoted_step_id. That source step is normally private to its author, so a
-- plain SELECT from the adopter trips timeline_steps RLS and returns nothing
-- (the same cross-user wall copy_library_resources_for_adoption was built to
-- get around). This SECURITY DEFINER function reads the source row on the
-- caller's behalf, but ONLY after confirming the caller can actually see the
-- discussion the quote lives in:
--   * personal thread  → can_access_step_discussion(step_id, uid) (owner + collaborators)
--   * cohort thread    → is_plan_member_for_blueprint_step(blueprint_step_id, uid)
-- so it exposes nothing the caller couldn't already see quoted inline.
--
-- Returns 0 rows when the note has no quote or the caller isn't a participant.
-- The adopter still inserts their own timeline_steps row under their own RLS;
-- this only unblocks the read of the source's adoptable fields.
--
-- auth.uid() wrapped as (SELECT auth.uid()) per the per-row-decode rule;
-- every body column qualified with the ts/d alias to dodge RETURNS TABLE
-- output-name shadowing.
--
-- Applied to dev project qavekrwdbsobecwrfxwu.

CREATE OR REPLACE FUNCTION public.get_quoted_step_for_adoption(
  p_discussion_id uuid
)
RETURNS TABLE (
  source_step_id uuid,
  owner_id uuid,
  title text,
  description text,
  category text,
  organization_id uuid,
  location_name text,
  location_lat double precision,
  location_lng double precision,
  location_place_id text,
  visibility text,
  metadata jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ts.id,
    ts.user_id,
    ts.title,
    ts.description,
    ts.category,
    ts.organization_id,
    ts.location_name,
    ts.location_lat,
    ts.location_lng,
    ts.location_place_id,
    ts.visibility,
    ts.metadata
  FROM public.step_discussions d
  JOIN public.timeline_steps ts
    ON ts.id = d.quoted_step_id
  WHERE d.id = p_discussion_id
    AND d.quoted_step_id IS NOT NULL
    AND (
      (
        d.step_id IS NOT NULL
        AND public.can_access_step_discussion(d.step_id, (SELECT auth.uid()))
      )
      OR (
        d.blueprint_step_id IS NOT NULL
        AND public.is_plan_member_for_blueprint_step(d.blueprint_step_id, (SELECT auth.uid()))
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_quoted_step_for_adoption(uuid)
  TO authenticated;
