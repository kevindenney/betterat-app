-- plans: first-class "journey" entity. A plan is a user's personal,
-- tailored copy of work — optionally derived from a blueprint (the
-- template). Multiple plans per (user, interest) are allowed: a sailor
-- might run a "Winter Dragon" plan + a year-long "Fitness for sailing"
-- plan concurrently.
--
-- Vision + competency anchors live on the plan (not on user_interests,
-- not on seasons) because they describe what THIS journey is building
-- toward — and the user can have multiple journeys per interest.
--
-- timeline_steps.plan_id links each step to the plan it belongs to.
-- Nullable: free-form steps that the user creates outside any plan
-- (e.g. an ad-hoc capture from the + composer) stay plan-less.
--
-- Applied to dev project via Supabase MCP.

CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interest_id uuid NOT NULL REFERENCES public.interests(id) ON DELETE CASCADE,
  source_blueprint_id uuid REFERENCES public.blueprints(id) ON DELETE SET NULL,
  title text,
  vision_statement text,
  vision_competency_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT plans_status_check CHECK (status IN ('active', 'paused', 'completed', 'abandoned'))
);

CREATE INDEX IF NOT EXISTS idx_plans_user_interest ON public.plans(user_id, interest_id);
CREATE INDEX IF NOT EXISTS idx_plans_source_blueprint
  ON public.plans(source_blueprint_id)
  WHERE source_blueprint_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plans_user_status
  ON public.plans(user_id, status)
  WHERE status = 'active';

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plans_select_own_v1" ON public.plans
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "plans_insert_own_v1" ON public.plans
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "plans_update_own_v1" ON public.plans
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "plans_delete_own_v1" ON public.plans
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

COMMENT ON TABLE public.plans IS
  'First-class journey entity. A plan is the user-tailored copy; an optional source_blueprint_id links back to the template it forked from. Vision + competency anchors live here (not on user_interests or seasons) because vision describes what THIS journey adds up to.';

-- Link timeline_steps to their plan. Nullable: not every step belongs
-- to a plan (ad-hoc captures stay plan-less).
ALTER TABLE public.timeline_steps
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_timeline_steps_plan
  ON public.timeline_steps(plan_id)
  WHERE plan_id IS NOT NULL;

-- =========================================================================
-- Backfill.
--
-- Step 1: one plan per (user_id, interest_id, source_blueprint_id) for
-- every existing blueprint-derived step. Title comes from the source
-- blueprint when present.
INSERT INTO public.plans (user_id, interest_id, source_blueprint_id, title, started_at, status)
SELECT
  ts.user_id,
  ts.interest_id,
  ts.source_blueprint_id,
  b.title,
  MIN(ts.created_at),
  'active'
FROM public.timeline_steps ts
JOIN public.blueprints b ON b.id = ts.source_blueprint_id
WHERE ts.source_blueprint_id IS NOT NULL
  AND ts.interest_id IS NOT NULL
GROUP BY ts.user_id, ts.interest_id, ts.source_blueprint_id, b.title
ON CONFLICT DO NOTHING;

-- Step 2: link every step that has a source_blueprint_id to its plan.
UPDATE public.timeline_steps ts
SET plan_id = p.id
FROM public.plans p
WHERE p.user_id = ts.user_id
  AND p.interest_id = ts.interest_id
  AND p.source_blueprint_id = ts.source_blueprint_id
  AND ts.source_blueprint_id IS NOT NULL
  AND ts.plan_id IS NULL;

-- Step 3: migrate vision off user_interests. If the (user, interest)
-- already has a plan from step 1, set vision on the most recently
-- started one. Otherwise create a fresh "default" plan to hold it.
DO $$
DECLARE
  rec RECORD;
  v_plan_id uuid;
BEGIN
  FOR rec IN
    SELECT user_id, interest_id, vision_statement, vision_competency_ids
    FROM public.user_interests
    WHERE vision_statement IS NOT NULL
       OR array_length(vision_competency_ids, 1) > 0
  LOOP
    SELECT id INTO v_plan_id
    FROM public.plans
    WHERE user_id = rec.user_id
      AND interest_id = rec.interest_id
      AND status = 'active'
    ORDER BY started_at DESC
    LIMIT 1;

    IF v_plan_id IS NULL THEN
      INSERT INTO public.plans (user_id, interest_id, vision_statement, vision_competency_ids)
      VALUES (rec.user_id, rec.interest_id, rec.vision_statement, rec.vision_competency_ids)
      RETURNING id INTO v_plan_id;
    ELSE
      UPDATE public.plans
      SET vision_statement = COALESCE(vision_statement, rec.vision_statement),
          vision_competency_ids = CASE
            WHEN array_length(vision_competency_ids, 1) > 0 THEN vision_competency_ids
            ELSE rec.vision_competency_ids
          END
      WHERE id = v_plan_id;
    END IF;
  END LOOP;
END $$;
