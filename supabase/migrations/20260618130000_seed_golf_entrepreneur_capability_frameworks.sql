-- Seed general capability frameworks for golf + entrepreneur.
--
-- These two interests had zero `betterat_competencies`, so the Atlas
-- "Capabilities" segment (useInterestCapabilityCoverage) had no framework to
-- roll evidence against and fell back to the generic general set. This authors
-- a standard-practice taxonomy for each (publicly-standardized craft skills,
-- not fabricated user data) so the ring renders a real per-interest denominator.
--
-- Idempotent: each interest's block only inserts when that interest has no
-- competencies yet, so re-running is a no-op and it never duplicates rows.

-- Golf — 88d576d7-2b21-4325-8c71-09e46a21d5bb
insert into betterat_competencies (interest_id, category, competency_number, title, sort_order)
select '88d576d7-2b21-4325-8c71-09e46a21d5bb'::uuid, category, competency_number, title, competency_number
from (values
  ('Full swing',        1,  'Grip, stance & alignment'),
  ('Full swing',        2,  'Posture & ball position'),
  ('Full swing',        3,  'Takeaway & backswing plane'),
  ('Full swing',        4,  'Downswing sequencing & impact'),
  ('Full swing',        5,  'Driver tee-shot consistency'),
  ('Short game',        6,  'Greenside chipping'),
  ('Short game',        7,  'Pitching distance control'),
  ('Short game',        8,  'Bunker & sand play'),
  ('Short game',        9,  'Flop & lob shots'),
  ('Short game',        10, 'Around-the-green club selection'),
  ('Putting',           11, 'Putting setup & stroke path'),
  ('Putting',           12, 'Lag & distance control'),
  ('Putting',           13, 'Reading green slope & break'),
  ('Putting',           14, 'Short-putt conversion'),
  ('Putting',           15, 'Pre-putt routine'),
  ('Course management', 16, 'Pre-round strategy & game plan'),
  ('Course management', 17, 'Club selection by distance & lie'),
  ('Course management', 18, 'Risk / reward shot decisions'),
  ('Course management', 19, 'Playing to position vs the pin'),
  ('Course management', 20, 'Scoring & stat tracking'),
  ('Mental game',       21, 'Pre-shot routine'),
  ('Mental game',       22, 'Focus & composure under pressure'),
  ('Mental game',       23, 'Recovering after a bad hole'),
  ('Mental game',       24, 'Visualization & commitment'),
  ('Mental game',       25, 'Practice planning & goal setting')
) as v(category, competency_number, title)
where not exists (
  select 1 from betterat_competencies
  where interest_id = '88d576d7-2b21-4325-8c71-09e46a21d5bb'::uuid
);

-- Entrepreneur — c0000000-0000-4000-8000-0000000000e1
insert into betterat_competencies (interest_id, category, competency_number, title, sort_order)
select 'c0000000-0000-4000-8000-0000000000e1'::uuid, category, competency_number, title, competency_number
from (values
  ('Product',    1,  'Customer discovery & interviews'),
  ('Product',    2,  'Problem / solution framing'),
  ('Product',    3,  'MVP definition & scoping'),
  ('Product',    4,  'Build–measure–learn iteration'),
  ('Product',    5,  'Reading product–market-fit signals'),
  ('Sales',      6,  'Prospecting & lead generation'),
  ('Sales',      7,  'Discovery & qualification'),
  ('Sales',      8,  'Pitching & demos'),
  ('Sales',      9,  'Handling objections'),
  ('Sales',      10, 'Closing & follow-up'),
  ('Marketing',  11, 'Positioning & messaging'),
  ('Marketing',  12, 'Channel selection'),
  ('Marketing',  13, 'Content & storytelling'),
  ('Marketing',  14, 'Brand & audience building'),
  ('Marketing',  15, 'Campaign measurement'),
  ('Operations', 16, 'Process design & documentation'),
  ('Operations', 17, 'Vendor & supplier management'),
  ('Operations', 18, 'Inventory & fulfillment'),
  ('Operations', 19, 'Team roles & delegation'),
  ('Operations', 20, 'Tools & workflow automation'),
  ('Finance',    21, 'Pricing & unit economics'),
  ('Finance',    22, 'Cash-flow management'),
  ('Finance',    23, 'Bookkeeping & records'),
  ('Finance',    24, 'Budgeting & forecasting'),
  ('Finance',    25, 'Fundraising & capital')
) as v(category, competency_number, title)
where not exists (
  select 1 from betterat_competencies
  where interest_id = 'c0000000-0000-4000-8000-0000000000e1'::uuid
);
