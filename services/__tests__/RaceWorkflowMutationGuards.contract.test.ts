import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('race workflow mutation guards', () => {
  it('confirms race participant and timer single-row actions changed a row', () => {
    const participant = readSource('services/RaceParticipantService.ts');
    const timer = readSource('services/RaceTimerService.ts');

    expect(participant).toContain('async withdrawFromRace');
    expect(participant).toContain(".from('race_participants')");
    expect(participant).toContain(".select('id')");
    expect(participant).toContain('.maybeSingle()');
    expect(participant).toContain('Race participant not found.');

    expect(timer).toContain('static async deleteSession');
    expect(timer).toContain('static async updateConditions');
    expect(timer.match(/\.from\('race_timer_sessions'\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(timer.match(/\.select\('id'\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(timer.match(/\.maybeSingle\(\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(timer.match(/Race timer session not found\./g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('confirms race checklist and team race entry single-row actions changed a row', () => {
    const checklist = readSource('services/RaceChecklistService.ts');
    const teamEntry = readSource('services/TeamRaceEntryService.ts');

    expect(checklist).toContain('static async deleteChecklistItem');
    expect(checklist).toContain(".from('race_checklist_items')");
    expect(checklist).toContain(".select('id')");
    expect(checklist).toContain('.maybeSingle()');
    expect(checklist).toContain('Race checklist item not found.');

    expect(teamEntry).toContain('async deleteTeamEntry');
    expect(teamEntry).toContain('async clearInviteCode');
    expect(teamEntry).toContain('async leaveTeam');
    expect(teamEntry).toContain('async updateMember');
    expect(teamEntry).toContain('async removeMember');
    expect(teamEntry).toContain('async updateChecklistItem');
    expect(teamEntry).toContain('async resetChecklist');
    expect(teamEntry.match(/\.select\('id'\)/g)?.length).toBeGreaterThanOrEqual(7);
    expect(teamEntry.match(/\.maybeSingle\(\)/g)?.length).toBeGreaterThanOrEqual(7);
    expect(teamEntry.match(/Team race entry not found\./g)?.length).toBeGreaterThanOrEqual(2);
    expect(teamEntry.match(/Team race member not found\./g)?.length).toBeGreaterThanOrEqual(3);
    expect(teamEntry.match(/Team race checklist not found\./g)?.length).toBeGreaterThanOrEqual(2);
  });
});
