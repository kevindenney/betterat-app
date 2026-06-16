-- Interest-aware profile descriptors.
--
-- The public face's hero subtitle and "Where X practises" section were built
-- from sailing-only columns (sailing_position/class/location/club +
-- seasons_active), so only sailors could describe themselves. Replace that
-- with a single flat jsonb bag keyed by field name; the interest-aware field
-- *config* lives in `lib/profile-descriptors.ts`. Keys are distinct per craft
-- except `location`, which is intentionally shared.
--
-- The old sailing_* columns are kept dormant (still read as a fallback during
-- transition); a later migration can drop them once all reads move over.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS descriptors JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Backfill existing sailing descriptors into the flat bag. jsonb_strip_nulls
-- drops keys with no value so a partially-filled profile doesn't get empty
-- strings. Merge (||) preserves anything already present.
UPDATE public.profiles
SET descriptors = descriptors || jsonb_strip_nulls(jsonb_build_object(
  'class', sailing_class,
  'position', sailing_position,
  'location', sailing_location,
  'club', sailing_club,
  'seasons', CASE WHEN seasons_active IS NOT NULL THEN seasons_active::text ELSE NULL END
))
WHERE sailing_class IS NOT NULL
   OR sailing_position IS NOT NULL
   OR sailing_location IS NOT NULL
   OR sailing_club IS NOT NULL
   OR seasons_active IS NOT NULL;
