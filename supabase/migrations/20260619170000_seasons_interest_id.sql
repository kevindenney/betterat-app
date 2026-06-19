-- Scope seasons to an interest.
--
-- `seasons` is a sailing/race-series-era table that was never tied to an
-- interest, so the Practice header's "current season" was resolved globally
-- per user (status='active'). A nursing student whose active season is
-- "Critical Care Rotation" saw that label bleed across EVERY interest —
-- Entrepreneur, Golf, sailing — because nothing filtered by the active
-- interest. This adds the missing link so a season belongs to one interest.

ALTER TABLE seasons
  ADD COLUMN IF NOT EXISTS interest_id UUID REFERENCES interests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_seasons_interest_id ON seasons(interest_id);

-- Backfill: a season's interest is the dominant interest of the steps tagged
-- to it (timeline_steps.season_id). Seasons with no tagged steps stay NULL and
-- are treated as "global" (shown under any interest) by the read path.
WITH season_interest AS (
  SELECT DISTINCT ON (ts.season_id)
    ts.season_id,
    ts.interest_id,
    count(*) AS step_count
  FROM timeline_steps ts
  WHERE ts.season_id IS NOT NULL
    AND ts.interest_id IS NOT NULL
  GROUP BY ts.season_id, ts.interest_id
  ORDER BY ts.season_id, count(*) DESC
)
UPDATE seasons s
SET interest_id = si.interest_id
FROM season_interest si
WHERE s.id = si.season_id
  AND s.interest_id IS NULL;
