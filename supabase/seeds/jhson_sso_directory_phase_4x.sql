-- JHSON SSO directory cache seed · what Okta would return for jh.edu
-- and jhmi.edu domains. 12 entries spanning BSN/MSN students,
-- faculty, and clinical preceptors. Idempotent (delete + reseed).

DELETE FROM public.org_sso_directory_cache
WHERE org_id = '678e149e-2abb-422c-ac61-b76756a2150e';

INSERT INTO public.org_sso_directory_cache
  (org_id, sso_user_id, email, first_name, last_name, role_hint, department, title)
VALUES
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'okta_jhson_001', 'maya.chen@jh.edu',       'Maya',     'Chen',     'student',    'School of Nursing', 'BSN candidate · Class of 2027'),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'okta_jhson_002', 'theo.nakamura@jh.edu',  'Theo',     'Nakamura', 'student',    'School of Nursing', 'BSN candidate · Class of 2027'),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'okta_jhson_003', 'amelia.santos@jh.edu',  'Amelia',   'Santos',   'student',    'School of Nursing', 'BSN candidate · Class of 2027'),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'okta_jhson_004', 'jordan.okafor@jh.edu',  'Jordan',   'Okafor',   'student',    'School of Nursing', 'BSN candidate · Class of 2027'),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'okta_jhson_005', 'sasha.brennan@jh.edu',  'Sasha',    'Brennan',  'student',    'School of Nursing', 'BSN candidate · Class of 2027'),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'okta_jhson_006', 'priya.iyer@jh.edu',     'Priya',    'Iyer',     'student',    'School of Nursing', 'MSN candidate · Acute care'),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'okta_jhson_007', 'andre.thiel@jh.edu',    'Andre',    'Thiel',    'student',    'School of Nursing', 'MSN candidate · Acute care'),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'okta_jhson_008', 'elena.cardoso@jh.edu',  'Elena',    'Cardoso',  'faculty',    'School of Nursing', 'Assistant Professor · Pediatrics'),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'okta_jhson_009', 's.ahmadi@jhmi.edu',     'Sami',     'Ahmadi',   'preceptor', 'Hopkins Hospital',  'Clinical preceptor · ICU'),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'okta_jhson_010', 'r.duvall@jhmi.edu',     'Rebecca',  'Duvall',   'preceptor', 'Hopkins Hospital',  'Clinical preceptor · ED'),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'okta_jhson_011', 'leo.zhang@jh.edu',      'Leo',      'Zhang',    'student',    'School of Nursing', 'BSN candidate · Class of 2028'),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'okta_jhson_012', 'kira.olafsson@jh.edu',  'Kira',     'Olafsson', 'student',    'School of Nursing', 'BSN candidate · Class of 2028');
