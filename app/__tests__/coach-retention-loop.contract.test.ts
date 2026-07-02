import fs from 'fs';
import path from 'path';

function readAppFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('coach retention loop contract', () => {
  it('surfaces streaks, reminders, and weekly recap on coach home', () => {
    const source = readAppFile('app/(tabs)/clients.tsx');
    expect(source).toContain('Retention Loop');
    expect(source).toContain('retention.streakDays');
    expect(source).toContain('Weekly recap:');
    expect(source).toContain('Signature Insight');
    expect(source).toContain('retention.weeklyRecap.signatureInsight');
    expect(source).toContain('resolveSignatureInsight');
    expect(source).toContain('Keep');
    expect(source).toContain('Edit');
    expect(source).toContain('Dismiss');
    expect(source).toContain('retention.reminders');
    expect(source).toContain("No reminders pending.");
    expect(source).toContain('router.push(reminder.href as any)');
  });

  it('computes retention loop state in useCoachHomeData', () => {
    const source = readAppFile('hooks/useCoachHomeData.ts');
    expect(source).toContain('buildCoachReminders');
    expect(source).toContain('buildCoachWeeklyRecap');
    expect(source).toContain('signatureInsight');
    expect(source).toContain('findLatestSignatureInsightEvent');
    expect(source).toContain('applySignatureInsightOutcome');
    expect(source).toContain('computeDailyStreak');
    expect(source).toContain('countActiveDaysWithin');
    expect(source).toContain('setRetention(');
  });

  it('sends coach retention emails with BetterAt sender branding', () => {
    const source = readAppFile('api/cron/coach-retention-loop.ts');

    expect(source).toContain("from: { email: input.fromEmail, name: 'BetterAt' }");
    expect(source).toContain("const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@better.at';");
    expect(source).toContain("hasPendingChannel(row as RetentionDispatchRow, 'email')");
    expect(source).toContain('await sendEmailViaSendGrid({');
    expect(source).toContain('next.email_dispatched_at = nowIso;');
    expect(source).not.toContain("name: 'RegattaFlow'");
    expect(source).not.toContain('noreply@regattaflow.com');
  });
});
