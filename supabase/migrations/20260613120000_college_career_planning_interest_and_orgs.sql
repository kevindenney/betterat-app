-- College & Career Planning interest + organizations a high-achieving
-- high schooler could join.
--
-- Two cohorts of orgs:
--   ASIA — Singapore, Hong Kong, Taiwan, Thailand admissions consultancies
--          and feeder schools for students targeting top global universities.
--   USA  — boutique college-counseling firms clustered in high-net-worth
--          metros (NYC, Greenwich, Boston, Silicon Valley, LA, DC).
--
-- Org coordinates are the firms' real head-office cities so Atlas/Discover
-- "Nearby" (25km bbox over organization_locations) lights up regionally.
-- Idempotent: ON CONFLICT guards + a location DELETE for re-runs.

-- ═══════════════════════════════════════════════════════
-- 0. INTEREST
-- ═══════════════════════════════════════════════════════

-- Allow the new slug on organizations.interest_slug
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_interest_slug_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_interest_slug_check
  CHECK (interest_slug = ANY (ARRAY[
    'general', 'nursing', 'sail-racing', 'drawing', 'design',
    'fitness', 'health-and-fitness', 'knitting', 'fiber-arts',
    'painting-printing', 'lifelong-learning', 'regenerative-agriculture',
    'global-health', 'self-mastery', 'lac-craft-business',
    'food-processing', 'textile-weaving',
    'college-career-planning'
  ]));

INSERT INTO interests (slug, name, type, status, visibility, accent_color, icon_name, description, parent_id)
VALUES (
  'college-career-planning',
  'College & Career Planning',
  'official', 'active', 'public',
  '#7C3AED', 'school',
  'Mapping the path from high school to a top university and a first career — coursework, testing, extracurriculars, essays, and applications.',
  (SELECT id FROM interests WHERE slug = 'education-learning')
)
ON CONFLICT (slug) DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- 1. ORGANIZATIONS — ASIA (high achievers)
-- ═══════════════════════════════════════════════════════

INSERT INTO organizations (id, name, slug, organization_type, join_mode, interest_slug, is_active)
VALUES
  -- Singapore
  ('cca10001-0000-4000-8000-000000000001', 'Crimson Education — Singapore',        'crimson-education-singapore',   'institution', 'open_join',       'college-career-planning', true),
  ('cca10002-0000-4000-8000-000000000002', 'Raffles Institution',                  'raffles-institution',           'institution', 'request_to_join', 'college-career-planning', true),
  ('cca10003-0000-4000-8000-000000000003', 'Hwa Chong Institution',                'hwa-chong-institution',         'institution', 'request_to_join', 'college-career-planning', true),
  -- Hong Kong
  ('cca10004-0000-4000-8000-000000000004', 'Crimson Education — Hong Kong',         'crimson-education-hong-kong',   'institution', 'open_join',       'college-career-planning', true),
  ('cca10005-0000-4000-8000-000000000005', 'ARCH Education',                        'arch-education-hong-kong',      'institution', 'open_join',       'college-career-planning', true),
  ('cca10006-0000-4000-8000-000000000006', 'ITS Education Asia',                    'its-education-asia',            'institution', 'open_join',       'college-career-planning', true),
  -- Taiwan
  ('cca10007-0000-4000-8000-000000000007', 'Ivy-Way Academy',                       'ivy-way-academy-taipei',        'institution', 'open_join',       'college-career-planning', true),
  ('cca10008-0000-4000-8000-000000000008', 'Crimson Education — Taiwan',            'crimson-education-taiwan',      'institution', 'open_join',       'college-career-planning', true),
  ('cca10009-0000-4000-8000-000000000009', 'Taipei American School',               'taipei-american-school',        'institution', 'request_to_join', 'college-career-planning', true),
  -- Thailand
  ('cca1000a-0000-4000-8000-00000000000a', 'Crimson Education — Bangkok',           'crimson-education-bangkok',     'institution', 'open_join',       'college-career-planning', true),
  ('cca1000b-0000-4000-8000-00000000000b', 'House of Griffin',                      'house-of-griffin-bangkok',      'institution', 'open_join',       'college-career-planning', true),
  ('cca1000c-0000-4000-8000-00000000000c', 'NIST International School',             'nist-international-school',     'institution', 'request_to_join', 'college-career-planning', true)
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- 2. ORGANIZATIONS — USA (high-net-worth metros)
-- ═══════════════════════════════════════════════════════

INSERT INTO organizations (id, name, slug, organization_type, join_mode, interest_slug, is_active)
VALUES
  ('ccc10001-0000-4000-8000-000000000001', 'IvyWise',                               'ivywise-new-york',              'institution', 'open_join', 'college-career-planning', true),
  ('ccc10002-0000-4000-8000-000000000002', 'Command Education',                     'command-education-new-york',    'institution', 'open_join', 'college-career-planning', true),
  ('ccc10003-0000-4000-8000-000000000003', 'Top Tier Admissions',                   'top-tier-admissions-boston',    'institution', 'open_join', 'college-career-planning', true),
  ('ccc10004-0000-4000-8000-000000000004', 'Spark Admissions',                      'spark-admissions-newton',       'institution', 'open_join', 'college-career-planning', true),
  ('ccc10005-0000-4000-8000-000000000005', 'Greenwich Education Group',             'greenwich-education-group',     'institution', 'open_join', 'college-career-planning', true),
  ('ccc10006-0000-4000-8000-000000000006', 'College Coach — Silicon Valley',        'college-coach-silicon-valley',  'institution', 'open_join', 'college-career-planning', true),
  ('ccc10007-0000-4000-8000-000000000007', 'Bespoke Education — Los Angeles',       'bespoke-education-los-angeles', 'institution', 'open_join', 'college-career-planning', true),
  ('ccc10008-0000-4000-8000-000000000008', 'DC College Counseling',                 'dc-college-counseling-bethesda','institution', 'open_join', 'college-career-planning', true)
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- 3. LOCATIONS (head-office cities, for Atlas "Nearby")
-- ═══════════════════════════════════════════════════════

DELETE FROM public.organization_locations
WHERE organization_id IN (
  'cca10001-0000-4000-8000-000000000001','cca10002-0000-4000-8000-000000000002',
  'cca10003-0000-4000-8000-000000000003','cca10004-0000-4000-8000-000000000004',
  'cca10005-0000-4000-8000-000000000005','cca10006-0000-4000-8000-000000000006',
  'cca10007-0000-4000-8000-000000000007','cca10008-0000-4000-8000-000000000008',
  'cca10009-0000-4000-8000-000000000009','cca1000a-0000-4000-8000-00000000000a',
  'cca1000b-0000-4000-8000-00000000000b','cca1000c-0000-4000-8000-00000000000c',
  'ccc10001-0000-4000-8000-000000000001','ccc10002-0000-4000-8000-000000000002',
  'ccc10003-0000-4000-8000-000000000003','ccc10004-0000-4000-8000-000000000004',
  'ccc10005-0000-4000-8000-000000000005','ccc10006-0000-4000-8000-000000000006',
  'ccc10007-0000-4000-8000-000000000007','ccc10008-0000-4000-8000-000000000008'
);

INSERT INTO public.organization_locations
  (organization_id, name, description, lat, lng, sort_order)
VALUES
  -- Singapore
  ('cca10001-0000-4000-8000-000000000001', 'Singapore Office',  'Raffles Place, Singapore',                 1.2843, 103.8511, 1),
  ('cca10002-0000-4000-8000-000000000002', 'Bishan Campus',     '1 Raffles Institution Lane, Singapore',    1.3536, 103.8420, 1),
  ('cca10003-0000-4000-8000-000000000003', 'Bukit Timah Campus','661 Bukit Timah Road, Singapore',          1.3257, 103.8030, 1),
  -- Hong Kong
  ('cca10004-0000-4000-8000-000000000004', 'Central Office',    'Central, Hong Kong',                       22.2820, 114.1588, 1),
  ('cca10005-0000-4000-8000-000000000005', 'Causeway Bay Office','Causeway Bay, Hong Kong',                 22.2800, 114.1850, 1),
  ('cca10006-0000-4000-8000-000000000006', 'Sheung Wan Office', 'Sheung Wan, Hong Kong',                    22.2860, 114.1500, 1),
  -- Taiwan
  ('cca10007-0000-4000-8000-000000000007', 'Taipei Center',     'Da’an District, Taipei, Taiwan',           25.0265, 121.5435, 1),
  ('cca10008-0000-4000-8000-000000000008', 'Taipei Office',     'Xinyi District, Taipei, Taiwan',           25.0330, 121.5654, 1),
  ('cca10009-0000-4000-8000-000000000009', 'Tianmu Campus',     '800 Section 6 Zhongshan N Road, Taipei',   25.1175, 121.5300, 1),
  -- Thailand
  ('cca1000a-0000-4000-8000-00000000000a', 'Bangkok Office',    'Pathum Wan, Bangkok, Thailand',            13.7440, 100.5340, 1),
  ('cca1000b-0000-4000-8000-00000000000b', 'Bangkok Office',    'Watthana, Bangkok, Thailand',              13.7307, 100.5700, 1),
  ('cca1000c-0000-4000-8000-00000000000c', 'Bangkok Campus',    '36 Sukhumvit 15, Bangkok, Thailand',       13.7400, 100.5618, 1),
  -- USA
  ('ccc10001-0000-4000-8000-000000000001', 'New York Office',   'Midtown Manhattan, New York, NY',          40.7549, -73.9840, 1),
  ('ccc10002-0000-4000-8000-000000000002', 'New York Office',   'Manhattan, New York, NY',                  40.7430, -73.9890, 1),
  ('ccc10003-0000-4000-8000-000000000003', 'Concord Office',    'Concord, MA (Greater Boston)',             42.4604, -71.3489, 1),
  ('ccc10004-0000-4000-8000-000000000004', 'Newton Office',     'Newton, MA (Greater Boston)',              42.3370, -71.2092, 1),
  ('ccc10005-0000-4000-8000-000000000005', 'Greenwich Office',  'Greenwich, CT',                            41.0262, -73.6282, 1),
  ('ccc10006-0000-4000-8000-000000000006', 'Palo Alto Office',  'Palo Alto, CA (Silicon Valley)',           37.4419, -122.1430, 1),
  ('ccc10007-0000-4000-8000-000000000007', 'Los Angeles Office','Beverly Hills / West LA, CA',              34.0700, -118.4000, 1),
  ('ccc10008-0000-4000-8000-000000000008', 'Bethesda Office',   'Bethesda, MD (Greater DC)',                38.9847, -77.0947, 1);

-- ═══════════════════════════════════════════════════════
-- 4. UNIVERSITY ADMISSIONS OFFICES (the targets students apply to)
--    US (Ivy + top privates/publics), UK (Oxbridge + London), Asia.
-- ═══════════════════════════════════════════════════════

INSERT INTO organizations (id, name, slug, organization_type, join_mode, interest_slug, is_active)
VALUES
  -- USA
  ('ccd10001-0000-4000-8000-000000000001', 'Harvard University',                              'harvard-university',            'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd10002-0000-4000-8000-000000000002', 'Yale University',                                 'yale-university',               'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd10003-0000-4000-8000-000000000003', 'Princeton University',                            'princeton-university',          'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd10004-0000-4000-8000-000000000004', 'Columbia University',                             'columbia-university',           'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd10005-0000-4000-8000-000000000005', 'University of Pennsylvania',                      'university-of-pennsylvania',    'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd10006-0000-4000-8000-000000000006', 'Brown University',                                'brown-university',              'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd10007-0000-4000-8000-000000000007', 'Dartmouth College',                               'dartmouth-college',             'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd10008-0000-4000-8000-000000000008', 'Cornell University',                              'cornell-university',            'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd10009-0000-4000-8000-000000000009', 'Stanford University',                             'stanford-university',           'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd1000a-0000-4000-8000-00000000000a', 'Massachusetts Institute of Technology',           'mit',                           'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd1000b-0000-4000-8000-00000000000b', 'California Institute of Technology',              'caltech',                       'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd1000c-0000-4000-8000-00000000000c', 'University of Chicago',                           'university-of-chicago',         'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd1000d-0000-4000-8000-00000000000d', 'Duke University',                                 'duke-university',               'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd1000e-0000-4000-8000-00000000000e', 'Northwestern University',                         'northwestern-university',       'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd1000f-0000-4000-8000-00000000000f', 'Johns Hopkins University',                        'johns-hopkins-university',      'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd10010-0000-4000-8000-000000000010', 'University of California, Berkeley',              'uc-berkeley',                   'institution', 'request_to_join', 'college-career-planning', true),
  -- UK
  ('ccd20001-0000-4000-8000-000000000001', 'University of Oxford',                            'university-of-oxford',          'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd20002-0000-4000-8000-000000000002', 'University of Cambridge',                         'university-of-cambridge',       'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd20003-0000-4000-8000-000000000003', 'Imperial College London',                         'imperial-college-london',       'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd20004-0000-4000-8000-000000000004', 'London School of Economics',                      'lse',                           'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd20005-0000-4000-8000-000000000005', 'University College London',                       'ucl',                           'institution', 'request_to_join', 'college-career-planning', true),
  -- Asia
  ('ccd30001-0000-4000-8000-000000000001', 'National University of Singapore',                'national-university-singapore', 'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd30002-0000-4000-8000-000000000002', 'Nanyang Technological University',                'nanyang-technological-university','institution','request_to_join', 'college-career-planning', true),
  ('ccd30003-0000-4000-8000-000000000003', 'University of Hong Kong',                          'university-of-hong-kong',       'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd30004-0000-4000-8000-000000000004', 'Hong Kong University of Science and Technology',  'hkust',                         'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd30005-0000-4000-8000-000000000005', 'University of Tokyo',                              'university-of-tokyo',           'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd30006-0000-4000-8000-000000000006', 'National Taiwan University',                       'national-taiwan-university',    'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd30007-0000-4000-8000-000000000007', 'Tsinghua University',                              'tsinghua-university',           'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd30008-0000-4000-8000-000000000008', 'Peking University',                                'peking-university',             'institution', 'request_to_join', 'college-career-planning', true)
ON CONFLICT (id) DO NOTHING;

DELETE FROM public.organization_locations
WHERE organization_id IN (
  'ccd10001-0000-4000-8000-000000000001','ccd10002-0000-4000-8000-000000000002',
  'ccd10003-0000-4000-8000-000000000003','ccd10004-0000-4000-8000-000000000004',
  'ccd10005-0000-4000-8000-000000000005','ccd10006-0000-4000-8000-000000000006',
  'ccd10007-0000-4000-8000-000000000007','ccd10008-0000-4000-8000-000000000008',
  'ccd10009-0000-4000-8000-000000000009','ccd1000a-0000-4000-8000-00000000000a',
  'ccd1000b-0000-4000-8000-00000000000b','ccd1000c-0000-4000-8000-00000000000c',
  'ccd1000d-0000-4000-8000-00000000000d','ccd1000e-0000-4000-8000-00000000000e',
  'ccd1000f-0000-4000-8000-00000000000f','ccd10010-0000-4000-8000-000000000010',
  'ccd20001-0000-4000-8000-000000000001','ccd20002-0000-4000-8000-000000000002',
  'ccd20003-0000-4000-8000-000000000003','ccd20004-0000-4000-8000-000000000004',
  'ccd20005-0000-4000-8000-000000000005','ccd30001-0000-4000-8000-000000000001',
  'ccd30002-0000-4000-8000-000000000002','ccd30003-0000-4000-8000-000000000003',
  'ccd30004-0000-4000-8000-000000000004','ccd30005-0000-4000-8000-000000000005',
  'ccd30006-0000-4000-8000-000000000006','ccd30007-0000-4000-8000-000000000007',
  'ccd30008-0000-4000-8000-000000000008'
);

INSERT INTO public.organization_locations
  (organization_id, name, description, lat, lng, sort_order)
VALUES
  ('ccd10001-0000-4000-8000-000000000001', 'Office of Admissions', 'Cambridge, MA, USA',        42.3744,  -71.1182, 1),
  ('ccd10002-0000-4000-8000-000000000002', 'Office of Admissions', 'New Haven, CT, USA',        41.3163,  -72.9223, 1),
  ('ccd10003-0000-4000-8000-000000000003', 'Office of Admission',  'Princeton, NJ, USA',        40.3431,  -74.6551, 1),
  ('ccd10004-0000-4000-8000-000000000004', 'Office of Admissions', 'New York, NY, USA',         40.8075,  -73.9626, 1),
  ('ccd10005-0000-4000-8000-000000000005', 'Office of Admissions', 'Philadelphia, PA, USA',     39.9522,  -75.1932, 1),
  ('ccd10006-0000-4000-8000-000000000006', 'Office of Admission',  'Providence, RI, USA',       41.8268,  -71.4025, 1),
  ('ccd10007-0000-4000-8000-000000000007', 'Office of Admissions', 'Hanover, NH, USA',          43.7044,  -72.2887, 1),
  ('ccd10008-0000-4000-8000-000000000008', 'Office of Admissions', 'Ithaca, NY, USA',           42.4534,  -76.4735, 1),
  ('ccd10009-0000-4000-8000-000000000009', 'Office of Admission',  'Stanford, CA, USA',         37.4275, -122.1697, 1),
  ('ccd1000a-0000-4000-8000-00000000000a', 'Office of Admissions', 'Cambridge, MA, USA',        42.3601,  -71.0942, 1),
  ('ccd1000b-0000-4000-8000-00000000000b', 'Office of Admissions', 'Pasadena, CA, USA',         34.1377, -118.1253, 1),
  ('ccd1000c-0000-4000-8000-00000000000c', 'Office of Admissions', 'Chicago, IL, USA',          41.7886,  -87.5987, 1),
  ('ccd1000d-0000-4000-8000-00000000000d', 'Office of Admissions', 'Durham, NC, USA',           36.0014,  -78.9382, 1),
  ('ccd1000e-0000-4000-8000-00000000000e', 'Office of Admission',  'Evanston, IL, USA',         42.0565,  -87.6753, 1),
  ('ccd1000f-0000-4000-8000-00000000000f', 'Office of Admissions', 'Baltimore, MD, USA',        39.3299,  -76.6205, 1),
  ('ccd10010-0000-4000-8000-000000000010', 'Office of Admissions', 'Berkeley, CA, USA',         37.8719, -122.2585, 1),
  ('ccd20001-0000-4000-8000-000000000001', 'Admissions',           'Oxford, UK',                51.7548,   -1.2544, 1),
  ('ccd20002-0000-4000-8000-000000000002', 'Admissions',           'Cambridge, UK',             52.2043,    0.1149, 1),
  ('ccd20003-0000-4000-8000-000000000003', 'Admissions',           'London, UK',                51.4988,   -0.1749, 1),
  ('ccd20004-0000-4000-8000-000000000004', 'Admissions',           'London, UK',                51.5144,   -0.1165, 1),
  ('ccd20005-0000-4000-8000-000000000005', 'Admissions',           'London, UK',                51.5246,   -0.1340, 1),
  ('ccd30001-0000-4000-8000-000000000001', 'Office of Admissions', 'Singapore',                  1.2966,  103.7764, 1),
  ('ccd30002-0000-4000-8000-000000000002', 'Office of Admissions', 'Singapore',                  1.3483,  103.6831, 1),
  ('ccd30003-0000-4000-8000-000000000003', 'Office of Admissions', 'Pok Fu Lam, Hong Kong',     22.2830,  114.1370, 1),
  ('ccd30004-0000-4000-8000-000000000004', 'Office of Admissions', 'Clear Water Bay, Hong Kong',22.3364,  114.2654, 1),
  ('ccd30005-0000-4000-8000-000000000005', 'Admissions',           'Bunkyo, Tokyo, Japan',      35.7128,  139.7621, 1),
  ('ccd30006-0000-4000-8000-000000000006', 'Office of Admissions', 'Taipei, Taiwan',            25.0174,  121.5405, 1),
  ('ccd30007-0000-4000-8000-000000000007', 'Admissions',           'Beijing, China',            40.0007,  116.3264, 1),
  ('ccd30008-0000-4000-8000-000000000008', 'Admissions',           'Beijing, China',            39.9920,  116.3057, 1);

-- ═══════════════════════════════════════════════════════
-- 5. MORE UNIVERSITIES — UK Russell Group, Australia Go8, Canada
-- ═══════════════════════════════════════════════════════

INSERT INTO organizations (id, name, slug, organization_type, join_mode, interest_slug, is_active)
VALUES
  -- UK (additional Russell Group)
  ('ccd40001-0000-4000-8000-000000000001', 'University of Edinburgh',          'university-of-edinburgh',     'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd40002-0000-4000-8000-000000000002', 'King''s College London',          'kings-college-london',        'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd40003-0000-4000-8000-000000000003', 'University of Manchester',         'university-of-manchester',    'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd40004-0000-4000-8000-000000000004', 'University of Warwick',            'university-of-warwick',       'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd40005-0000-4000-8000-000000000005', 'University of Bristol',            'university-of-bristol',       'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd40006-0000-4000-8000-000000000006', 'Durham University',                'durham-university',           'institution', 'request_to_join', 'college-career-planning', true),
  -- Australia (Group of Eight)
  ('ccd50001-0000-4000-8000-000000000001', 'University of Melbourne',          'university-of-melbourne',     'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd50002-0000-4000-8000-000000000002', 'Australian National University',   'australian-national-university','institution','request_to_join', 'college-career-planning', true),
  ('ccd50003-0000-4000-8000-000000000003', 'University of Sydney',             'university-of-sydney',        'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd50004-0000-4000-8000-000000000004', 'University of New South Wales',    'unsw-sydney',                 'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd50005-0000-4000-8000-000000000005', 'University of Queensland',         'university-of-queensland',    'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd50006-0000-4000-8000-000000000006', 'Monash University',                'monash-university',           'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd50007-0000-4000-8000-000000000007', 'University of Western Australia',  'university-of-western-australia','institution','request_to_join', 'college-career-planning', true),
  ('ccd50008-0000-4000-8000-000000000008', 'University of Adelaide',           'university-of-adelaide',      'institution', 'request_to_join', 'college-career-planning', true),
  -- Canada
  ('ccd60001-0000-4000-8000-000000000001', 'University of Toronto',            'university-of-toronto',       'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd60002-0000-4000-8000-000000000002', 'McGill University',                'mcgill-university',           'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd60003-0000-4000-8000-000000000003', 'University of British Columbia',   'university-of-british-columbia','institution','request_to_join', 'college-career-planning', true),
  ('ccd60004-0000-4000-8000-000000000004', 'University of Waterloo',           'university-of-waterloo',      'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd60005-0000-4000-8000-000000000005', 'McMaster University',              'mcmaster-university',         'institution', 'request_to_join', 'college-career-planning', true)
ON CONFLICT (id) DO NOTHING;

DELETE FROM public.organization_locations
WHERE organization_id IN (
  'ccd40001-0000-4000-8000-000000000001','ccd40002-0000-4000-8000-000000000002',
  'ccd40003-0000-4000-8000-000000000003','ccd40004-0000-4000-8000-000000000004',
  'ccd40005-0000-4000-8000-000000000005','ccd40006-0000-4000-8000-000000000006',
  'ccd50001-0000-4000-8000-000000000001','ccd50002-0000-4000-8000-000000000002',
  'ccd50003-0000-4000-8000-000000000003','ccd50004-0000-4000-8000-000000000004',
  'ccd50005-0000-4000-8000-000000000005','ccd50006-0000-4000-8000-000000000006',
  'ccd50007-0000-4000-8000-000000000007','ccd50008-0000-4000-8000-000000000008',
  'ccd60001-0000-4000-8000-000000000001','ccd60002-0000-4000-8000-000000000002',
  'ccd60003-0000-4000-8000-000000000003','ccd60004-0000-4000-8000-000000000004',
  'ccd60005-0000-4000-8000-000000000005'
);

INSERT INTO public.organization_locations
  (organization_id, name, description, lat, lng, sort_order)
VALUES
  ('ccd40001-0000-4000-8000-000000000001', 'Admissions',           'Edinburgh, UK',            55.9445,  -3.1892, 1),
  ('ccd40002-0000-4000-8000-000000000002', 'Admissions',           'London, UK',               51.5115,  -0.1160, 1),
  ('ccd40003-0000-4000-8000-000000000003', 'Admissions',           'Manchester, UK',           53.4668,  -2.2339, 1),
  ('ccd40004-0000-4000-8000-000000000004', 'Admissions',           'Coventry, UK',             52.3793,  -1.5615, 1),
  ('ccd40005-0000-4000-8000-000000000005', 'Admissions',           'Bristol, UK',              51.4585,  -2.6021, 1),
  ('ccd40006-0000-4000-8000-000000000006', 'Admissions',           'Durham, UK',               54.7674,  -1.5740, 1),
  ('ccd50001-0000-4000-8000-000000000001', 'Admissions',           'Melbourne, VIC, Australia',-37.7964, 144.9612, 1),
  ('ccd50002-0000-4000-8000-000000000002', 'Admissions',           'Canberra, ACT, Australia', -35.2777, 149.1185, 1),
  ('ccd50003-0000-4000-8000-000000000003', 'Admissions',           'Sydney, NSW, Australia',   -33.8886, 151.1873, 1),
  ('ccd50004-0000-4000-8000-000000000004', 'Admissions',           'Sydney, NSW, Australia',   -33.9173, 151.2313, 1),
  ('ccd50005-0000-4000-8000-000000000005', 'Admissions',           'Brisbane, QLD, Australia', -27.4975, 153.0137, 1),
  ('ccd50006-0000-4000-8000-000000000006', 'Admissions',           'Melbourne, VIC, Australia',-37.9105, 145.1362, 1),
  ('ccd50007-0000-4000-8000-000000000007', 'Admissions',           'Perth, WA, Australia',     -31.9803, 115.8175, 1),
  ('ccd50008-0000-4000-8000-000000000008', 'Admissions',           'Adelaide, SA, Australia',  -34.9209, 138.6045, 1),
  ('ccd60001-0000-4000-8000-000000000001', 'Office of Admissions', 'Toronto, ON, Canada',       43.6629,  -79.3957, 1),
  ('ccd60002-0000-4000-8000-000000000002', 'Admissions',           'Montreal, QC, Canada',      45.5048,  -73.5772, 1),
  ('ccd60003-0000-4000-8000-000000000003', 'Admissions',           'Vancouver, BC, Canada',     49.2606, -123.2460, 1),
  ('ccd60004-0000-4000-8000-000000000004', 'Admissions',           'Waterloo, ON, Canada',      43.4723,  -80.5449, 1),
  ('ccd60005-0000-4000-8000-000000000005', 'Admissions',           'Hamilton, ON, Canada',      43.2609,  -79.9192, 1);

-- ═══════════════════════════════════════════════════════
-- 6. MORE UNIVERSITIES — more top US, Europe, more of Asia
-- ═══════════════════════════════════════════════════════

INSERT INTO organizations (id, name, slug, organization_type, join_mode, interest_slug, is_active)
VALUES
  -- USA (more top targets)
  ('ccd70001-0000-4000-8000-000000000001', 'University of California, Los Angeles', 'ucla',                    'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd70002-0000-4000-8000-000000000002', 'University of Michigan',                'university-of-michigan',  'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd70003-0000-4000-8000-000000000003', 'Vanderbilt University',                 'vanderbilt-university',   'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd70004-0000-4000-8000-000000000004', 'Rice University',                       'rice-university',         'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd70005-0000-4000-8000-000000000005', 'Washington University in St. Louis',    'wustl',                   'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd70006-0000-4000-8000-000000000006', 'University of Notre Dame',              'university-of-notre-dame','institution', 'request_to_join', 'college-career-planning', true),
  ('ccd70007-0000-4000-8000-000000000007', 'Georgetown University',                 'georgetown-university',   'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd70008-0000-4000-8000-000000000008', 'Carnegie Mellon University',            'carnegie-mellon-university','institution','request_to_join', 'college-career-planning', true),
  ('ccd70009-0000-4000-8000-000000000009', 'New York University',                   'new-york-university',     'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd7000a-0000-4000-8000-00000000000a', 'University of Southern California',      'usc',                     'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd7000b-0000-4000-8000-00000000000b', 'University of Virginia',                'university-of-virginia',  'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd7000c-0000-4000-8000-00000000000c', 'University of North Carolina at Chapel Hill', 'unc-chapel-hill',   'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd7000d-0000-4000-8000-00000000000d', 'Emory University',                      'emory-university',        'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd7000e-0000-4000-8000-00000000000e', 'Georgia Institute of Technology',       'georgia-tech',            'institution', 'request_to_join', 'college-career-planning', true),
  -- Europe
  ('ccd80001-0000-4000-8000-000000000001', 'ETH Zurich',                            'eth-zurich',              'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd80002-0000-4000-8000-000000000002', 'EPFL',                                  'epfl',                    'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd80003-0000-4000-8000-000000000003', 'Sciences Po',                           'sciences-po',             'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd80004-0000-4000-8000-000000000004', 'Bocconi University',                    'bocconi-university',      'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd80005-0000-4000-8000-000000000005', 'Delft University of Technology',        'tu-delft',                'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd80006-0000-4000-8000-000000000006', 'Sorbonne University',                   'sorbonne-university',     'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd80007-0000-4000-8000-000000000007', 'LMU Munich',                            'lmu-munich',              'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd80008-0000-4000-8000-000000000008', 'Heidelberg University',                 'heidelberg-university',   'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd80009-0000-4000-8000-000000000009', 'KU Leuven',                             'ku-leuven',               'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd8000a-0000-4000-8000-00000000000a', 'Trinity College Dublin',               'trinity-college-dublin',  'institution', 'request_to_join', 'college-career-planning', true),
  -- Asia (more)
  ('ccd90001-0000-4000-8000-000000000001', 'Seoul National University',             'seoul-national-university','institution','request_to_join', 'college-career-planning', true),
  ('ccd90002-0000-4000-8000-000000000002', 'KAIST',                                 'kaist',                   'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd90003-0000-4000-8000-000000000003', 'Yonsei University',                     'yonsei-university',       'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd90004-0000-4000-8000-000000000004', 'Kyoto University',                      'kyoto-university',        'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd90005-0000-4000-8000-000000000005', 'The Chinese University of Hong Kong',   'cuhk',                    'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd90006-0000-4000-8000-000000000006', 'Fudan University',                      'fudan-university',        'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd90007-0000-4000-8000-000000000007', 'Shanghai Jiao Tong University',         'shanghai-jiao-tong-university','institution','request_to_join','college-career-planning', true),
  ('ccd90008-0000-4000-8000-000000000008', 'Indian Institute of Technology Bombay', 'iit-bombay',              'institution', 'request_to_join', 'college-career-planning', true),
  ('ccd90009-0000-4000-8000-000000000009', 'Indian Institute of Technology Delhi',  'iit-delhi',               'institution', 'request_to_join', 'college-career-planning', true)
ON CONFLICT (id) DO NOTHING;

DELETE FROM public.organization_locations
WHERE organization_id IN (
  'ccd70001-0000-4000-8000-000000000001','ccd70002-0000-4000-8000-000000000002',
  'ccd70003-0000-4000-8000-000000000003','ccd70004-0000-4000-8000-000000000004',
  'ccd70005-0000-4000-8000-000000000005','ccd70006-0000-4000-8000-000000000006',
  'ccd70007-0000-4000-8000-000000000007','ccd70008-0000-4000-8000-000000000008',
  'ccd70009-0000-4000-8000-000000000009','ccd7000a-0000-4000-8000-00000000000a',
  'ccd7000b-0000-4000-8000-00000000000b','ccd7000c-0000-4000-8000-00000000000c',
  'ccd7000d-0000-4000-8000-00000000000d','ccd7000e-0000-4000-8000-00000000000e',
  'ccd80001-0000-4000-8000-000000000001','ccd80002-0000-4000-8000-000000000002',
  'ccd80003-0000-4000-8000-000000000003','ccd80004-0000-4000-8000-000000000004',
  'ccd80005-0000-4000-8000-000000000005','ccd80006-0000-4000-8000-000000000006',
  'ccd80007-0000-4000-8000-000000000007','ccd80008-0000-4000-8000-000000000008',
  'ccd80009-0000-4000-8000-000000000009','ccd8000a-0000-4000-8000-00000000000a',
  'ccd90001-0000-4000-8000-000000000001','ccd90002-0000-4000-8000-000000000002',
  'ccd90003-0000-4000-8000-000000000003','ccd90004-0000-4000-8000-000000000004',
  'ccd90005-0000-4000-8000-000000000005','ccd90006-0000-4000-8000-000000000006',
  'ccd90007-0000-4000-8000-000000000007','ccd90008-0000-4000-8000-000000000008',
  'ccd90009-0000-4000-8000-000000000009'
);

INSERT INTO public.organization_locations
  (organization_id, name, description, lat, lng, sort_order)
VALUES
  ('ccd70001-0000-4000-8000-000000000001', 'Office of Admission',  'Los Angeles, CA, USA',     34.0689, -118.4452, 1),
  ('ccd70002-0000-4000-8000-000000000002', 'Office of Admissions', 'Ann Arbor, MI, USA',       42.2780,  -83.7382, 1),
  ('ccd70003-0000-4000-8000-000000000003', 'Office of Admissions', 'Nashville, TN, USA',       36.1447,  -86.8027, 1),
  ('ccd70004-0000-4000-8000-000000000004', 'Office of Admission',  'Houston, TX, USA',         29.7174,  -95.4018, 1),
  ('ccd70005-0000-4000-8000-000000000005', 'Office of Admissions', 'St. Louis, MO, USA',       38.6488,  -90.3108, 1),
  ('ccd70006-0000-4000-8000-000000000006', 'Office of Admissions', 'Notre Dame, IN, USA',      41.7052,  -86.2353, 1),
  ('ccd70007-0000-4000-8000-000000000007', 'Office of Admissions', 'Washington, DC, USA',      38.9076,  -77.0723, 1),
  ('ccd70008-0000-4000-8000-000000000008', 'Office of Admission',  'Pittsburgh, PA, USA',      40.4433,  -79.9436, 1),
  ('ccd70009-0000-4000-8000-000000000009', 'Office of Admissions', 'New York, NY, USA',        40.7295,  -73.9965, 1),
  ('ccd7000a-0000-4000-8000-00000000000a', 'Office of Admission',  'Los Angeles, CA, USA',     34.0224, -118.2851, 1),
  ('ccd7000b-0000-4000-8000-00000000000b', 'Office of Admission',  'Charlottesville, VA, USA', 38.0336,  -78.5080, 1),
  ('ccd7000c-0000-4000-8000-00000000000c', 'Office of Admissions', 'Chapel Hill, NC, USA',     35.9049,  -79.0469, 1),
  ('ccd7000d-0000-4000-8000-00000000000d', 'Office of Admission',  'Atlanta, GA, USA',         33.7925,  -84.3240, 1),
  ('ccd7000e-0000-4000-8000-00000000000e', 'Office of Admission',  'Atlanta, GA, USA',         33.7756,  -84.3963, 1),
  ('ccd80001-0000-4000-8000-000000000001', 'Admissions',           'Zurich, Switzerland',      47.3763,    8.5476, 1),
  ('ccd80002-0000-4000-8000-000000000002', 'Admissions',           'Lausanne, Switzerland',    46.5191,    6.5668, 1),
  ('ccd80003-0000-4000-8000-000000000003', 'Admissions',           'Paris, France',            48.8543,    2.3290, 1),
  ('ccd80004-0000-4000-8000-000000000004', 'Admissions',           'Milan, Italy',             45.4474,    9.1881, 1),
  ('ccd80005-0000-4000-8000-000000000005', 'Admissions',           'Delft, Netherlands',       51.9988,    4.3733, 1),
  ('ccd80006-0000-4000-8000-000000000006', 'Admissions',           'Paris, France',            48.8462,    2.3560, 1),
  ('ccd80007-0000-4000-8000-000000000007', 'Admissions',           'Munich, Germany',          48.1505,   11.5800, 1),
  ('ccd80008-0000-4000-8000-000000000008', 'Admissions',           'Heidelberg, Germany',      49.4108,    8.7060, 1),
  ('ccd80009-0000-4000-8000-000000000009', 'Admissions',           'Leuven, Belgium',          50.8788,    4.7005, 1),
  ('ccd8000a-0000-4000-8000-00000000000a', 'Admissions',           'Dublin, Ireland',          53.3438,   -6.2546, 1),
  ('ccd90001-0000-4000-8000-000000000001', 'Office of Admissions', 'Seoul, South Korea',       37.4599,  126.9519, 1),
  ('ccd90002-0000-4000-8000-000000000002', 'Office of Admissions', 'Daejeon, South Korea',     36.3724,  127.3604, 1),
  ('ccd90003-0000-4000-8000-000000000003', 'Office of Admissions', 'Seoul, South Korea',       37.5665,  126.9388, 1),
  ('ccd90004-0000-4000-8000-000000000004', 'Admissions',           'Kyoto, Japan',             35.0262,  135.7809, 1),
  ('ccd90005-0000-4000-8000-000000000005', 'Office of Admissions', 'Sha Tin, Hong Kong',       22.4196,  114.2069, 1),
  ('ccd90006-0000-4000-8000-000000000006', 'Admissions',           'Shanghai, China',          31.2990,  121.5036, 1),
  ('ccd90007-0000-4000-8000-000000000007', 'Admissions',           'Shanghai, China',          31.0257,  121.4358, 1),
  ('ccd90008-0000-4000-8000-000000000008', 'Admissions',           'Mumbai, India',            19.1334,   72.9133, 1),
  ('ccd90009-0000-4000-8000-000000000009', 'Admissions',           'New Delhi, India',         28.5450,   77.1926, 1);

-- ═══════════════════════════════════════════════════════
-- 7. MORE UNIVERSITIES — US liberal arts, Latin America, Middle East, more Asia
-- ═══════════════════════════════════════════════════════

INSERT INTO organizations (id, name, slug, organization_type, join_mode, interest_slug, is_active)
VALUES
  -- US liberal-arts colleges
  ('cce10001-0000-4000-8000-000000000001', 'Williams College',              'williams-college',          'institution', 'request_to_join', 'college-career-planning', true),
  ('cce10002-0000-4000-8000-000000000002', 'Amherst College',               'amherst-college',           'institution', 'request_to_join', 'college-career-planning', true),
  ('cce10003-0000-4000-8000-000000000003', 'Swarthmore College',            'swarthmore-college',        'institution', 'request_to_join', 'college-career-planning', true),
  ('cce10004-0000-4000-8000-000000000004', 'Pomona College',                'pomona-college',            'institution', 'request_to_join', 'college-career-planning', true),
  ('cce10005-0000-4000-8000-000000000005', 'Wellesley College',             'wellesley-college',         'institution', 'request_to_join', 'college-career-planning', true),
  ('cce10006-0000-4000-8000-000000000006', 'Bowdoin College',               'bowdoin-college',           'institution', 'request_to_join', 'college-career-planning', true),
  ('cce10007-0000-4000-8000-000000000007', 'Claremont McKenna College',     'claremont-mckenna-college', 'institution', 'request_to_join', 'college-career-planning', true),
  ('cce10008-0000-4000-8000-000000000008', 'Middlebury College',            'middlebury-college',        'institution', 'request_to_join', 'college-career-planning', true),
  ('cce10009-0000-4000-8000-000000000009', 'Carleton College',              'carleton-college',          'institution', 'request_to_join', 'college-career-planning', true),
  ('cce1000a-0000-4000-8000-00000000000a', 'Vassar College',                'vassar-college',            'institution', 'request_to_join', 'college-career-planning', true),
  -- Latin America
  ('cce20001-0000-4000-8000-000000000001', 'Tecnológico de Monterrey',      'tec-de-monterrey',          'institution', 'request_to_join', 'college-career-planning', true),
  ('cce20002-0000-4000-8000-000000000002', 'ITAM',                          'itam',                      'institution', 'request_to_join', 'college-career-planning', true),
  ('cce20003-0000-4000-8000-000000000003', 'Universidad Nacional Autónoma de México', 'unam',            'institution', 'request_to_join', 'college-career-planning', true),
  ('cce20004-0000-4000-8000-000000000004', 'Universidade de São Paulo',     'usp',                       'institution', 'request_to_join', 'college-career-planning', true),
  ('cce20005-0000-4000-8000-000000000005', 'Pontificia Universidad Católica de Chile', 'puc-chile',      'institution', 'request_to_join', 'college-career-planning', true),
  ('cce20006-0000-4000-8000-000000000006', 'Universidad de los Andes',      'universidad-de-los-andes',  'institution', 'request_to_join', 'college-career-planning', true),
  -- Middle East
  ('cce30001-0000-4000-8000-000000000001', 'NYU Abu Dhabi',                 'nyu-abu-dhabi',             'institution', 'request_to_join', 'college-career-planning', true),
  ('cce30002-0000-4000-8000-000000000002', 'KAUST',                         'kaust',                     'institution', 'request_to_join', 'college-career-planning', true),
  ('cce30003-0000-4000-8000-000000000003', 'American University of Beirut', 'american-university-of-beirut','institution','request_to_join','college-career-planning', true),
  ('cce30004-0000-4000-8000-000000000004', 'Technion – Israel Institute of Technology', 'technion',      'institution', 'request_to_join', 'college-career-planning', true),
  ('cce30005-0000-4000-8000-000000000005', 'Tel Aviv University',           'tel-aviv-university',       'institution', 'request_to_join', 'college-career-planning', true),
  ('cce30006-0000-4000-8000-000000000006', 'Hebrew University of Jerusalem','hebrew-university-jerusalem','institution', 'request_to_join', 'college-career-planning', true),
  -- Asia (more)
  ('cce40001-0000-4000-8000-000000000001', 'Tokyo Institute of Technology', 'tokyo-tech',                'institution', 'request_to_join', 'college-career-planning', true),
  ('cce40002-0000-4000-8000-000000000002', 'Indian Institute of Science',   'iisc-bangalore',            'institution', 'request_to_join', 'college-career-planning', true),
  ('cce40003-0000-4000-8000-000000000003', 'Osaka University',              'osaka-university',          'institution', 'request_to_join', 'college-career-planning', true),
  ('cce40004-0000-4000-8000-000000000004', 'Korea University',              'korea-university',          'institution', 'request_to_join', 'college-career-planning', true),
  ('cce40005-0000-4000-8000-000000000005', 'National Cheng Kung University','national-cheng-kung-university','institution','request_to_join','college-career-planning', true)
ON CONFLICT (id) DO NOTHING;

DELETE FROM public.organization_locations
WHERE organization_id IN (
  'cce10001-0000-4000-8000-000000000001','cce10002-0000-4000-8000-000000000002',
  'cce10003-0000-4000-8000-000000000003','cce10004-0000-4000-8000-000000000004',
  'cce10005-0000-4000-8000-000000000005','cce10006-0000-4000-8000-000000000006',
  'cce10007-0000-4000-8000-000000000007','cce10008-0000-4000-8000-000000000008',
  'cce10009-0000-4000-8000-000000000009','cce1000a-0000-4000-8000-00000000000a',
  'cce20001-0000-4000-8000-000000000001','cce20002-0000-4000-8000-000000000002',
  'cce20003-0000-4000-8000-000000000003','cce20004-0000-4000-8000-000000000004',
  'cce20005-0000-4000-8000-000000000005','cce20006-0000-4000-8000-000000000006',
  'cce30001-0000-4000-8000-000000000001','cce30002-0000-4000-8000-000000000002',
  'cce30003-0000-4000-8000-000000000003','cce30004-0000-4000-8000-000000000004',
  'cce30005-0000-4000-8000-000000000005','cce30006-0000-4000-8000-000000000006',
  'cce40001-0000-4000-8000-000000000001','cce40002-0000-4000-8000-000000000002',
  'cce40003-0000-4000-8000-000000000003','cce40004-0000-4000-8000-000000000004',
  'cce40005-0000-4000-8000-000000000005'
);

INSERT INTO public.organization_locations
  (organization_id, name, description, lat, lng, sort_order)
VALUES
  ('cce10001-0000-4000-8000-000000000001', 'Office of Admission',  'Williamstown, MA, USA',    42.7128,  -73.2037, 1),
  ('cce10002-0000-4000-8000-000000000002', 'Office of Admission',  'Amherst, MA, USA',         42.3709,  -72.5170, 1),
  ('cce10003-0000-4000-8000-000000000003', 'Office of Admissions', 'Swarthmore, PA, USA',      39.9054,  -75.3538, 1),
  ('cce10004-0000-4000-8000-000000000004', 'Office of Admissions', 'Claremont, CA, USA',       34.0975, -117.7117, 1),
  ('cce10005-0000-4000-8000-000000000005', 'Office of Admission',  'Wellesley, MA, USA',       42.2928,  -71.3062, 1),
  ('cce10006-0000-4000-8000-000000000006', 'Office of Admissions', 'Brunswick, ME, USA',       43.9075,  -69.9637, 1),
  ('cce10007-0000-4000-8000-000000000007', 'Office of Admission',  'Claremont, CA, USA',       34.1015, -117.7070, 1),
  ('cce10008-0000-4000-8000-000000000008', 'Office of Admissions', 'Middlebury, VT, USA',      44.0082,  -73.1773, 1),
  ('cce10009-0000-4000-8000-000000000009', 'Office of Admissions', 'Northfield, MN, USA',      44.4609,  -93.1538, 1),
  ('cce1000a-0000-4000-8000-00000000000a', 'Office of Admission',  'Poughkeepsie, NY, USA',    41.6864,  -73.8957, 1),
  ('cce20001-0000-4000-8000-000000000001', 'Admisiones',           'Monterrey, Mexico',        25.6515, -100.2897, 1),
  ('cce20002-0000-4000-8000-000000000002', 'Admisiones',           'Mexico City, Mexico',      19.3457,  -99.1957, 1),
  ('cce20003-0000-4000-8000-000000000003', 'Admisiones',           'Mexico City, Mexico',      19.3324,  -99.1869, 1),
  ('cce20004-0000-4000-8000-000000000004', 'Admissões',            'São Paulo, Brazil',       -23.5595,  -46.7313, 1),
  ('cce20005-0000-4000-8000-000000000005', 'Admisiones',           'Santiago, Chile',         -33.4983,  -70.6116, 1),
  ('cce20006-0000-4000-8000-000000000006', 'Admisiones',           'Bogota, Colombia',          4.6018,  -74.0661, 1),
  ('cce30001-0000-4000-8000-000000000001', 'Admissions',           'Abu Dhabi, UAE',           24.5238,   54.4344, 1),
  ('cce30002-0000-4000-8000-000000000002', 'Admissions',           'Thuwal, Saudi Arabia',     22.3095,   39.1047, 1),
  ('cce30003-0000-4000-8000-000000000003', 'Office of Admissions', 'Beirut, Lebanon',          33.9006,   35.4811, 1),
  ('cce30004-0000-4000-8000-000000000004', 'Admissions',           'Haifa, Israel',            32.7775,   35.0231, 1),
  ('cce30005-0000-4000-8000-000000000005', 'Admissions',           'Tel Aviv, Israel',         32.1133,   34.8044, 1),
  ('cce30006-0000-4000-8000-000000000006', 'Admissions',           'Jerusalem, Israel',        31.7959,   35.2417, 1),
  ('cce40001-0000-4000-8000-000000000001', 'Admissions',           'Tokyo, Japan',             35.6053,  139.6837, 1),
  ('cce40002-0000-4000-8000-000000000002', 'Admissions',           'Bangalore, India',         13.0219,   77.5671, 1),
  ('cce40003-0000-4000-8000-000000000003', 'Admissions',           'Osaka, Japan',             34.8225,  135.5239, 1),
  ('cce40004-0000-4000-8000-000000000004', 'Office of Admissions', 'Seoul, South Korea',       37.5894,  127.0327, 1),
  ('cce40005-0000-4000-8000-000000000005', 'Office of Admissions', 'Tainan, Taiwan',           22.9999,  120.2186, 1);
