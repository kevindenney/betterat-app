-- Capture the org subscription's card-on-file so the Studio billing surface
-- can show the real payment method instead of a "No payment method on file"
-- empty-state. Populated by stripe-webhooks (invoice.paid / subscription
-- updates / customer.updated) from the customer's default payment method.

ALTER TABLE organization_subscriptions
  ADD COLUMN IF NOT EXISTS payment_method_brand text,
  ADD COLUMN IF NOT EXISTS payment_method_last4 text,
  ADD COLUMN IF NOT EXISTS payment_method_exp_month integer,
  ADD COLUMN IF NOT EXISTS payment_method_exp_year integer;
