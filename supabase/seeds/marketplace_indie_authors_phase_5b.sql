-- Phase 5b · two independent authors + blueprints on the marketplace
--
-- Until this seed, the marketplace had a single listing (Noor Aziz's
-- Discharge teach-back). The catalog UI was designed for a rail of
-- featured + grid of others — with one item, neither showed real
-- structure. This adds two more author identities + blueprints with
-- full step templates so the surface paints a populated marketplace.
--
-- The Stripe Product/Price IDs referenced here are platform-scoped
-- (created in BetterAt's test-mode Stripe account); re-running this
-- seed in a different Stripe account won't relink. To regenerate, see
-- the curl commands in the phase 5b commit message.

-- Auth users
INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at, aud, role)
VALUES
  ('e4d11111-aaaa-4111-8111-aabbccdd1111', 'maria.delgado@example.com', now(), '{"full_name":"Dr. Maria Delgado, RN"}', now(), now(), 'authenticated', 'authenticated'),
  ('e4d22222-bbbb-4222-8222-aabbccdd2222', 'sam.okafor@example.com',    now(), '{"full_name":"Sam Okafor, PA-C"}',     now(), now(), 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, email, full_name, created_at, updated_at)
VALUES
  ('e4d11111-aaaa-4111-8111-aabbccdd1111', 'maria.delgado@example.com', 'Dr. Maria Delgado, RN', now(), now()),
  ('e4d22222-bbbb-4222-8222-aabbccdd2222', 'sam.okafor@example.com',    'Sam Okafor, PA-C',     now(), now())
ON CONFLICT (id) DO NOTHING;

-- Blueprints — independent, no org affiliation
INSERT INTO public.blueprints
  (id, slug, title, category, description, author_user_id, org_id, access_mode, cohort_scope,
   price_per_seat_cents, billing_cadence, author_payout_pct, trial_days,
   status, version, step_count,
   stripe_product_id, stripe_price_id, stripe_synced_at,
   created_at)
VALUES
  ('b1a00001-1111-4001-8001-000000000001', 'pressure-injury-rounding',
   'Pressure-injury rounding', 'assessment',
   'A 6-step playbook for bedside nurses doing daily skin assessments. Built from 18 months of QI data at a 600-bed academic hospital. Catch the early-stage pressure injuries before they hit Stage 2.',
   'e4d11111-aaaa-4111-8111-aabbccdd1111', NULL, 'independent', 'all',
   1500, 'monthly', 70, 7,
   'live', 'v1.0', 6,
   'prod_UZfFlAzyMJvGsb', 'price_1TaVvLBbfEeOhHXbxcugWSMQ', now(),
   now() - interval '120 days'),
  ('b2a00002-2222-4002-8002-000000000002', 'first-night-on-call-survival',
   'First-night-on-call survival', 'reasoning',
   'A 7-step framework for the panicked-page moment. What to ask before you stand up, what to bring, when to call the senior. From a hospitalist PA who''s done 400+ overnight shifts.',
   'e4d22222-bbbb-4222-8222-aabbccdd2222', NULL, 'independent', 'all',
   2400, 'monthly', 70, 14,
   'live', 'v1.2', 7,
   'prod_UZfFCs4soI84AF', 'price_1TaVvPBbfEeOhHXbF4Kiz8wn', now(),
   now() - interval '67 days')
ON CONFLICT (id) DO NOTHING;

-- Step templates (full sets)
INSERT INTO public.blueprint_step_templates (blueprint_id, sort_order, title, description, category, what_question) VALUES
('b1a00001-1111-4001-8001-000000000001', 1, 'Anchor the rounding window', 'Lock in a consistent time of day — same window every shift, ideally tied to a hand-off or bath. Skin checks done at random times are skin checks you skip.', 'procedural', 'When in the shift will you do this every day, no exceptions?'),
('b1a00001-1111-4001-8001-000000000001', 2, 'Position-by-position checklist', 'Walk the four high-risk zones: sacrum, heels, occiput, elbows. Use the same order every patient — your eyes notice differences when the sequence is fixed.', 'assessment', 'Which zone is the patient most likely to be lying on right now?'),
('b1a00001-1111-4001-8001-000000000001', 3, 'Grade what you see', 'Use the NPIAP staging language out loud, even to yourself. "Non-blanchable erythema, Stage 1" beats "looks a bit red".', 'assessment', 'If you handed off in 30 seconds, what stage would you say?'),
('b1a00001-1111-4001-8001-000000000001', 4, 'Decide the intervention there', 'Don''t leave the bedside without naming the next move: turn schedule, heel float, dressing, surface change. Carrying it in your head means it doesn''t happen.', 'reasoning', 'What''s the one thing that has to be in place by end-of-shift?'),
('b1a00001-1111-4001-8001-000000000001', 5, 'Document with the staging photo', 'Wound photo + NPIAP stage + intervention plan — three things in the chart before you leave the room. Future shifts need to see the trajectory.', 'procedural', 'Will the next nurse know what changed between today and tomorrow?'),
('b1a00001-1111-4001-8001-000000000001', 6, 'Loop the family in', 'For the immobile patient: tell the family what you''re watching for and what they can flag. They''re in the room more than you are.', 'communication', 'Who will the family call if they notice a change overnight?'),
('b2a00002-2222-4002-8002-000000000002', 1, 'Before you stand up · the 30-second triage', 'Ask the nurse three things on the phone: (1) what changed, (2) what are the current vitals, (3) what have you already tried. Half the time the answer reveals you don''t need to come.', 'reasoning', 'What''s the one number that would make this an emergency?'),
('b2a00002-2222-4002-8002-000000000002', 2, 'Pack the on-call belt', 'Stethoscope, pen, charge phone, snack, water. The snack is non-negotiable; you''re not going to think clearly on hour 14 without calories.', 'procedural', 'What did you forget last time?'),
('b2a00002-2222-4002-8002-000000000002', 3, 'Bedside · introduce yourself fast', 'Patients and families are scared at night. Name + role + "I''m the one helping you tonight" before anything clinical.', 'communication', 'Can the patient tell their family who you are after you leave the room?'),
('b2a00002-2222-4002-8002-000000000002', 4, 'Examine the actual problem', 'Don''t just read the chart. Vitals, focused exam, look at the wound, palpate the abdomen. Charts lie; bodies don''t.', 'assessment', 'What''s the one finding that would change your plan?'),
('b2a00002-2222-4002-8002-000000000002', 5, 'Decide and document at the bedside', 'Write your note now, not at the end of shift. While the smell of the room is still in your head you''ll remember the relevant details.', 'procedural', 'If audited tomorrow, what''s missing from the note?'),
('b2a00002-2222-4002-8002-000000000002', 6, 'Call the senior when these three things hit', '(1) the answer surprises you, (2) you''re thinking about a procedure you''ve done less than five times, (3) you''ve been awake more than 22 hours. No shame in calling; shame in not.', 'reasoning', 'Which of the three is the easiest to ignore at 3am?'),
('b2a00002-2222-4002-8002-000000000002', 7, 'Sign-out · the one thing they need to know', 'Before you leave, tell the day team the one thing that''s most likely to deteriorate. "Watch his potassium" is more useful than "labs pending".', 'communication', 'What''s the prediction the day team needs?')
ON CONFLICT DO NOTHING;

-- Subscribers + reviews so cards show ratings
INSERT INTO public.marketplace_subscriptions
  (blueprint_id, buyer_user_id, author_user_id, status, unit_amount_cents, currency, cadence, created_at)
VALUES
  ('b1a00001-1111-4001-8001-000000000001', 'eaa58b2f-d499-4896-9e3a-098224bceb7f', 'e4d11111-aaaa-4111-8111-aabbccdd1111', 'active',   1500, 'usd', 'monthly', now() - interval '52 days'),
  ('b1a00001-1111-4001-8001-000000000001', '47f1fbd9-82bb-4946-8e77-0f097439881e', 'e4d11111-aaaa-4111-8111-aabbccdd1111', 'active',   1500, 'usd', 'monthly', now() - interval '23 days'),
  ('b1a00001-1111-4001-8001-000000000001', '755b2cfa-2a5d-4a0a-a4b6-a02924abb6ab', 'e4d11111-aaaa-4111-8111-aabbccdd1111', 'canceled', 1500, 'usd', 'monthly', now() - interval '80 days'),
  ('b2a00002-2222-4002-8002-000000000002', '055801bf-5309-4ce4-b15c-d9ae29d8c1c5', 'e4d22222-bbbb-4222-8222-aabbccdd2222', 'active',   2400, 'usd', 'monthly', now() - interval '30 days'),
  ('b2a00002-2222-4002-8002-000000000002', 'e87f4925-98a6-4fe7-925e-bfd669300e44', 'e4d22222-bbbb-4222-8222-aabbccdd2222', 'trialing', 2400, 'usd', 'monthly', now() - interval '5 days')
ON CONFLICT (blueprint_id, buyer_user_id) DO NOTHING;

INSERT INTO public.marketplace_blueprint_reviews
  (blueprint_id, reviewer_user_id, rating, body, created_at, updated_at)
VALUES
  ('b1a00001-1111-4001-8001-000000000001', 'eaa58b2f-d499-4896-9e3a-098224bceb7f', 5,
   'My unit''s Stage 2+ rate dropped 31% over a quarter after the team started rounding this way. The anchor-the-window step is what made it stick — everyone now does heel checks at 0700.',
   now() - interval '38 days', now() - interval '38 days'),
  ('b1a00001-1111-4001-8001-000000000001', '47f1fbd9-82bb-4946-8e77-0f097439881e', 4,
   'Solid foundational playbook. The family-loop step felt thin to me — would love more on how to actually have that conversation when the patient is sedated.',
   now() - interval '11 days', now() - interval '11 days'),
  ('b1a00001-1111-4001-8001-000000000001', '755b2cfa-2a5d-4a0a-a4b6-a02924abb6ab', 4,
   'Used this for three months on a med-surg floor. The NPIAP staging step trained my eye more than any course I''ve taken. Cancelled when I moved to OR but still recommend it.',
   now() - interval '68 days', now() - interval '68 days'),
  ('b2a00002-2222-4002-8002-000000000002', '055801bf-5309-4ce4-b15c-d9ae29d8c1c5', 5,
   'Bought this 48 hours before my first overnight. The 30-second triage step kept me from running to the wrong room. Buy this on day one of intern year, not day 50.',
   now() - interval '20 days', now() - interval '20 days'),
  ('b2a00002-2222-4002-8002-000000000002', 'e87f4925-98a6-4fe7-925e-bfd669300e44', 5,
   'The "call the senior when these three things hit" step alone is worth the subscription. I''ve referred two co-residents to this blueprint already.',
   now() - interval '2 days', now() - interval '2 days')
ON CONFLICT (blueprint_id, reviewer_user_id) DO NOTHING;

-- Feature the on-call blueprint as rank 2 (Discharge teach-back stays rank 1)
UPDATE public.blueprints
SET is_featured = true, featured_rank = 2,
    featured_blurb = 'Built from 400+ overnight shifts on a hospitalist service. The triage-before-you-stand-up step alone has changed how new interns respond to nighttime pages.'
WHERE id = 'b2a00002-2222-4002-8002-000000000002';
