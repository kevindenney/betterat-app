-- A plan is the "business" unit for the entrepreneur vocab, and a business
-- has one currency. Until now currency lived only on the per-week
-- business_outcomes rows (defaulting to INR from the India-first persona),
-- so a US founder's turnover read in ₹. Anchor currency on the plan instead.

ALTER TABLE plans ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';

-- Backfill each existing plan from its most recent outcome row's currency.
-- Plans with no outcomes keep the USD default.
UPDATE plans p
SET currency = bo.currency
FROM (
  SELECT DISTINCT ON (plan_id) plan_id, currency
  FROM business_outcomes
  WHERE currency IS NOT NULL
  ORDER BY plan_id, week_start DESC
) bo
WHERE bo.plan_id = p.id
  AND bo.currency <> p.currency;
