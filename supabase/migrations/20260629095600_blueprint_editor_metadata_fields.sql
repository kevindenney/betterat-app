-- Persist Creator Studio overview pricing/about controls.

ALTER TABLE public.blueprints
  ADD COLUMN IF NOT EXISTS duration_value integer,
  ADD COLUMN IF NOT EXISTS duration_unit text NOT NULL DEFAULT 'weeks',
  ADD COLUMN IF NOT EXISTS skill_level text NOT NULL DEFAULT 'intermediate',
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'usd';

UPDATE public.blueprints
SET currency = lower(currency)
WHERE currency IS NOT NULL;

ALTER TABLE public.blueprints
  DROP CONSTRAINT IF EXISTS blueprints_duration_value_positive,
  ADD CONSTRAINT blueprints_duration_value_positive
    CHECK (duration_value IS NULL OR duration_value > 0),
  DROP CONSTRAINT IF EXISTS blueprints_duration_unit_check,
  ADD CONSTRAINT blueprints_duration_unit_check
    CHECK (duration_unit IN ('hours', 'days', 'weeks', 'months')),
  DROP CONSTRAINT IF EXISTS blueprints_skill_level_check,
  ADD CONSTRAINT blueprints_skill_level_check
    CHECK (skill_level IN ('introductory', 'intermediate', 'advanced')),
  DROP CONSTRAINT IF EXISTS blueprints_currency_check,
  ADD CONSTRAINT blueprints_currency_check
    CHECK (currency IN ('usd', 'hkd', 'gbp', 'eur', 'aud', 'cad', 'sgd'));
