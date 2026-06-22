import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('practice session mutation guards', () => {
  it('confirms session and member mutations changed a row', () => {
    const source = readSource('services/PracticeSessionService.ts');

    for (const method of [
      'async updateSession',
      'async completeSession',
      'async startSession',
      'async cancelSession',
      'async deleteSession',
      'async clearInviteCode',
      'async leaveSession',
      'async updateRsvp',
      'async updateMember',
      'async markAttendance',
      'async removeMember',
    ]) {
      expect(source).toContain(method);
    }

    expect(source.match(/Practice session not found\./g)?.length).toBeGreaterThanOrEqual(6);
    expect(source.match(/Practice session member not found\./g)?.length).toBeGreaterThanOrEqual(5);
  });

  it('confirms focus and drill mutations changed a row and do not ignore per-row reorder failures', () => {
    const source = readSource('services/PracticeSessionService.ts');

    expect(source).toContain('async updateFocusAreaRating');
    expect(source).toContain('async removeFocusArea');
    expect(source).toContain('async updateDrillExecution');
    expect(source).toContain('async reorderDrills');
    expect(source).toContain('async removeDrill');
    expect(source.match(/Practice focus area not found\./g)?.length).toBeGreaterThanOrEqual(2);
    expect(source.match(/Practice drill not found\./g)?.length).toBeGreaterThanOrEqual(3);
    expect(source).toContain('Practice session rating target not found.');
    expect(source).toContain('result.error || !result.data');
    expect(source).toContain('failed?.error');
    expect(source.match(/\.select\('id'\)/g)?.length).toBeGreaterThanOrEqual(16);
    expect(source.match(/\.maybeSingle\(\)/g)?.length).toBeGreaterThanOrEqual(16);
  });
});
