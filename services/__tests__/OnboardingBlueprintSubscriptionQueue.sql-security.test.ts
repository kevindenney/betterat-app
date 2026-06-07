import fs from 'node:fs';
import path from 'node:path';

describe('onboarding blueprint subscription queue migration', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20260607170000_onboarding_blueprint_subscription_queue.sql',
  );
  const sql = fs.readFileSync(migrationPath, 'utf8');

  it('queues org-member blueprint requests behind a security-definer signup RPC', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.pending_blueprint_subscriptions');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.request_onboarding_blueprint_subscription');
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain("status', 'pending-org-membership'");
    expect(sql).toContain('p_subscriber_id uuid DEFAULT NULL');
    expect(sql).toContain('v_subscriber_id <> v_actor');
  });

  it('fulfills queued org-member blueprint subscriptions when membership activates', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.fulfill_pending_org_blueprint_subscriptions');
    expect(sql).toContain('INSERT INTO public.blueprint_subscriptions');
    expect(sql).toContain("subscription_status = 'active'");
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.fulfill_pending_org_blueprint_subscriptions');
    expect(sql).not.toContain('GRANT EXECUTE ON FUNCTION public.fulfill_pending_org_blueprint_subscriptions');
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.organization_memberships_fulfill_pending_blueprints');
    expect(sql).toContain('CREATE TRIGGER organization_memberships_fulfill_pending_blueprints');
    expect(sql).toContain('AFTER INSERT OR UPDATE OF status, membership_status, is_verified');
  });

  it('keeps pending request rows owner-readable only', () => {
    expect(sql).toContain('ALTER TABLE public.pending_blueprint_subscriptions ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('pending_blueprint_subscriptions_read_own');
    expect(sql).toContain('subscriber_id = (SELECT auth.uid())');
  });
});
