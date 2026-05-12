import fs from 'fs';
import path from 'path';

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('coach retention cron contract', () => {
  it('defines a guarded coach retention cron endpoint', () => {
    const source = readFile('api/cron/coach-retention-loop.ts');
    expect(source).toContain("req.method !== 'GET' && req.method !== 'POST'");
    expect(source).toContain("res.setHeader('Allow', 'GET, POST')");
    expect(source).toContain('process.env.CRON_SECRET');
    expect(source).toContain("return res.status(401).json({ error: 'Unauthorized' })");
    expect(source).toContain("from('assessment_records')");
    expect(source).toContain("from('coach_retention_deliveries')");
    expect(source).toContain("delivery_type === 'weekly_recap'");
    expect(source).toContain('isCompleteWeeklyRecapPayload');
    expect(source).toContain('invalid_weekly_recap_payload');
    expect(source).toContain("from('social_notifications')");
    expect(source).toContain("from('notification_preferences')");
    expect(source).toContain('/functions/v1/send-push-notification');
    expect(source).toContain('SENDGRID_API_KEY');
    expect(source).toContain('in_app_dispatched_at');
    expect(source).toContain('push_dispatched_at');
    expect(source).toContain('email_dispatched_at');
    expect(source).toContain('dispatched_at');
    expect(source).toContain('skippedInvalidWeeklyRecaps');
  });

  it('keeps coach retention cron endpoint unregistered in vercel.json (cost optimization)', () => {
    // Intentionally removed in 9c9d0bae after the endpoint returned 401 on
    // every invocation (~2k wasted calls/month). Re-registering requires
    // proving the auth path works first; this guard documents the decision.
    const source = readFile('vercel.json');
    expect(source).not.toContain('/api/cron/coach-retention-loop');
  });
});
