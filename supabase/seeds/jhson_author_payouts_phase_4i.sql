-- Seed JHSON author payouts + cycles. Run AFTER 20260523200000_phase_4i_org_author_payouts.sql.
-- Requires the auth.users rows for Dr. R. Murphy + Noor Aziz (created
-- inline below if they don't exist) and Jordan Kim (already in users).
-- Then reassigns the appropriate blueprints to each author.

-- Demo author users (create only if missing)
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) VALUES
  ('d4111111-1111-4111-8111-411111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'r.murphy@jhu-demo.edu',
   '$2a$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQR', now(),
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"Dr. R. Murphy"}',
   now() - interval '180 days', now() - interval '180 days'),
  ('d4222222-2222-4222-8222-422222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'noor.aziz@indie-demo.com',
   '$2a$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQR', now(),
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"Noor Aziz"}',
   now() - interval '90 days', now() - interval '90 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, full_name, email, created_at, updated_at) VALUES
  ('d4111111-1111-4111-8111-411111111111', 'Dr. R. Murphy', 'r.murphy@jhu-demo.edu', now() - interval '180 days', now()),
  ('d4222222-2222-4222-8222-422222222222', 'Noor Aziz', 'noor.aziz@indie-demo.com', now() - interval '90 days', now())
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email;

-- Reassign blueprints to diverse authors
UPDATE public.blueprints
  SET author_user_id = 'd4111111-1111-4111-8111-411111111111'
  WHERE org_id = '678e149e-2abb-422c-ac61-b76756a2150e'
    AND slug IN ('sepsis-bundle', 'iv-supervised', 'foley');

UPDATE public.blueprints
  SET author_user_id = 'aaf749aa-77bb-454d-8d15-6ccdb57bc4e9'
  WHERE org_id = '678e149e-2abb-422c-ac61-b76756a2150e'
    AND slug = 'h2t';

UPDATE public.blueprints
  SET author_user_id = 'd4222222-2222-4222-8222-422222222222'
  WHERE org_id = '678e149e-2abb-422c-ac61-b76756a2150e'
    AND slug = 'teach-back';

-- Payout rows
INSERT INTO public.org_author_payouts (
  org_id, author_user_id, author_kind, active_seats, earned_ytd_cents,
  last_payout_date, last_payout_amount_cents, stripe_connect_status, stripe_connect_account_id
) VALUES
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'd4111111-1111-4111-8111-411111111111',
    'institutional', 22, 518000,
    '2026-04-30', 124000, 'verified', 'acct_demo_murphy'),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'aaf749aa-77bb-454d-8d15-6ccdb57bc4e9',
    'institutional', 18, 231000,
    '2026-04-30', 48000, 'verified', 'acct_demo_jkim'),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'd4222222-2222-4222-8222-422222222222',
    'independent', 6, 93000,
    '2026-04-30', 17000, 'action_needed', 'acct_demo_aziz')
ON CONFLICT (org_id, author_user_id) DO UPDATE SET
  active_seats = EXCLUDED.active_seats,
  earned_ytd_cents = EXCLUDED.earned_ytd_cents,
  last_payout_date = EXCLUDED.last_payout_date,
  last_payout_amount_cents = EXCLUDED.last_payout_amount_cents,
  stripe_connect_status = EXCLUDED.stripe_connect_status,
  updated_at = now();

-- Cycles
INSERT INTO public.org_payout_cycles (
  org_id, period_start, period_end, status, authors_paid, authors_total,
  active_seats, batch_total_cents, rebate_cents, scheduled_for, cleared_date
) VALUES
  ('678e149e-2abb-422c-ac61-b76756a2150e', '2026-04-01', '2026-04-30', 'cleared', 3, 3, 28, 189000, 37800, '2026-05-05', '2026-04-30')
ON CONFLICT (org_id, period_start, period_end) DO NOTHING;

INSERT INTO public.org_payout_cycles (
  org_id, period_start, period_end, status, authors_paid, authors_total,
  active_seats, batch_total_cents, rebate_cents, scheduled_for
) VALUES
  ('678e149e-2abb-422c-ac61-b76756a2150e', '2026-05-01', '2026-05-31', 'scheduled', 3, 3, 30, 124000, 24800, '2026-05-31')
ON CONFLICT (org_id, period_start, period_end) DO NOTHING;
