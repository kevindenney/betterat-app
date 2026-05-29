-- Home venue anchors the Discover/Watch/Atlas "Nearby" surfaces on a
-- coordinate. Clubs carry no lat/lng, so we anchor on a sailing_venues
-- row (text id, e.g. "osm-way-...") and snapshot its coords + name so
-- reads are a single-table lookup with no join.
alter table public.sailor_profiles
  add column if not exists home_venue_id   text,
  add column if not exists home_venue_name text,
  add column if not exists home_venue_lat  double precision,
  add column if not exists home_venue_lng  double precision;
