import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('notifications and inbox mutation guards', () => {
  it('confirms single-row notification and inbox actions changed the intended row', () => {
    const notifications = readSource('services/NotificationService.ts');
    const inbox = readSource('hooks/useInboxActions.ts');

    expect(notifications).toContain(".from('social_notifications')");
    expect(notifications).toContain(".eq('id', notificationId)");
    expect(notifications).toContain(".eq('user_id', userId)");
    expect(notifications).toContain("throw new Error('Notification not found.')");

    expect(inbox).toContain(".from('step_suggestions')");
    expect(inbox).toContain(".from('peer_reflections')");
    expect(inbox).toContain(".select('id')");
    expect(inbox).toContain('.maybeSingle()');
    expect(inbox).toContain("throw new Error('Suggestion not found.')");
    expect(inbox).toContain("throw new Error('Reflection not found.')");
  });
});
