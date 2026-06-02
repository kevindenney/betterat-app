-- Fleet slug generation + is_public/visibility reconciliation.
--
-- fleets.slug carries a UNIQUE index (fleets_slug_key) but had no generator,
-- so every insert path (createFleet, seeds) left it NULL — 10 of 26 dev rows.
-- Postgres allows many NULLs in a unique index, so this stayed latent, but it
-- blocks any future slug-based fleet routing. Add a BEFORE INSERT trigger so
-- EVERY path gets a unique slug derived from the name, regardless of caller.
--
-- Separately, createFleet set visibility='public' but never is_public (NOT NULL
-- DEFAULT false), so 23 of 26 "public" fleets were invisible to the crew finder
-- (is_public gates non-member discovery). Reconcile existing rows; the app code
-- now sets is_public from the chosen visibility on create.
--
-- Idempotent: re-running generates no new slugs (none left NULL) and the
-- is_public UPDATE is a no-op once reconciled.
--
-- Applied to dev project qavekrwdbsobecwrfxwu.

-- 1. Slug generator: slugify(name), de-duplicated against existing slugs.
CREATE OR REPLACE FUNCTION public.fleets_set_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  base TEXT;
  candidate TEXT;
  n INT := 2;
BEGIN
  -- Respect an explicitly supplied slug.
  IF NEW.slug IS NOT NULL AND trim(NEW.slug) <> '' THEN
    RETURN NEW;
  END IF;

  base := regexp_replace(
            regexp_replace(lower(coalesce(nullif(trim(NEW.name), ''), 'fleet')),
                           '[^a-z0-9]+', '-', 'g'),
            '(^-+|-+$)', '', 'g');
  IF base = '' THEN
    base := 'fleet';
  END IF;

  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.fleets WHERE slug = candidate) LOOP
    candidate := base || '-' || n;
    n := n + 1;
  END LOOP;

  NEW.slug := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fleets_set_slug ON public.fleets;
CREATE TRIGGER trg_fleets_set_slug
  BEFORE INSERT ON public.fleets
  FOR EACH ROW
  EXECUTE FUNCTION public.fleets_set_slug();

-- 2. Backfill existing NULL slugs (same logic, one row at a time so the
--    uniqueness check sees slugs assigned earlier in the loop).
DO $$
DECLARE
  r RECORD;
  base TEXT;
  candidate TEXT;
  n INT;
BEGIN
  FOR r IN
    SELECT id, name FROM public.fleets WHERE slug IS NULL ORDER BY created_at
  LOOP
    base := regexp_replace(
              regexp_replace(lower(coalesce(nullif(trim(r.name), ''), 'fleet')),
                             '[^a-z0-9]+', '-', 'g'),
              '(^-+|-+$)', '', 'g');
    IF base = '' THEN
      base := 'fleet';
    END IF;

    candidate := base;
    n := 2;
    WHILE EXISTS (SELECT 1 FROM public.fleets WHERE slug = candidate) LOOP
      candidate := base || '-' || n;
      n := n + 1;
    END LOOP;

    UPDATE public.fleets SET slug = candidate WHERE id = r.id;
  END LOOP;
END;
$$;

-- 3. Reconcile discovery flag with access tier for existing rows.
UPDATE public.fleets
SET is_public = (visibility = 'public')
WHERE is_public IS DISTINCT FROM (visibility = 'public');
