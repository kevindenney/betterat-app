-- Topic chips were one global sailing list (Tactics, Currents, Marks…), so a
-- nurse or haat seller composing place knowledge picked from sailor vocabulary.
-- Scope tags per interest: NULL interest_slug = universal (Safety, Logistics),
-- otherwise the tag only surfaces when composing for that interest.
ALTER TABLE venue_topic_tags
  ADD COLUMN interest_slug text;

UPDATE venue_topic_tags
  SET interest_slug = 'sail-racing'
  WHERE name IN ('tactics', 'currents', 'marks', 'rules', 'weather', 'gear');

INSERT INTO venue_topic_tags (name, display_name, icon, color, sort_order, interest_slug) VALUES
  ('parking',       'Parking',            'car-outline',           '#0097A7', 20, 'nursing'),
  ('charge-desk',   'Charge desk',        'clipboard-outline',     '#0097A7', 21, 'nursing'),
  ('documentation', 'Documentation',      'document-text-outline', '#0097A7', 22, 'nursing'),
  ('units',         'Units',              'business-outline',      '#0097A7', 23, 'nursing'),
  ('preceptors',    'Preceptors',         'school-outline',        '#0097A7', 24, 'nursing'),
  ('greens',        'Greens',             'golf-outline',          '#15663B', 30, 'golf'),
  ('layout',        'Layout',             'map-outline',           '#15663B', 31, 'golf'),
  ('tee-times',     'Tee times',          'time-outline',          '#15663B', 32, 'golf'),
  ('practice',      'Practice',           'fitness-outline',       '#15663B', 33, 'golf'),
  ('prices',        'Prices · भाव',       'pricetag-outline',      '#B45309', 40, 'lac-craft-business'),
  ('buyers',        'Buyers · ख़रीदार',    'people-outline',        '#B45309', 41, 'lac-craft-business'),
  ('timing',        'Timing · समय',       'time-outline',          '#B45309', 42, 'lac-craft-business'),
  ('transport',     'Transport · ढुलाई',   'bus-outline',           '#B45309', 43, 'lac-craft-business');
