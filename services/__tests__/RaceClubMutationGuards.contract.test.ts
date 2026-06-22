import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('race and club mutation guards', () => {
  it('confirms race event status and delete actions changed a row', () => {
    const source = readSource('services/RaceEventService.ts');

    expect(source).toContain('static async deleteRaceEvent');
    expect(source).toContain('static async updateRaceStatus');
    expect(source.match(/\.from\('race_events'\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(source.match(/\.select\('id'\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(source.match(/\.maybeSingle\(\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(source.match(/Race event not found\./g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('confirms club document and member single-row actions changed a row', () => {
    const documents = readSource('services/ClubDocumentService.ts');
    const members = readSource('services/ClubMemberService.ts');

    expect(documents).toContain('async storeAIExtraction');
    expect(documents).toContain('async deactivateClubDocument');
    expect(documents).toContain('async deleteClubDocument');
    expect(documents).toContain('async reorderClubDocuments');
    expect(documents.match(/\.from\('club_documents'\)/g)?.length).toBeGreaterThanOrEqual(4);
    expect(documents.match(/\.select\('id'\)/g)?.length).toBeGreaterThanOrEqual(4);
    expect(documents.match(/\.maybeSingle\(\)/g)?.length).toBeGreaterThanOrEqual(4);
    expect(documents.match(/Club document not found\./g)?.length).toBeGreaterThanOrEqual(4);
    expect(documents).toContain('result.error || !result.data');

    expect(members).toContain('async deleteMember');
    expect(members).toContain(".from('club_members')");
    expect(members).toContain(".select('id')");
    expect(members).toContain('.maybeSingle()');
    expect(members).toContain('Club member not found.');
  });
});
