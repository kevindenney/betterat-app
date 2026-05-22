-- Seed competency frameworks for the two demo orgs.
-- Run after 20260523000000_org_competencies_phase_4c.sql has applied.
-- Idempotent via the (org_id, short_label) unique constraint.

-- JHSON · nursing (8 competencies)
INSERT INTO public.org_competencies
  (org_id, short_label, full_label, category, description, display_order)
VALUES
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'IV', 'IV insertion · supervised', 'Procedural',
   'Place a peripheral IV with supervising preceptor present. First five attempts must be supervised.', 1),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'Med admin', 'Medication administration', 'Procedural',
   'Five rights of medication administration in real clinical setting.', 2),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'H2T', 'Head-to-toe assessment', 'Assessment',
   'Complete head-to-toe physical assessment on a patient and document findings.', 3),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'Handoff', 'ISBAR handoff communication', 'Communication',
   'Lead a shift handoff using ISBAR framework. Mentor-reviewed.', 4),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'Teach-back', 'Discharge teach-back', 'Communication',
   'Conduct discharge teach-back using plain-language method; verify patient understanding.', 5),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'Foley', 'Foley catheter placement', 'Procedural',
   'Insert indwelling urinary catheter using sterile technique.', 6),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'NG tube', 'NG tube placement', 'Procedural',
   'Place nasogastric tube and verify placement.', 7),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'Cardiac', 'Cardiac telemetry interpretation', 'Assessment',
   'Interpret a 6-second cardiac strip and identify normal sinus + 3 common arrhythmias.', 8)
ON CONFLICT (org_id, short_label) DO NOTHING;

-- RHKYC · sail-racing (5 competencies)
INSERT INTO public.org_competencies
  (org_id, short_label, full_label, category, description, display_order)
VALUES
  ('a1000001-0000-0000-0000-000000000001', 'Start', 'Pre-start positioning', 'Tactics',
   'Hit the line at full speed within 2 seconds of the gun.', 1),
  ('a1000001-0000-0000-0000-000000000001', 'Mark', 'Mark rounding under pressure', 'Boathandling',
   'Round a mark in close quarters without losing height or speed.', 2),
  ('a1000001-0000-0000-0000-000000000001', 'Cover', 'Tactical covering', 'Tactics',
   'Maintain a loose vs tight cover on a trailing boat as conditions change.', 3),
  ('a1000001-0000-0000-0000-000000000001', 'Spin', 'Spinnaker set + douse', 'Boathandling',
   'Execute a clean bear-away set and a clean douse without wraps.', 4),
  ('a1000001-0000-0000-0000-000000000001', 'Layline', 'Layline judgment', 'Tactics',
   'Call the layline within one boatlength under variable current + breeze.', 5)
ON CONFLICT (org_id, short_label) DO NOTHING;
