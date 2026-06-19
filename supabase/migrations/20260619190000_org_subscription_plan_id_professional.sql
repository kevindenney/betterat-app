-- Widen organization_subscriptions.plan_id CHECK to match the live Club tiers.
--
-- The app moved to flat Club tiers (lib/subscriptions/orgTiers.ts:
-- starter / professional / enterprise), but this table's CHECK still only
-- allowed the legacy seat-based set (starter / department / enterprise). The
-- stripe-webhooks upsert writes plan_id straight from checkout metadata, so a
-- Professional checkout failed the constraint. Allow both vocabularies so legacy
-- 'department' rows stay valid while 'professional' checkouts succeed.

ALTER TABLE organization_subscriptions
  DROP CONSTRAINT IF EXISTS organization_subscriptions_plan_id_check;

ALTER TABLE organization_subscriptions
  ADD CONSTRAINT organization_subscriptions_plan_id_check
  CHECK (plan_id IN ('starter', 'professional', 'department', 'enterprise'));
