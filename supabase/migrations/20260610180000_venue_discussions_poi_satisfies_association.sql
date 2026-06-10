-- A POI-anchored knowledge post (hospital, haat, golf course…) has no venue
-- or community — the place itself is the association. The original CHECK
-- predates poi_id and rejected poi-only rows with 23514. The table carried
-- the same predicate twice under two names; keep one updated constraint.
ALTER TABLE venue_discussions
  DROP CONSTRAINT venue_discussions_has_association;

ALTER TABLE venue_discussions
  DROP CONSTRAINT IF EXISTS venue_or_community_required;

ALTER TABLE venue_discussions
  ADD CONSTRAINT venue_discussions_has_association
  CHECK (venue_id IS NOT NULL OR community_id IS NOT NULL OR poi_id IS NOT NULL);
