import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('push notification edge function contracts', () => {
  it('keeps stale-token cleanup aligned with the matching Expo chunk', () => {
    const source = readSource('supabase/functions/send-push-notification/index.ts');

    expect(source).toContain('for (let chunkStart = 0; chunkStart < pushMessages.length; chunkStart += 100)');
    expect(source).toContain('const chunk = pushMessages.slice(chunkStart, chunkStart + 100);');
    expect(source).toContain('const chunkTokenMap = tokenMap.slice(chunkStart, chunkStart + 100);');
    expect(source).toContain('const tokenInfo = chunkTokenMap[i];');
    expect(source).not.toContain('const tokenInfo = tokenMap[i];');
    expect(source).toContain(".from('push_tokens')");
    expect(source).toContain(".eq('token', tokenInfo.token)");
    expect(source).toContain(".eq('user_id', tokenInfo.userId)");
  });

  it('preserves session reminder preference checks and reminder destinations', () => {
    const source = readSource('supabase/functions/session-reminders/index.ts');

    expect(source).toContain("p_category: 'session_reminders'");
    expect(source).toContain("route: '/(tabs)/schedule'");
    expect(source).toContain("route: '/coach/my-bookings'");
    expect(source).toContain("type: 'session_reminder'");
    expect(source).toContain("update({ reminder_sent: true })");
  });
});
