-- Capture the org subscription's billing contact (Stripe customer name + email)
-- so the Studio billing surface can show "billed to {name} · {email}" for real
-- subscriptions instead of hiding it. Populated by stripe-webhooks alongside
-- the card-on-file sync.

ALTER TABLE organization_subscriptions
  ADD COLUMN IF NOT EXISTS billing_contact_name text,
  ADD COLUMN IF NOT EXISTS billing_contact_email text;
