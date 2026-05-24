-- Seed marketplace_subscriptions + reviews for Noor Aziz's
-- Discharge teach-back so the marketplace shows real social proof
-- instead of "no reviews yet". 5 subscriber rows across active /
-- trialing / canceled states, with 5 matching reviews (4.6 avg).
-- Idempotent via ON CONFLICT DO NOTHING on the UNIQUE constraints.

INSERT INTO public.marketplace_subscriptions
  (blueprint_id, buyer_user_id, author_user_id, org_id, status, unit_amount_cents, currency, cadence, created_at)
VALUES
  ('9782c831-15cd-45fb-92e1-6ce9380afeb0', '37ac7510-8a05-4f15-86ea-1d8714b6507d', 'd4222222-2222-4222-8222-422222222222', '678e149e-2abb-422c-ac61-b76756a2150e', 'active',    1900, 'usd', 'monthly', now() - interval '34 days'),
  ('9782c831-15cd-45fb-92e1-6ce9380afeb0', 'bff7d234-073e-467e-8046-176c217b51be', 'd4222222-2222-4222-8222-422222222222', '678e149e-2abb-422c-ac61-b76756a2150e', 'active',    1900, 'usd', 'monthly', now() - interval '21 days'),
  ('9782c831-15cd-45fb-92e1-6ce9380afeb0', '96daa453-462a-49bd-b552-440e2d4ee576', 'd4222222-2222-4222-8222-422222222222', '678e149e-2abb-422c-ac61-b76756a2150e', 'active',    1900, 'usd', 'monthly', now() - interval '17 days'),
  ('9782c831-15cd-45fb-92e1-6ce9380afeb0', '8357b07c-9e51-488f-b8c8-195f9f161d5f', 'd4222222-2222-4222-8222-422222222222', '678e149e-2abb-422c-ac61-b76756a2150e', 'canceled',  1900, 'usd', 'monthly', now() - interval '42 days'),
  ('9782c831-15cd-45fb-92e1-6ce9380afeb0', '6d1ba5b1-aa8f-4183-a8bb-8c4e623ad517', 'd4222222-2222-4222-8222-422222222222', '678e149e-2abb-422c-ac61-b76756a2150e', 'trialing',  1900, 'usd', 'monthly', now() - interval '3 days')
ON CONFLICT (blueprint_id, buyer_user_id) DO NOTHING;

INSERT INTO public.marketplace_blueprint_reviews
  (blueprint_id, reviewer_user_id, rating, body, created_at, updated_at)
VALUES
  ('9782c831-15cd-45fb-92e1-6ce9380afeb0', '37ac7510-8a05-4f15-86ea-1d8714b6507d', 5,
   'Walked into my first discharge handoff in week 6 and ran the three musts straight from this playbook. The teach-back question stopped me from skipping over a med change the patient didn''t actually understand.',
   now() - interval '28 days', now() - interval '28 days'),
  ('9782c831-15cd-45fb-92e1-6ce9380afeb0', 'bff7d234-073e-467e-8046-176c217b51be', 5,
   'My preceptor pulled me aside the first week and said "this is exactly the structure we want." Use the documenting step — it''s the part everyone forgets.',
   now() - interval '14 days', now() - interval '14 days'),
  ('9782c831-15cd-45fb-92e1-6ce9380afeb0', '96daa453-462a-49bd-b552-440e2d4ee576', 4,
   'Solid framework. I wish there was more on what to do when family members are anxious or distracting — the "set the scene" step glosses over that. Otherwise great for the routine case.',
   now() - interval '10 days', now() - interval '10 days'),
  ('9782c831-15cd-45fb-92e1-6ce9380afeb0', '8357b07c-9e51-488f-b8c8-195f9f161d5f', 4,
   'Helped me a lot in my first rotation. Cancelled when I moved off the med-surg floor but I''d resubscribe in a heartbeat if I rotate back. The verify-with-teach-back step is the magic.',
   now() - interval '35 days', now() - interval '35 days'),
  ('9782c831-15cd-45fb-92e1-6ce9380afeb0', '6d1ba5b1-aa8f-4183-a8bb-8c4e623ad517', 5,
   'On my third day of using it. The plain-language framing changed how I talk to patients. Worth way more than $19.',
   now() - interval '1 day', now() - interval '1 day')
ON CONFLICT (blueprint_id, reviewer_user_id) DO NOTHING;
