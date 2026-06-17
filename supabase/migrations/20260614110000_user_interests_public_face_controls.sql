-- Public-face controls for per-interest profile visibility.
--
-- Later public-face RPC migrations order interests by `is_primary` then
-- `sort_order`, and hide rows where `is_active = false`. Add the columns and
-- owner UPDATE policy before those RPCs are created.

ALTER TABLE public.user_interests
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_user_interests_public_face_order
  ON public.user_interests(user_id, is_primary DESC, sort_order ASC);

DROP POLICY IF EXISTS "user_interests_update_own_v1" ON public.user_interests;
CREATE POLICY "user_interests_update_own_v1"
  ON public.user_interests FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Backfill deterministic ordering and a single lead interest per user.
WITH numbered AS (
  SELECT
    user_id,
    interest_id,
    row_number() OVER (PARTITION BY user_id ORDER BY added_at ASC, interest_id ASC) - 1 AS rn
  FROM public.user_interests
)
UPDATE public.user_interests ui
SET sort_order = numbered.rn
FROM numbered
WHERE numbered.user_id = ui.user_id
  AND numbered.interest_id = ui.interest_id
  AND ui.sort_order = 0;

-- Normalize any existing data: one active primary per user, preferring a row
-- already marked primary when present.
UPDATE public.user_interests
SET is_primary = false
WHERE is_active = false
  AND is_primary = true;

WITH ranked AS (
  SELECT
    user_id,
    interest_id,
    row_number() OVER (
      PARTITION BY user_id
      ORDER BY is_primary DESC, sort_order ASC, added_at ASC, interest_id ASC
    ) AS rn
  FROM public.user_interests
  WHERE is_active = true
)
UPDATE public.user_interests ui
SET is_primary = ranked.rn = 1
FROM ranked
WHERE ranked.user_id = ui.user_id
  AND ranked.interest_id = ui.interest_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_interests_one_primary_per_user
  ON public.user_interests(user_id)
  WHERE is_primary = true;

COMMENT ON COLUMN public.user_interests.is_active IS
  'Whether this interest appears on the person public face. Inactive rows remain part of the user interest set but are hidden publicly.';
COMMENT ON COLUMN public.user_interests.is_primary IS
  'Lead public-face interest. Sets the first interest in headline/chip ordering.';
COMMENT ON COLUMN public.user_interests.sort_order IS
  'Owner-controlled public-face interest ordering after the lead interest.';
