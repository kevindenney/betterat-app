-- Phase 4r · stripe sync columns on blueprints
-- Lets the editor's Pricing tab show Stripe Product/Price state when a
-- blueprint is on access_mode='independent' and persist sync metadata
-- written by the blueprint-stripe-sync edge function.

ALTER TABLE public.blueprints
  ADD COLUMN IF NOT EXISTS stripe_product_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS stripe_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_sync_error text;

CREATE INDEX IF NOT EXISTS idx_blueprints_stripe_product
  ON public.blueprints(stripe_product_id) WHERE stripe_product_id IS NOT NULL;
