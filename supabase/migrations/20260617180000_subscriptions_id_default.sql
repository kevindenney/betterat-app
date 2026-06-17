-- subscriptions.id is a NOT NULL text PK with no default, so every insert from
-- the Stripe webhook (handleSubscriptionUpdate upsert) failed silently and the
-- table stayed empty. Give the PK a generated default so subscription rows can
-- actually be written.
ALTER TABLE public.subscriptions
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
