import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('SailorBoatService contracts', () => {
  it('confirms primary and delete mutations still affect the target boat row', () => {
    const source = readSource('services/SailorBoatService.ts');

    expect(source).toContain(".update({ is_primary: true })");
    expect(source).toContain(".delete()");
    expect(source).toContain(".eq('id', boatId)");
    expect(source).toContain(".select('id')");
    expect(source).toContain('.maybeSingle()');
    expect(source).toContain('if (!updatedBoat)');
    expect(source).toContain('if (!deletedBoat)');
    expect(source).toContain("throw new Error('Boat not found')");
  });
});
