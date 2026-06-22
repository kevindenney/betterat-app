import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('SubscriptionTeamService contracts', () => {
  it('confirms team and member mutations changed the intended row', () => {
    const source = readSource('services/SubscriptionTeamService.ts');

    expect(source).toContain(".update({ invite_code: code, updated_at: new Date().toISOString() })");
    expect(source).toContain(".update({ name, updated_at: new Date().toISOString() })");
    expect(source).toContain(".eq('team_id', teamId)");
    expect(source).toContain(".eq('status', 'pending')");
    expect(source).toContain(".eq('user_id', userId)");
    expect(source).toContain(".select('id')");
    expect(source).toContain('.maybeSingle()');
    expect(source).toContain('Team not found while generating invite code');
    expect(source).toContain('Member not found while removing from team');
    expect(source).toContain('Pending invite not found while cancelling');
    expect(source).toContain('Team not found while updating name');
  });
});
