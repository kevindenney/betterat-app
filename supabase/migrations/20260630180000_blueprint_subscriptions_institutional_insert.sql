-- Let learners subscribe to institutional / marketplace blueprints.
--
-- blueprint_subscriptions is now source-agnostic (blueprint_system discriminator),
-- but its INSERT policy still gated solely on can_subscribe_to_blueprint(), which
-- only ever looks in timeline_blueprints. An institutional blueprint id lives in
-- public.blueprints, so that lookup returned NOT FOUND -> false, and a student
-- tapping "Add to plan" on an assigned blueprint hit a silent RLS rejection
-- ("Something went wrong"). Make the access check source-aware.

-- Access check for institutional / marketplace blueprints (public.blueprints):
-- the author can always subscribe to their own; otherwise the learner must be a
-- member of a cohort the blueprint is linked to.
CREATE OR REPLACE FUNCTION public.can_subscribe_to_institutional_blueprint(p_blueprint_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_author uuid;
BEGIN
  SELECT author_user_id INTO v_author
  FROM public.blueprints
  WHERE id = p_blueprint_id;

  IF NOT FOUND THEN RETURN false; END IF;

  -- Author can always subscribe to their own blueprint.
  IF v_author = (SELECT auth.uid()) THEN RETURN true; END IF;

  -- Otherwise the learner must belong to a cohort linked to this blueprint.
  RETURN EXISTS (
    SELECT 1
    FROM public.blueprint_cohorts bc
    JOIN public.betterat_org_cohort_members m ON m.cohort_id = bc.cohort_id
    WHERE bc.blueprint_id = p_blueprint_id
      AND m.user_id = (SELECT auth.uid())
  );
END;
$$;

-- Source-aware INSERT policy: timeline blueprints keep the existing check; the
-- other two systems use the institutional check above.
DROP POLICY IF EXISTS "Subscribe to blueprints" ON public.blueprint_subscriptions;
CREATE POLICY "Subscribe to blueprints" ON public.blueprint_subscriptions
  FOR INSERT
  WITH CHECK (
    subscriber_id = (SELECT auth.uid())
    AND (
      CASE
        WHEN blueprint_system = 'timeline'
          THEN can_subscribe_to_blueprint(blueprint_id)
        ELSE can_subscribe_to_institutional_blueprint(blueprint_id)
      END
    )
  );
