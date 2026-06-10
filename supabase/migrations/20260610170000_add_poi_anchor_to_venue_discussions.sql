-- Place local knowledge: generalize the venue_discussions geo-anchor beyond
-- sailing. Posts can now anchor to an atlas_pois row (hospital, haat, market,
-- supplier, golf course, …) instead of a sailing racing area. A post carries at
-- most ONE place anchor; sailing keeps racing_area_id because user-authored
-- areas live in venue_racing_areas, not atlas_pois.
-- Audience scoping (scope_type/scope_id) and RLS are anchor-agnostic — no
-- policy changes here. Spec: docs/redesign/specs/PLACE_LOCAL_KNOWLEDGE_SPEC.md

ALTER TABLE venue_discussions
  ADD COLUMN poi_id uuid REFERENCES atlas_pois(id) ON DELETE SET NULL;

ALTER TABLE venue_discussions
  ADD CONSTRAINT venue_discussions_single_anchor
  CHECK (racing_area_id IS NULL OR poi_id IS NULL);

CREATE INDEX idx_venue_discussions_poi ON venue_discussions(poi_id)
  WHERE poi_id IS NOT NULL;
