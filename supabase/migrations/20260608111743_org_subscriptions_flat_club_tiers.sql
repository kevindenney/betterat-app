-- Move organization_subscriptions to the flat Club tier model.
-- Adds 'professional' to the plan_id allowlist (Club Starter / Club Pro /
-- Enterprise) alongside the legacy per-seat ids so existing rows stay valid.

ALTER TABLE organization_subscriptions
  DROP CONSTRAINT IF EXISTS organization_subscriptions_plan_id_check;

ALTER TABLE organization_subscriptions
  ADD CONSTRAINT organization_subscriptions_plan_id_check
  CHECK (plan_id IN ('starter', 'professional', 'enterprise', 'department'));
