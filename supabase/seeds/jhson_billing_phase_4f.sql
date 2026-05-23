-- Seed JHSON billing data so the Admin · Billing surface renders real rows.
-- Run AFTER 20260523170000_phase_4f_org_billing.sql.

INSERT INTO public.org_billing (
  org_id, plan_tier, plan_label, price_monthly_cents, billing_cadence, net_terms,
  seats_total, seats_used, seats_students, seats_mentors, seats_faculty,
  next_renewal_date, auto_renew,
  payment_method_brand, payment_method_last4, payment_method_exp_month, payment_method_exp_year,
  billing_contact_name, billing_contact_email,
  pilot_locked_until, list_rate_monthly_cents,
  stripe_customer_id, stripe_subscription_id
) VALUES (
  '678e149e-2abb-422c-ac61-b76756a2150e',
  'institutional_pilot',
  'Institutional · BSN / pilot',
  149000, 'monthly', 30,
  50, 30, 28, 2, 0,
  '2026-06-01', true,
  'visa', '4242', 9, 28,
  'Susanna Park', 'billing@nursing.jhu.edu',
  '2026-09-30', 225000,
  'cus_jhson_demo', 'sub_jhson_pilot_demo'
)
ON CONFLICT (org_id) DO UPDATE SET
  plan_tier = EXCLUDED.plan_tier,
  plan_label = EXCLUDED.plan_label,
  price_monthly_cents = EXCLUDED.price_monthly_cents,
  seats_total = EXCLUDED.seats_total,
  seats_used = EXCLUDED.seats_used,
  next_renewal_date = EXCLUDED.next_renewal_date,
  updated_at = now();

INSERT INTO public.org_invoices (
  org_id, invoice_number, period_start, period_end, seats_billed, amount_cents, status, paid_at, due_at
) VALUES
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'INV-2026-05', '2026-05-01', '2026-05-31', 30, 149000, 'open',    NULL,         '2026-06-01'),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'INV-2026-04', '2026-04-01', '2026-04-30', 28, 149000, 'paid',    '2026-04-28', '2026-05-01'),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'INV-2026-03', '2026-03-01', '2026-03-31', 22, 149000, 'paid',    '2026-03-28', '2026-04-01'),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'INV-2026-02', '2026-02-01', '2026-02-28', 14, 149000, 'paid',    '2026-02-26', '2026-03-01'),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'INV-2026-01', '2026-01-01', '2026-01-31',  8, 149000, 'paid',    '2026-01-24', '2026-02-01'),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'INV-2025-12', '2025-12-01', '2025-12-31',  4,      0, 'waived',  NULL,         NULL)
ON CONFLICT (org_id, invoice_number) DO NOTHING;
