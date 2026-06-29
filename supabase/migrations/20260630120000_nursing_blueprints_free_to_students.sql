-- Institutional academic orgs (e.g. Johns Hopkins School of Nursing) pay for
-- seats; their enrolled students get blueprints for free. There is no student-
-- facing price and no per-seat charge to the learner.
--
-- The seed left two artifacts that contradict that model:
--   * institutional nursing blueprints still carried a stale
--     price_per_seat_cents ($14/$19), and
--   * one nursing blueprint ("Discharge teach-back") was access_mode
--     'independent', which actively charges students.
--
-- Force every nursing-interest org's blueprints to institutional access and
-- strip the per-seat price + any stale Stripe price linkage. Idempotent.
update public.blueprints b
set access_mode = 'institutional',
    price_per_seat_cents = null,
    stripe_price_id = null
from public.organizations o
where o.id = b.org_id
  and o.interest_slug = 'nursing'
  and (
    b.access_mode is distinct from 'institutional'
    or b.price_per_seat_cents is not null
    or b.stripe_price_id is not null
  );
