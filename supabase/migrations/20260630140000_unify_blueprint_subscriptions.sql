-- Unify blueprint_subscriptions into a source-agnostic relationship table.
--
-- Before: blueprint_subscriptions was System-A only — blueprint_id had a hard FK
-- to timeline_blueprints. Institutional (System-B `blueprints`) and marketplace
-- subscriptions lived in separate tables / were derived from cohort membership.
--
-- After: one relationship row per subscribe, for every source. A discriminator
-- (`blueprint_system`) says which table `blueprint_id` points at; the learner's
-- chosen interest and starting granularity are first-class. The hard cross-table
-- FK is relaxed (it can't point at two tables) and replaced by a validation
-- trigger. See docs/redesign/specs/BLUEPRINT_SUBSCRIBE_UNIFIED_FLOW_SPEC.md §7.1.

-- 1. New columns (all additive; existing readers keep working via the default).
ALTER TABLE public.blueprint_subscriptions
  ADD COLUMN IF NOT EXISTS blueprint_system text NOT NULL DEFAULT 'timeline'
    CHECK (blueprint_system IN ('timeline', 'institutional', 'marketplace')),
  ADD COLUMN IF NOT EXISTS target_interest_id uuid
    REFERENCES public.interests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS entry_granularity text
    CHECK (entry_granularity IN ('first', 'all', 'none'));

-- 2. Relax the hard FK so blueprint_id can point at timeline_blueprints OR
--    blueprints depending on blueprint_system. Integrity moves to the trigger
--    below (app-level integrity is acceptable per the spec).
ALTER TABLE public.blueprint_subscriptions
  DROP CONSTRAINT IF EXISTS blueprint_subscriptions_blueprint_id_fkey;

-- 3. Validation trigger: assert blueprint_id resolves in the table named by the
--    discriminator. Keeps the relaxed FK honest without coupling to one table.
CREATE OR REPLACE FUNCTION public.blueprint_subscriptions_validate_ref()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.blueprint_system = 'timeline' THEN
    IF NOT EXISTS (SELECT 1 FROM public.timeline_blueprints t WHERE t.id = NEW.blueprint_id) THEN
      RAISE EXCEPTION 'blueprint_id % not found in timeline_blueprints (blueprint_system=timeline)', NEW.blueprint_id;
    END IF;
  ELSE
    -- institutional + marketplace both reference public.blueprints
    IF NOT EXISTS (SELECT 1 FROM public.blueprints b WHERE b.id = NEW.blueprint_id) THEN
      RAISE EXCEPTION 'blueprint_id % not found in blueprints (blueprint_system=%)', NEW.blueprint_id, NEW.blueprint_system;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS blueprint_subscriptions_validate_ref_trg ON public.blueprint_subscriptions;
CREATE TRIGGER blueprint_subscriptions_validate_ref_trg
  BEFORE INSERT OR UPDATE OF blueprint_id, blueprint_system
  ON public.blueprint_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.blueprint_subscriptions_validate_ref();

-- 4. Existing rows are all System-A; the column default already stamped them
--    'timeline'. Nothing to backfill for blueprint_system. target_interest_id
--    stays NULL (lenient reads treat NULL as the blueprint's authored interest).

COMMENT ON COLUMN public.blueprint_subscriptions.blueprint_system IS
  'Which table blueprint_id references: timeline=timeline_blueprints, institutional/marketplace=blueprints.';
COMMENT ON COLUMN public.blueprint_subscriptions.target_interest_id IS
  'Learner-chosen interest to file this plan under; NULL = the blueprint''s authored interest.';
COMMENT ON COLUMN public.blueprint_subscriptions.entry_granularity IS
  'Starting materialization choice at subscribe time: first | all | none. Not a permanent cap.';
