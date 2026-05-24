-- Phase 4v · cancel_at_period_end on marketplace_subscriptions
-- Buyers cancel via stripe.subscriptions.update({cancel_at_period_end:
-- true}) instead of immediate cancel — they keep access through the
-- end of the paid period. The flag mirrors Stripe's
-- cancel_at_period_end state so the surface can render "Cancels DATE"
-- distinct from "Canceled DATE".

ALTER TABLE public.marketplace_subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;
