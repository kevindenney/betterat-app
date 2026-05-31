-- Global "default location sharing" preference.
--
-- The per-step precision control (PlanWhereCard) lets a user coarsen any one
-- step's coordinates. This adds a profile-level default so a privacy-conscious
-- user can set "approximate by default" once instead of per-step.
--
-- Stored on profiles alongside default_step_visibility. Applied server-side by
-- extending step_location_inherit_step_meta: when a location row is written
-- with no explicit precision, inherit the owner's default (NULL = exact via the
-- RPC's COALESCE, so the out-of-box behavior is unchanged).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_location_precision text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_default_location_precision_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_default_location_precision_check
  CHECK (
    default_location_precision IS NULL
    OR default_location_precision = ANY (ARRAY[
      'exact', 'site', 'neighborhood', 'hidden'
    ]::text[])
  );

-- Inherit audience + slug (existing) + precision (new) from the owner/parent
-- when not explicitly provided.
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
  IF NEW.location_precision IS NULL AND NEW.set_by IS NOT NULL THEN
    NEW.location_precision := (
      SELECT p.default_location_precision
      FROM public.profiles p
      WHERE p.id = NEW.set_by
    );
  END IF;
  RETURN NEW;
END;
$$;
