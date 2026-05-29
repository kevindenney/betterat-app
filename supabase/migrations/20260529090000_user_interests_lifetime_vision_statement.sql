-- Phase D bet 5 follow-up. The existing user_interests.vision_statement
-- is the user's current campaign / season / rotation goal — bounded
-- and tactical ("Finish top of HK worlds amongst the Hong Kong
-- dragons", "Land an ICU job at JHU in May"). It anchors L3.
--
-- L4 needs a different statement — the lifetime trajectory the
-- chapters ladder toward ("Race the Dragon Worlds every year through
-- age 60", "AGACNP DNP within 4 years"). Adding a separate optional
-- column so the two surfaces can carry honest, distinct statements
-- without one shadowing the other.
--
-- Already applied to the dev project via the Supabase MCP on
-- 2026-05-29; this file makes the migration reproducible from the
-- repo for any new environment.

ALTER TABLE public.user_interests
  ADD COLUMN IF NOT EXISTS lifetime_vision_statement text;

COMMENT ON COLUMN public.user_interests.lifetime_vision_statement IS
  'L4 anchor — the lifetime trajectory for this interest, distinct from the season-bound vision_statement that anchors L3.';
