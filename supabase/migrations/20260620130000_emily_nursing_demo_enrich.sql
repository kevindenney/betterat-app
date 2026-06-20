-- Enrich Emily Rodriguez's JHU nursing demo (diagnose + seed).
--
-- Emily (37ac7510…, nursing interest bec249c5…) is the JHU nursing demo persona.
-- Her Practice screens looked thin/broken because of DATA defects, not code:
--   • all 18 timeline_steps had season_id=null and most were undated, so undated
--     "pending" steps floated into finished rotations → spurious NOW bars.
--   • no step carried metadata.plan.capability_goals / competency_ids / review →
--     empty Capability Mix, unclickable pills, "No pauses yet", anemic drift chart.
--   • all three rotation visions + the lifetime vision were null.
--   • the cohort was two Emily→Maya suggestions, one mislabeled with a golf title.
--   • three "Clinical shift · Johns Hopkins Hospital — East Baltimore" rows looked
--     copy-pasted.
--
-- This migration is idempotent (deterministic UUIDs, ON CONFLICT guards, fixed
-- VALUES) so it can be re-applied safely. It is DEV-ONLY demo data.

-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 1 — Visions
-- ───────────────────────────────────────────────────────────────────────────

-- Lifetime vision on the Plan entity (sourced by the program "ALL" zoom).
UPDATE plans
SET vision_statement =
  'Become an Acute Care Nurse Practitioner (AGACNP) who can stand at the bedside of the sickest patients and think clearly — reading a deteriorating patient early, titrating to the physiology in front of me, and leading the room through a code without losing the person in the bed.',
    updated_at = now()
WHERE id = '79661f72-d736-4012-90b2-313eca7871dd';

-- Same vision mirrored onto the interest (some surfaces read user_interests).
UPDATE user_interests
SET lifetime_vision_statement =
  'Become an Acute Care Nurse Practitioner (AGACNP) who can stand at the bedside of the sickest patients and think clearly — reading a deteriorating patient early, titrating to the physiology in front of me, and leading the room through a code without losing the person in the bed.'
WHERE user_id = '37ac7510-8a05-4f15-86ea-1d8714b6507d'
  AND interest_id = 'bec249c5-6412-4d16-bb84-bfcfb887ff67';

-- Per-rotation visions, in native nursing voice.
UPDATE seasons SET vision_statement =
  'Build the foundation: own a safe medication pass, a confident head-to-toe, and a clean SBAR handoff — the bedside fundamentals everything else is built on.',
  updated_at = now()
WHERE id = '2c33e372-f977-42e1-9659-b9a97a80c599';

UPDATE seasons SET vision_statement =
  'Care for the child and the family together — adjust assessment and teaching to developmental stage, and practice the cultural humility that family-centered peds demands.',
  updated_at = now()
WHERE id = '9807bb2c-a549-4c8c-9636-3e3bc4b7d042';

UPDATE seasons SET vision_statement =
  'Step up to high-acuity care: titrate vasoactive drips to the hemodynamics, run the ventilator bundle, read the ABG, and hold a role in a rapid response without freezing.',
  updated_at = now()
WHERE id = '1af20a8f-a953-416c-8adb-00c7710788ce';

-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 6a — Seed cohort people as real auth.users + profiles
-- (done early so later sections can reference them in collaborators / follows)
-- ───────────────────────────────────────────────────────────────────────────

INSERT INTO auth.users (id, instance_id, aud, role, email, email_confirmed_at,
                        created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('d3700000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','james.okafor@jhu-demo.edu', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"James Okafor","user_type":"student","demo_persona":true,"email_verified":true}'::jsonb),
  ('d3700000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','sofia.martinez@jhu-demo.edu', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Sofia Martinez","user_type":"student","demo_persona":true,"email_verified":true}'::jsonb),
  ('d3700000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','daniel.kim@jhu-demo.edu', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Daniel Kim","user_type":"student","demo_persona":true,"email_verified":true}'::jsonb),
  ('d3700000-0000-4000-8000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','patricia.nwosu@jhu-demo.edu', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Patricia Nwosu","user_type":"instructor","demo_persona":true,"email_verified":true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES
  (gen_random_uuid(),'d3700000-0000-4000-8000-000000000001','d3700000-0000-4000-8000-000000000001',
   '{"sub":"d3700000-0000-4000-8000-000000000001","email":"james.okafor@jhu-demo.edu","email_verified":true}'::jsonb,'email', now(), now(), now()),
  (gen_random_uuid(),'d3700000-0000-4000-8000-000000000002','d3700000-0000-4000-8000-000000000002',
   '{"sub":"d3700000-0000-4000-8000-000000000002","email":"sofia.martinez@jhu-demo.edu","email_verified":true}'::jsonb,'email', now(), now(), now()),
  (gen_random_uuid(),'d3700000-0000-4000-8000-000000000003','d3700000-0000-4000-8000-000000000003',
   '{"sub":"d3700000-0000-4000-8000-000000000003","email":"daniel.kim@jhu-demo.edu","email_verified":true}'::jsonb,'email', now(), now(), now()),
  (gen_random_uuid(),'d3700000-0000-4000-8000-00000000000a','d3700000-0000-4000-8000-00000000000a',
   '{"sub":"d3700000-0000-4000-8000-00000000000a","email":"patricia.nwosu@jhu-demo.edu","email_verified":true}'::jsonb,'email', now(), now(), now())
ON CONFLICT (provider, provider_id) DO NOTHING;

INSERT INTO profiles (id, email, full_name, first_name, last_name, organization,
                      profile_public, default_step_visibility, account_type)
VALUES
  ('d3700000-0000-4000-8000-000000000001','james.okafor@jhu-demo.edu','James Okafor','James','Okafor','Johns Hopkins School of Nursing', true, 'crew', 'individual'),
  ('d3700000-0000-4000-8000-000000000002','sofia.martinez@jhu-demo.edu','Sofia Martinez','Sofia','Martinez','Johns Hopkins School of Nursing', true, 'crew', 'individual'),
  ('d3700000-0000-4000-8000-000000000003','daniel.kim@jhu-demo.edu','Daniel Kim','Daniel','Kim','Johns Hopkins School of Nursing', true, 'crew', 'individual'),
  ('d3700000-0000-4000-8000-00000000000a','patricia.nwosu@jhu-demo.edu','Patricia Nwosu','Patricia','Nwosu','Johns Hopkins School of Nursing', true, 'crew', 'individual')
ON CONFLICT (id) DO UPDATE
  SET first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      full_name = EXCLUDED.full_name,
      organization = EXCLUDED.organization,
      profile_public = EXCLUDED.profile_public;

-- Backfill Maya's first/last so the suggestion + reflection panels render a
-- clean name (they prefer first_name+last_name over full_name).
UPDATE profiles SET first_name = 'Maya', last_name = 'Patel'
WHERE id = '023f2398-c3e9-4dc7-b126-07ab62cb26b7'
  AND (first_name IS NULL OR last_name IS NULL);

-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 2 + 3 + 4 — Existing 17 steps: link to rotation, date inside its
-- window, give every step a real status, rename the copy-pasted shifts, and
-- tag capability_goals + competency_ids + collaborators + a review.
--
-- Past rotations (Med-Surg, Peds) carry only completed/settled steps → no NOW
-- bar, no "planned" work. All competency_ids are drawn from Emily's existing
-- validated/competent progress so the program drift chart lights up.
-- ───────────────────────────────────────────────────────────────────────────

UPDATE timeline_steps t SET
  season_id  = v.season_id::uuid,
  starts_at  = v.starts_at::timestamptz,
  ends_at    = (v.starts_at::timestamptz + interval '8 hours'),
  status     = v.status,
  sort_order = v.sort_order,
  title      = v.title,
  category   = v.category,
  metadata   = jsonb_set(
                 jsonb_set(
                   coalesce(t.metadata, '{}'::jsonb),
                   '{plan}',
                   coalesce(t.metadata->'plan', '{}'::jsonb)
                     || jsonb_build_object(
                          'capability_goals', v.capability_goals::jsonb,
                          'competency_ids',   v.competency_ids::jsonb,
                          'collaborators',    v.collaborators::jsonb)),
                 '{review}', v.review::jsonb),
  updated_at = now()
FROM (VALUES
  -- ── MED-SURG (Apr) · season 2c33e372 ──────────────────────────────────────
  ('5513eb3f-5cf0-4b85-a064-4f2db5e019fe','2c33e372-f977-42e1-9659-b9a97a80c599','2026-04-03 11:00:00+00','completed',1,
   'Bedside fundamentals · vitals + hand hygiene','assessment',
   '["Assessment","Patient Safety"]',
   '["e7ed0955-728f-4121-9c23-21a0d1589d94","3110893e-6e62-efb3-ea3f-cb0c1cadf48d"]',
   '[{"id":"d3700000-0000-4000-8000-00000000000a","display_name":"Patricia Nwosu","role":"Preceptor","avatar_color":"#AF52DE"}]',
   '{"key_takeaway":"A full set of vitals is a story, not a checkbox — the trend matters more than any single number.","composed_at":"2026-04-03T17:00:00Z","sections":[{"title":"What went well","content":"Got into a rhythm with manual BP and counted respirations without the patient noticing."},{"title":"What I''d change","content":"Slow down on hand hygiene between patients — I rushed it twice when the floor got busy."}]}'),

  ('1bfc1c2c-19b5-48bf-ae60-fb0dedc82130','2c33e372-f977-42e1-9659-b9a97a80c599','2026-04-08 11:00:00+00','completed',2,
   'Clinical shift · 4West Med-Surg · Johns Hopkins','clinical',
   '["Assessment","Documentation"]',
   '["e7ed0955-728f-4121-9c23-21a0d1589d94","8528529f-c55b-19ac-bbef-ce81a9d4aad5"]',
   '[{"id":"d3700000-0000-4000-8000-000000000001","display_name":"James Okafor","avatar_color":"#34C759"},{"id":"d3700000-0000-4000-8000-00000000000a","display_name":"Patricia Nwosu","role":"Preceptor","avatar_color":"#AF52DE"}]',
   '{"key_takeaway":"Charting in real time instead of at end of shift kept my assessments honest and my handoff tight.","composed_at":"2026-04-08T20:00:00Z","sections":[{"title":"What went well","content":"Carried four patients and kept the whiteboard current for the whole team."}]}'),

  ('ecdc62c8-c54d-410d-bafe-c8ce73f00bba','2c33e372-f977-42e1-9659-b9a97a80c599','2026-04-10 11:00:00+00','settled',3,
   'Peripheral IV insertion · Med-Surg skills','procedure',
   '["Procedural Skills","Patient Safety"]',
   '["3110893e-6e62-efb3-ea3f-cb0c1cadf48d","db0c41c3-fdbd-3624-2fb6-ad988003c942"]',
   '[{"id":"d3700000-0000-4000-8000-000000000002","display_name":"Sofia Martinez","avatar_color":"#FF9500"}]',
   '{"key_takeaway":"Anchor the vein. My first two misses were both because I didn''t hold traction.","composed_at":"2026-04-10T15:00:00Z","sections":[{"title":"What I''d change","content":"Pick the AC last, not first — go distal so I have room to move up."}]}'),

  ('d3bb9c21-ea3b-48c7-8bc8-6ddfefc19616','2c33e372-f977-42e1-9659-b9a97a80c599','2026-04-12 11:00:00+00','settled',4,
   'Medication administration · oral + IV push','medication',
   '["Medication Safety","Clinical Reasoning"]',
   '["5b3c8d40-dbb9-2c38-fa09-c401db0c897b","1f16bf26-6e97-43eb-af07-95f40ee81544"]',
   '[]',
   '{"key_takeaway":"Knowing WHY a drug is ordered catches errors the five rights never will.","composed_at":"2026-04-12T16:00:00Z","sections":[{"title":"What went well","content":"Caught a metoprolol dose that didn''t fit the patient''s heart rate and held to call the provider."}]}'),

  ('c0f337cd-e916-4c38-8270-d9f88b2c838d','2c33e372-f977-42e1-9659-b9a97a80c599','2026-04-15 11:00:00+00','completed',5,
   'Medication safety · five rights','medication',
   '["Medication Safety"]',
   '["5b3c8d40-dbb9-2c38-fa09-c401db0c897b","1f16bf26-6e97-43eb-af07-95f40ee81544"]',
   '[{"id":"d3700000-0000-4000-8000-00000000000a","display_name":"Patricia Nwosu","role":"Preceptor","avatar_color":"#AF52DE"}]',
   '{"key_takeaway":"Scan, don''t assume. The barcode caught a look-alike vial I would have pulled.","composed_at":"2026-04-15T16:00:00Z","sections":[{"title":"What I''d change","content":"Reconcile the MAR before I walk in the room, not at the bedside."}]}'),

  ('24e33ea9-5094-4a16-8e08-3e6e8c506984','2c33e372-f977-42e1-9659-b9a97a80c599','2026-04-18 11:00:00+00','settled',6,
   'Focused cardiac assessment · telemetry','assessment',
   '["Assessment","Clinical Reasoning"]',
   '["e7ed0955-728f-4121-9c23-21a0d1589d94","b091255f-2169-6b38-bac5-22d6040ba504"]',
   '[]',
   '{"key_takeaway":"Heart sounds plus the monitor tell a fuller story than either alone.","composed_at":"2026-04-18T15:00:00Z","sections":[{"title":"What went well","content":"Picked up an irregular rhythm on auscultation before the telemetry alarm fired."}]}'),

  ('f33de2ae-bb7b-47db-9d45-7e95aa3e10d7','2c33e372-f977-42e1-9659-b9a97a80c599','2026-04-20 11:00:00+00','settled',7,
   'Shift handoff · SBAR report','communication',
   '["Patient Communication","Documentation"]',
   '["391effb7-74e2-20e6-1d70-b82e646924db","8528529f-c55b-19ac-bbef-ce81a9d4aad5"]',
   '[{"id":"d3700000-0000-4000-8000-000000000001","display_name":"James Okafor","avatar_color":"#34C759"}]',
   '{"key_takeaway":"A good handoff leads with the recommendation, not the backstory.","composed_at":"2026-04-20T19:30:00Z","sections":[{"title":"What I''d change","content":"Tighten the Situation line — I buried the lede on the patient who was trending septic."}]}'),

  ('19512262-7cd3-4289-a3ff-7a5ec24d00f1','2c33e372-f977-42e1-9659-b9a97a80c599','2026-04-25 11:00:00+00','completed',8,
   'Focused assessment · cardio / pulm','assessment',
   '["Assessment"]',
   '["e7ed0955-728f-4121-9c23-21a0d1589d94","b091255f-2169-6b38-bac5-22d6040ba504"]',
   '[]',
   '{"key_takeaway":"Auscultate before you touch anything else — a quiet base changed my whole plan.","composed_at":"2026-04-25T16:00:00Z","sections":[{"title":"What went well","content":"Caught decreased breath sounds that turned out to be an early effusion."}]}'),

  ('4a00f484-b460-4d85-a344-cb07063f7365','2c33e372-f977-42e1-9659-b9a97a80c599','2026-04-28 11:00:00+00','completed',9,
   'SBAR handoff · structured communication','communication',
   '["Patient Communication"]',
   '["391effb7-74e2-20e6-1d70-b82e646924db","77a49d8f-eba4-1917-2a88-e6f94175a408","dbdd5d6d-6d59-3dc9-1816-1d88a31b46af"]',
   '[{"id":"d3700000-0000-4000-8000-00000000000a","display_name":"Patricia Nwosu","role":"Preceptor","avatar_color":"#AF52DE"},{"id":"d3700000-0000-4000-8000-000000000003","display_name":"Daniel Kim","avatar_color":"#5856D6"}]',
   '{"key_takeaway":"Read-back isn''t optional — closing the loop is what makes a handoff safe.","composed_at":"2026-04-28T19:00:00Z","sections":[{"title":"What went well","content":"Practiced closed-loop with Daniel until the recommendation landed every time."}]}'),

  ('0fc14803-aad9-448e-8b42-334901bf1d3b','2c33e372-f977-42e1-9659-b9a97a80c599','2026-04-22 11:00:00+00','completed',10,
   'Clinical shift · Bayview ED · acute intake','clinical',
   '["Assessment","Patient Communication"]',
   '["e7ed0955-728f-4121-9c23-21a0d1589d94","8528529f-c55b-19ac-bbef-ce81a9d4aad5"]',
   '[{"id":"d3700000-0000-4000-8000-00000000000a","display_name":"Patricia Nwosu","role":"Preceptor","avatar_color":"#AF52DE"}]',
   '{"key_takeaway":"Triage is pattern recognition under time pressure — the sickest patient is rarely the loudest one.","composed_at":"2026-04-22T20:30:00Z","sections":[{"title":"What I learned","content":"Rotated through Bayview ED intake. Practiced rapid focused assessments and learned to prioritize by acuity rather than arrival order."}]}'),

  -- ── PEDIATRICS (May) · season 9807bb2c ────────────────────────────────────
  ('67363a44-e5ef-4051-b42b-038b6ae847ed','9807bb2c-a549-4c8c-9636-3e3bc4b7d042','2026-05-06 11:00:00+00','completed',1,
   'Clinical shift · Harriet Lane Clinic','clinical',
   '["Assessment","Family-Centered Care"]',
   '["e7ed0955-728f-4121-9c23-21a0d1589d94","3fd73dde-bbf2-3584-e0e5-938666a90c24"]',
   '[{"id":"d3700000-0000-4000-8000-00000000000a","display_name":"Patricia Nwosu","role":"Preceptor","avatar_color":"#AF52DE"},{"id":"d3700000-0000-4000-8000-000000000002","display_name":"Sofia Martinez","avatar_color":"#FF9500"}]',
   '{"key_takeaway":"Assess the child through the parent — the caregiver sees the baseline I can''t.","composed_at":"2026-05-06T18:00:00Z","sections":[{"title":"What went well","content":"Let mom hold the toddler during the exam and got a far better lung sound."}]}'),

  ('2b8f39df-4133-4b92-8f29-011a49f7ce60','9807bb2c-a549-4c8c-9636-3e3bc4b7d042','2026-05-09 11:00:00+00','settled',2,
   'Head-to-toe assessment · pediatric','assessment',
   '["Assessment"]',
   '["e7ed0955-728f-4121-9c23-21a0d1589d94"]',
   '[]',
   '{"key_takeaway":"Save the scary parts for last — ears and throat at the end keeps the kid cooperative.","composed_at":"2026-05-09T15:30:00Z","sections":[{"title":"What I''d change","content":"Warm the stethoscope. The flinch cost me a clean heart exam."}]}'),

  ('99026535-c5b8-45d7-ab8b-70d1427e830b','9807bb2c-a549-4c8c-9636-3e3bc4b7d042','2026-05-14 11:00:00+00','settled',3,
   'Foley catheter care · pediatric','procedure',
   '["Procedural Skills","Patient Safety"]',
   '["db0c41c3-fdbd-3624-2fb6-ad988003c942","3110893e-6e62-efb3-ea3f-cb0c1cadf48d"]',
   '[]',
   '{"key_takeaway":"Sterile field discipline is the whole procedure — everything else is mechanics.","composed_at":"2026-05-14T15:00:00Z","sections":[{"title":"What went well","content":"Kept the field clean even when the patient moved mid-insertion."}]}'),

  ('cb8ffb75-0b91-48bf-b72f-f7b7a1d519f0','9807bb2c-a549-4c8c-9636-3e3bc4b7d042','2026-05-20 11:00:00+00','completed',4,
   'Clinical shift · Wald Community Nursing Center','clinical',
   '["Family-Centered Care","Patient Communication"]',
   '["3fd73dde-bbf2-3584-e0e5-938666a90c24","c5a6baf6-bbed-8f25-8b06-86ae7bf4ad7d"]',
   '[{"id":"023f2398-c3e9-4dc7-b126-07ab62cb26b7","display_name":"Maya Patel","avatar_color":"#FF2D55"}]',
   '{"key_takeaway":"Teaching meets the family where they are — I switched to plain language and the plan finally stuck.","composed_at":"2026-05-20T18:30:00Z","sections":[{"title":"What went well","content":"Used a teach-back and caught a gap in how the parent was mixing formula."}]}'),

  ('af9bd331-81b5-4213-84ea-468bae2a9962','9807bb2c-a549-4c8c-9636-3e3bc4b7d042','2026-05-23 11:00:00+00','settled',5,
   'NG tube placement · pediatric feeding','procedure',
   '["Procedural Skills","Family-Centered Care"]',
   '["3110893e-6e62-efb3-ea3f-cb0c1cadf48d","3fd73dde-bbf2-3584-e0e5-938666a90c24"]',
   '[{"id":"d3700000-0000-4000-8000-00000000000a","display_name":"Patricia Nwosu","role":"Preceptor","avatar_color":"#AF52DE"}]',
   '{"key_takeaway":"Measure twice, confirm placement, then feed — never trust the first landmark.","composed_at":"2026-05-23T15:30:00Z","sections":[{"title":"What I''d change","content":"Explain each step to the parent before I do it — their calm keeps the child calm."}]}'),

  -- ── CRITICAL CARE (Jun) · season 1af20a8f · existing shifts, de-duped ──────
  ('10667c5b-6541-4fb2-8b1b-89ec5e29bd59','1af20a8f-a953-416c-8adb-00c7710788ce','2026-06-03 11:00:00+00','completed',1,
   'Clinical shift · MICU · high-acuity admissions','clinical',
   '["Critical Care","Assessment"]',
   '["e7ed0955-728f-4121-9c23-21a0d1589d94","b091255f-2169-6b38-bac5-22d6040ba504","3110893e-6e62-efb3-ea3f-cb0c1cadf48d"]',
   '[{"id":"d3700000-0000-4000-8000-00000000000a","display_name":"Patricia Nwosu","role":"Preceptor","avatar_color":"#AF52DE"},{"id":"d3700000-0000-4000-8000-000000000001","display_name":"James Okafor","avatar_color":"#34C759"}]',
   '{"key_takeaway":"In the MICU the assessment never stops — the patient I admitted stable was on pressors by hour three.","composed_at":"2026-06-03T20:00:00Z","sections":[{"title":"What went well","content":"Trended the lactate and flagged the downward MAP before the alarm."}]}'),

  ('32a4240b-d3a1-4975-9752-f9a51822f8be','1af20a8f-a953-416c-8adb-00c7710788ce','2026-06-10 11:00:00+00','completed',2,
   'Clinical shift · CVICU · post-op cardiac','clinical',
   '["Critical Care","Assessment"]',
   '["e7ed0955-728f-4121-9c23-21a0d1589d94","654de7ea-a9a4-c8ab-b47e-632384c71eab"]',
   '[{"id":"023f2398-c3e9-4dc7-b126-07ab62cb26b7","display_name":"Maya Patel","avatar_color":"#FF2D55"}]',
   '{"key_takeaway":"Post-op cardiac is a numbers game — chest tube output, rhythm, and labs read together or not at all.","composed_at":"2026-06-10T20:00:00Z","sections":[{"title":"What I''d change","content":"Anticipate the potassium replacement protocol instead of waiting for the order."}]}')
) AS v(id, season_id, starts_at, status, sort_order, title, category, capability_goals, competency_ids, collaborators, review)
WHERE t.id = v.id::uuid
  AND t.user_id = '37ac7510-8a05-4f15-86ea-1d8714b6507d';

-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 5 — More realistic Critical Care work (new dated steps).
-- Five completed (≤ today 2026-06-20) + three planned (after today) so the
-- current rotation has a real DONE / NOW / PLANNED spread and a full
-- Capability Mix.
-- ───────────────────────────────────────────────────────────────────────────

INSERT INTO timeline_steps
  (id, user_id, interest_id, season_id, source_type, category, status, visibility,
   title, description, starts_at, ends_at, sort_order, metadata)
VALUES
  ('d3710000-0000-4000-8000-000000000001','37ac7510-8a05-4f15-86ea-1d8714b6507d','bec249c5-6412-4d16-bb84-bfcfb887ff67','1af20a8f-a953-416c-8adb-00c7710788ce','manual','medication','completed','private',
   'Vasoactive drip titration · norepinephrine','Titrated norepinephrine to a MAP goal of 65 on a septic shock patient, with the preceptor at the bedside.',
   '2026-06-05 11:00:00+00','2026-06-05 19:00:00+00',3,
   '{"plan":{"capability_goals":["Critical Care","Medication Safety"],"competency_ids":["5b3c8d40-dbb9-2c38-fa09-c401db0c897b","1f16bf26-6e97-43eb-af07-95f40ee81544","b091255f-2169-6b38-bac5-22d6040ba504"],"collaborators":[{"id":"d3700000-0000-4000-8000-00000000000a","display_name":"Patricia Nwosu","role":"Preceptor","avatar_color":"#AF52DE"}]},"review":{"key_takeaway":"Titrate to the patient, not the pump — small changes, then wait a full cycle to read the MAP.","composed_at":"2026-06-05T19:30:00Z","sections":[{"title":"What went well","content":"Held my nerve and went up in small increments instead of chasing the number."}]}}'),

  ('d3710000-0000-4000-8000-000000000002','37ac7510-8a05-4f15-86ea-1d8714b6507d','bec249c5-6412-4d16-bb84-bfcfb887ff67','1af20a8f-a953-416c-8adb-00c7710788ce','manual','procedure','completed','private',
   'Ventilator bundle · VAP prevention','Ran the ventilator-associated pneumonia bundle: head of bed, oral care, sedation pause, DVT prophylaxis.',
   '2026-06-08 11:00:00+00','2026-06-08 19:00:00+00',4,
   '{"plan":{"capability_goals":["Critical Care","Patient Safety"],"competency_ids":["3110893e-6e62-efb3-ea3f-cb0c1cadf48d","db0c41c3-fdbd-3624-2fb6-ad988003c942"],"collaborators":[]},"review":{"key_takeaway":"The bundle is boring on purpose — every element is one less way the patient gets sicker.","composed_at":"2026-06-08T19:30:00Z","sections":[{"title":"What I''d change","content":"Do the sedation pause earlier in the shift so the team can round on it."}]}}'),

  ('d3710000-0000-4000-8000-000000000003','37ac7510-8a05-4f15-86ea-1d8714b6507d','bec249c5-6412-4d16-bb84-bfcfb887ff67','1af20a8f-a953-416c-8adb-00c7710788ce','manual','assessment','completed','private',
   'ABG interpretation · acid–base balance','Interpreted serial ABGs on a patient in respiratory failure and tied the trend to the vent changes.',
   '2026-06-12 11:00:00+00','2026-06-12 19:00:00+00',5,
   '{"plan":{"capability_goals":["Clinical Reasoning","Critical Care"],"competency_ids":["654de7ea-a9a4-c8ab-b47e-632384c71eab","b091255f-2169-6b38-bac5-22d6040ba504","36f03c12-8dab-7ec6-caf8-edb957bff322"],"collaborators":[{"id":"d3700000-0000-4000-8000-000000000003","display_name":"Daniel Kim","avatar_color":"#5856D6"}]},"review":{"key_takeaway":"Read the ABG as a story over time — one gas is a snapshot, three is a trajectory.","composed_at":"2026-06-12T19:30:00Z","sections":[{"title":"What went well","content":"Caught a compensating metabolic alkalosis Daniel and I almost read as improvement."}]}}'),

  ('d3710000-0000-4000-8000-000000000004','37ac7510-8a05-4f15-86ea-1d8714b6507d','bec249c5-6412-4d16-bb84-bfcfb887ff67','1af20a8f-a953-416c-8adb-00c7710788ce','manual','communication','completed','private',
   'Rapid response · early deterioration','Was first to the bedside on a rapid response and gave the SBAR when the team arrived.',
   '2026-06-16 11:00:00+00','2026-06-16 19:00:00+00',6,
   '{"plan":{"capability_goals":["Critical Care","Patient Communication"],"competency_ids":["391effb7-74e2-20e6-1d70-b82e646924db","77a49d8f-eba4-1917-2a88-e6f94175a408","dbdd5d6d-6d59-3dc9-1816-1d88a31b46af"],"collaborators":[{"id":"d3700000-0000-4000-8000-00000000000a","display_name":"Patricia Nwosu","role":"Preceptor","avatar_color":"#AF52DE"},{"id":"d3700000-0000-4000-8000-000000000001","display_name":"James Okafor","avatar_color":"#34C759"}]},"review":{"key_takeaway":"Calling it early is the skill — I''d rather run ten rapids that resolve than miss one.","composed_at":"2026-06-16T19:30:00Z","sections":[{"title":"What went well","content":"Gave a clean SBAR under pressure and the team had what they needed in 20 seconds."}]}}'),

  ('d3710000-0000-4000-8000-000000000005','37ac7510-8a05-4f15-86ea-1d8714b6507d','bec249c5-6412-4d16-bb84-bfcfb887ff67','1af20a8f-a953-416c-8adb-00c7710788ce','manual','procedure','completed','private',
   'Arterial line · hemodynamic monitoring','Assisted with an arterial line placement and managed the transducer, zeroing, and waveform.',
   '2026-06-18 11:00:00+00','2026-06-18 19:00:00+00',7,
   '{"plan":{"capability_goals":["Critical Care","Procedural Skills"],"competency_ids":["3110893e-6e62-efb3-ea3f-cb0c1cadf48d","572f2909-28c6-b6ed-f290-f23d02a3a692"],"collaborators":[]},"review":{"key_takeaway":"A bad waveform is bad data — level and zero before you trust a single pressure.","composed_at":"2026-06-18T19:30:00Z","sections":[{"title":"What I''d change","content":"Re-zero after every position change, not just once at the start of the shift."}]}}'),

  ('d3710000-0000-4000-8000-000000000006','37ac7510-8a05-4f15-86ea-1d8714b6507d','bec249c5-6412-4d16-bb84-bfcfb887ff67','1af20a8f-a953-416c-8adb-00c7710788ce','manual','communication','pending','private',
   'CVICU handoff · structured SBAR','Plan: lead a full CVICU-to-floor handoff using a structured SBAR with read-back.',
   '2026-06-23 11:00:00+00','2026-06-23 19:00:00+00',8,
   '{"plan":{"capability_goals":["Patient Communication","Documentation"],"competency_ids":["391effb7-74e2-20e6-1d70-b82e646924db","8528529f-c55b-19ac-bbef-ce81a9d4aad5","dbdd5d6d-6d59-3dc9-1816-1d88a31b46af"],"collaborators":[{"id":"d3700000-0000-4000-8000-00000000000a","display_name":"Patricia Nwosu","role":"Preceptor","avatar_color":"#AF52DE"}]}}'),

  ('d3710000-0000-4000-8000-000000000007','37ac7510-8a05-4f15-86ea-1d8714b6507d','bec249c5-6412-4d16-bb84-bfcfb887ff67','1af20a8f-a953-416c-8adb-00c7710788ce','manual','communication','pending','private',
   'Code blue simulation · ACLS roles','Plan: run the recorder and then the compressor role in the unit''s code blue simulation.',
   '2026-06-26 11:00:00+00','2026-06-26 19:00:00+00',9,
   '{"plan":{"capability_goals":["Critical Care","Patient Communication"],"competency_ids":["dbdd5d6d-6d59-3dc9-1816-1d88a31b46af","77a49d8f-eba4-1917-2a88-e6f94175a408"],"collaborators":[{"id":"d3700000-0000-4000-8000-000000000003","display_name":"Daniel Kim","avatar_color":"#5856D6"}]}}'),

  ('d3710000-0000-4000-8000-000000000008','37ac7510-8a05-4f15-86ea-1d8714b6507d','bec249c5-6412-4d16-bb84-bfcfb887ff67','1af20a8f-a953-416c-8adb-00c7710788ce','manual','medication','pending','private',
   'Sedation & analgesia · RASS titration','Plan: titrate sedation to a RASS goal and pair every change with a pain reassessment.',
   '2026-06-29 11:00:00+00','2026-06-29 19:00:00+00',10,
   '{"plan":{"capability_goals":["Critical Care","Medication Safety"],"competency_ids":["5b3c8d40-dbb9-2c38-fa09-c401db0c897b","1f16bf26-6e97-43eb-af07-95f40ee81544"],"collaborators":[]}}')
ON CONFLICT (id) DO UPDATE
  SET season_id = EXCLUDED.season_id,
      category = EXCLUDED.category,
      status = EXCLUDED.status,
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      starts_at = EXCLUDED.starts_at,
      ends_at = EXCLUDED.ends_at,
      sort_order = EXCLUDED.sort_order,
      metadata = EXCLUDED.metadata,
      updated_at = now();

-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 6b — Wire the cohort: follows, cohort membership, suggestions,
-- peer reflections; fix the golf-title suggestion.
-- ───────────────────────────────────────────────────────────────────────────

-- Mutual follows between Emily and her cohort (+ keep Maya).
INSERT INTO user_follows (follower_id, following_id) VALUES
  ('37ac7510-8a05-4f15-86ea-1d8714b6507d','d3700000-0000-4000-8000-000000000001'),
  ('d3700000-0000-4000-8000-000000000001','37ac7510-8a05-4f15-86ea-1d8714b6507d'),
  ('37ac7510-8a05-4f15-86ea-1d8714b6507d','d3700000-0000-4000-8000-000000000002'),
  ('d3700000-0000-4000-8000-000000000002','37ac7510-8a05-4f15-86ea-1d8714b6507d'),
  ('37ac7510-8a05-4f15-86ea-1d8714b6507d','d3700000-0000-4000-8000-000000000003'),
  ('d3700000-0000-4000-8000-000000000003','37ac7510-8a05-4f15-86ea-1d8714b6507d'),
  ('37ac7510-8a05-4f15-86ea-1d8714b6507d','d3700000-0000-4000-8000-00000000000a'),
  ('d3700000-0000-4000-8000-00000000000a','37ac7510-8a05-4f15-86ea-1d8714b6507d'),
  ('37ac7510-8a05-4f15-86ea-1d8714b6507d','023f2398-c3e9-4dc7-b126-07ab62cb26b7'),
  ('023f2398-c3e9-4dc7-b126-07ab62cb26b7','37ac7510-8a05-4f15-86ea-1d8714b6507d')
ON CONFLICT (follower_id, following_id) DO NOTHING;

-- Cohort membership in the existing BSN Class of 2027 — Cohort A.
INSERT INTO betterat_org_cohort_members (cohort_id, user_id, role) VALUES
  ('aac74235-1712-f6e5-b006-11e74e6e0c1b','37ac7510-8a05-4f15-86ea-1d8714b6507d','student'),
  ('aac74235-1712-f6e5-b006-11e74e6e0c1b','d3700000-0000-4000-8000-000000000001','student'),
  ('aac74235-1712-f6e5-b006-11e74e6e0c1b','d3700000-0000-4000-8000-000000000002','student'),
  ('aac74235-1712-f6e5-b006-11e74e6e0c1b','d3700000-0000-4000-8000-000000000003','student'),
  ('aac74235-1712-f6e5-b006-11e74e6e0c1b','023f2398-c3e9-4dc7-b126-07ab62cb26b7','student'),
  ('aac74235-1712-f6e5-b006-11e74e6e0c1b','d3700000-0000-4000-8000-00000000000a','preceptor')
ON CONFLICT (cohort_id, user_id) DO NOTHING;

-- Fix the mislabeled golf-title suggestion → a real nursing suggestion.
UPDATE step_suggestions SET
  suggested_title = 'Shadow a vasoactive drip titration',
  suggested_description = 'Come watch a norepinephrine titration in the MICU — best way to get comfortable before you do your own.',
  message = 'You''d pick this up fast — want to shadow my next MICU shift?',
  source_step_id = 'd3710000-0000-4000-8000-000000000001'
WHERE id = '04cde0cd-7b03-4664-8e75-9b8627a193b1';

-- Bidirectional suggestions: preceptor → Emily, students ↔ Emily.
-- created_at lands inside the relevant rotation window so each peer appears on
-- the right arc's cohort lane. Deterministic ids keep this idempotent.
INSERT INTO step_suggestions
  (id, source_user_id, target_user_id, source_step_id, suggested_title, suggested_description, status, created_at, message)
VALUES
  ('d3730000-0000-4000-8000-000000000001','d3700000-0000-4000-8000-00000000000a','37ac7510-8a05-4f15-86ea-1d8714b6507d', NULL,
   'Practice an ABG before your next MICU shift','Run three practice gases tonight — you''ll read the real ones faster tomorrow.','pending','2026-06-11 14:00:00+00',
   'You''re close on acid–base. Drill a few and it''ll click.'),
  ('d3730000-0000-4000-8000-000000000002','d3700000-0000-4000-8000-00000000000a','37ac7510-8a05-4f15-86ea-1d8714b6507d', NULL,
   'Lead the next rapid response SBAR','You did well today — next time take the SBAR yourself, I''ll back you up.','pending','2026-06-16 21:00:00+00',
   'You''re ready to lead the handoff in a rapid. I''ll be right there.'),
  ('d3730000-0000-4000-8000-000000000003','d3700000-0000-4000-8000-000000000001','37ac7510-8a05-4f15-86ea-1d8714b6507d', NULL,
   'Swap MICU notes before Friday','Want to compare our drip-titration logs? You caught things I missed.','pending','2026-06-13 16:00:00+00',
   'Your pressor notes are better than mine — trade?'),
  ('d3730000-0000-4000-8000-000000000004','37ac7510-8a05-4f15-86ea-1d8714b6507d','d3700000-0000-4000-8000-000000000003','d3710000-0000-4000-8000-000000000003',
   'Try reading ABGs as a trend','This helped me — line up three gases instead of staring at one.','pending','2026-06-13 17:00:00+00',
   'The serial-ABG trick made acid–base finally make sense for me.'),
  ('d3730000-0000-4000-8000-000000000005','37ac7510-8a05-4f15-86ea-1d8714b6507d','d3700000-0000-4000-8000-000000000002','d3710000-0000-4000-8000-000000000002',
   'Run the VAP bundle checklist','Saved this as a checklist — makes the bundle automatic on a busy shift.','pending','2026-06-09 15:00:00+00',
   'This kept me from skipping oral care when it got chaotic.')
ON CONFLICT (id) DO UPDATE
  SET suggested_title = EXCLUDED.suggested_title,
      suggested_description = EXCLUDED.suggested_description,
      source_step_id = EXCLUDED.source_step_id,
      status = EXCLUDED.status,
      created_at = EXCLUDED.created_at,
      message = EXCLUDED.message;

-- Peer reflections ON Emily's completed steps (status unread/read so the
-- timeline INPUT lane reads them). Deterministic ids → idempotent.
INSERT INTO peer_reflections
  (id, source_user_id, target_user_id, target_step_id, body, status, created_at)
VALUES
  ('d3720000-0000-4000-8000-000000000001','d3700000-0000-4000-8000-00000000000a','37ac7510-8a05-4f15-86ea-1d8714b6507d','d3710000-0000-4000-8000-000000000004',
   'You were calm and clear on that rapid — exactly the presence the team needs. Keep leading.','read','2026-06-16 20:30:00+00'),
  ('d3720000-0000-4000-8000-000000000002','d3700000-0000-4000-8000-000000000001','37ac7510-8a05-4f15-86ea-1d8714b6507d','d3710000-0000-4000-8000-000000000001',
   'Watching you hold steady on the norepi titration helped me stop chasing the MAP. Thanks for talking it through.','unread','2026-06-05 20:00:00+00'),
  ('d3720000-0000-4000-8000-000000000003','023f2398-c3e9-4dc7-b126-07ab62cb26b7','37ac7510-8a05-4f15-86ea-1d8714b6507d','32a4240b-d3a1-4975-9752-f9a51822f8be',
   'Your post-op cardiac handoff was so organized — I''m stealing your chest-tube-output-first order.','read','2026-06-10 21:00:00+00'),
  ('d3720000-0000-4000-8000-000000000004','d3700000-0000-4000-8000-000000000002','37ac7510-8a05-4f15-86ea-1d8714b6507d','67363a44-e5ef-4051-b42b-038b6ae847ed',
   'Letting the mom hold the toddler for the exam was a great call — totally changed the kid''s cooperation.','unread','2026-05-06 19:00:00+00')
ON CONFLICT (id) DO UPDATE
  SET body = EXCLUDED.body,
      status = EXCLUDED.status,
      target_step_id = EXCLUDED.target_step_id,
      created_at = EXCLUDED.created_at;
