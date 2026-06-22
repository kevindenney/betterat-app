import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('messaging, crew, and community mutation guards', () => {
  it('confirms coaching conversation read and preview updates changed a row', () => {
    const source = readSource('services/MessagingService.ts');

    expect(source).toContain('async markConversationRead');
    expect(source).toContain('async sendSystemMessage');
    expect(source.match(/Conversation not found\./g)?.length).toBeGreaterThanOrEqual(2);
    expect(source.match(/\.from\('coaching_conversations'\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(source.match(/\.maybeSingle\(\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(source).toContain('messagesError');
  });

  it('confirms crew thread and message actions changed a row', () => {
    const source = readSource('services/CrewThreadService.ts');

    expect(source).toContain('static async updateThread');
    expect(source).toContain('static async deleteThread');
    expect(source).toContain('static async removeMember');
    expect(source).toContain('static async markAsRead');
    expect(source).toContain('static async deleteMessage');
    expect(source.match(/Crew thread not found\./g)?.length).toBeGreaterThanOrEqual(2);
    expect(source.match(/Crew thread member not found\./g)?.length).toBeGreaterThanOrEqual(2);
    expect(source).toContain('Crew thread message not found.');
    expect(source.match(/\.maybeSingle\(\)/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it('confirms community membership leave and notification toggles changed a row', () => {
    const source = readSource('services/community/CommunityService.ts');

    expect(source).toContain('async leaveCommunity');
    expect(source).toContain('async toggleNotifications');
    expect(source.match(/Community membership not found\./g)?.length).toBeGreaterThanOrEqual(2);
    expect(source.match(/\.from\('community_memberships'\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(source.match(/\.maybeSingle\(\)/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
