-- Shared discussion at the blueprint_step level.
--
-- Today every timeline_step has its own private discussion thread.
-- Cross-subscriber read was wired through is_subscriber_to_step_blueprint,
-- but each subscriber still wrote to their OWN step_id — there was no
-- canonical "everyone subscribed to this blueprint, here is THE
-- conversation thread for this step in it" channel.
--
-- This migration:
--   1. Adds timeline_steps.source_blueprint_step_id so each forked
--      step knows which blueprint_step it came from (backfilled by
--      title match within the same blueprint).
--   2. Makes step_discussions.step_id nullable and adds
--      blueprint_step_id with a CHECK forcing exactly one scope.
--      Private notes set step_id; shared cohort posts set
--      blueprint_step_id.
--   3. Adds RLS so anyone with an active plan (or legacy
--      blueprint_subscription) for this blueprint can read/post to
--      the shared thread. Private notes stay step-owner-only via the
--      existing policies.
--
-- Applied to dev project via Supabase MCP.

-- ------------------------------------------------------------------
-- 1. timeline_steps → blueprint_steps explicit link.
-- ------------------------------------------------------------------
ALTER TABLE public.timeline_steps
  ADD COLUMN IF NOT EXISTS source_blueprint_step_id uuid
    REFERENCES public.blueprint_steps(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_timeline_steps_source_blueprint_step
  ON public.timeline_steps(source_blueprint_step_id)
  WHERE source_blueprint_step_id IS NOT NULL;

-- Best-effort backfill: match by blueprint_id + title.
-- blueprint_steps.step_id is the canonical (creator-owned) step;
-- each subscriber's forked timeline_step carries the same title.
-- This won't catch steps where the user renamed their copy — those
-- stay null and the Cohort discussion tab simply won't enable for
-- them. Acceptable v1 tradeoff.
UPDATE public.timeline_steps ts
SET source_blueprint_step_id = bs.id
FROM public.blueprint_steps bs
JOIN public.timeline_steps canonical ON canonical.id = bs.step_id
WHERE ts.source_blueprint_id = bs.blueprint_id
  AND ts.source_blueprint_step_id IS NULL
  AND ts.title = canonical.title
  AND ts.source_blueprint_id IS NOT NULL;

-- ------------------------------------------------------------------
-- 2. step_discussions → two-scope target.
-- ------------------------------------------------------------------
ALTER TABLE public.step_discussions
  ADD COLUMN IF NOT EXISTS blueprint_step_id uuid
    REFERENCES public.blueprint_steps(id) ON DELETE CASCADE;

ALTER TABLE public.step_discussions ALTER COLUMN step_id DROP NOT NULL;

ALTER TABLE public.step_discussions
  ADD CONSTRAINT step_discussions_target_check
  CHECK (
    (step_id IS NOT NULL AND blueprint_step_id IS NULL)
    OR (step_id IS NULL AND blueprint_step_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_step_discussions_blueprint_step
  ON public.step_discussions(blueprint_step_id)
  WHERE blueprint_step_id IS NOT NULL;

-- ------------------------------------------------------------------
-- 3. Helper + RLS.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_plan_member_for_blueprint_step(
  p_blueprint_step_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.blueprint_steps bs
      JOIN public.plans p
        ON p.source_blueprint_id = bs.blueprint_id
       AND p.user_id = p_user_id
       AND p.status = 'active'
     WHERE bs.id = p_blueprint_step_id
  )
  OR EXISTS (
    SELECT 1
      FROM public.blueprint_steps bs
      JOIN public.blueprint_subscriptions sub
        ON sub.blueprint_id = bs.blueprint_id
       AND sub.subscriber_id = p_user_id
     WHERE bs.id = p_blueprint_step_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_plan_member_for_blueprint_step(uuid, uuid)
  TO authenticated;

-- Additive policies — existing per-step policies still work for
-- step_id rows; these handle blueprint_step_id rows.
CREATE POLICY step_discussions_blueprint_step_read
  ON public.step_discussions
  FOR SELECT TO authenticated
  USING (
    blueprint_step_id IS NOT NULL
    AND public.is_plan_member_for_blueprint_step(blueprint_step_id, auth.uid())
  );

CREATE POLICY step_discussions_blueprint_step_insert
  ON public.step_discussions
  FOR INSERT TO authenticated
  WITH CHECK (
    blueprint_step_id IS NOT NULL
    AND auth.uid() = user_id
    AND public.is_plan_member_for_blueprint_step(blueprint_step_id, auth.uid())
  );
