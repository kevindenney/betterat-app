import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('race document and collaboration mutation guards', () => {
  it('confirms race document share and unlink mutations changed a row', () => {
    const source = readSource('services/RaceDocumentService.ts');

    expect(source).toContain("async shareDocumentWithFleet");
    expect(source).toContain("async unshareDocumentFromFleet");
    expect(source).toContain("async unlinkDocumentFromRace");
    expect(source.match(/\.from\('race_documents'\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(source.match(/\.select\('id'\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(source.match(/\.maybeSingle\(\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(source.match(/Race document not found\./g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('confirms direct race collaborator mutations changed a row', () => {
    const source = readSource('services/RaceCollaborationService.ts');

    for (const method of [
      'async updateAccessLevel',
      'async updateCollaborator',
      'async removeCollaborator',
      'async acceptInvite',
      'async declineInvite',
    ]) {
      expect(source).toContain(method);
    }
    expect(source.match(/\.from\('race_collaborators'\)/g)?.length).toBeGreaterThanOrEqual(5);
    expect(source.match(/\.select\('id'\)/g)?.length).toBeGreaterThanOrEqual(5);
    expect(source.match(/\.maybeSingle\(\)/g)?.length).toBeGreaterThanOrEqual(5);
    expect(source.match(/Race collaborator not found\./g)?.length).toBeGreaterThanOrEqual(5);
  });
});
