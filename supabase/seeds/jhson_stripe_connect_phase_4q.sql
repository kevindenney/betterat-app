-- JHSON demo authors · live Stripe test-mode Connect accounts
--
-- The acct_… ids below were created in the BetterAt Stripe test platform
-- via Custom Connect accounts with the test "auto-verify" data:
--   ssn_last_4 = 0000, id_number = 000000000, address line1 =
--   address_full_match, routing 110000000, account 000123456789.
-- Murphy + Kim cleared to charges_enabled=true / payouts_enabled=true
-- ~12 seconds after creation; Aziz was intentionally created without
-- SSN/id/address so currently_due remains populated → action_needed.
--
-- These IDs are platform-scoped — re-running this seed in another
-- Stripe platform won't link to those acct_… ids. To regenerate, see
-- the curl commands in the phase 4q commit message.

INSERT INTO public.creator_stripe_accounts
  (user_id, stripe_account_id, charges_enabled, payouts_enabled, onboarding_complete, created_at, updated_at)
VALUES
  -- Dr. R. Murphy
  ('d4111111-1111-4111-8111-411111111111', 'acct_1TaNVXBi0xFHWQXt', true,  true,  true,  now(), now()),
  -- Jordan Kim
  ('aaf749aa-77bb-454d-8d15-6ccdb57bc4e9', 'acct_1TaNXSAyjfiS3z2J', true,  true,  true,  now(), now()),
  -- Noor Aziz (deliberately incomplete)
  ('d4222222-2222-4222-8222-422222222222', 'acct_1TaNXXBDHkhd7aJp', false, false, false, now(), now())
ON CONFLICT (user_id) DO UPDATE SET
  stripe_account_id = EXCLUDED.stripe_account_id,
  charges_enabled = EXCLUDED.charges_enabled,
  payouts_enabled = EXCLUDED.payouts_enabled,
  onboarding_complete = EXCLUDED.onboarding_complete,
  updated_at = now();
