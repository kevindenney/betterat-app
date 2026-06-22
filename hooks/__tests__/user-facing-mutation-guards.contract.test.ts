import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('user-facing hook mutation guards', () => {
  it('confirms atlas and library mutations changed the intended row', () => {
    const stepLocation = readSource('hooks/useUpdateStepLocation.ts');
    const racingArea = readSource('hooks/useUpdateRacingArea.ts');
    const libraryItem = readSource('hooks/useLibraryItemMutations.ts');

    expect(stepLocation).toContain(".from('timeline_steps')");
    expect(stepLocation).toContain(".select('id')");
    expect(stepLocation).toContain('.maybeSingle()');
    expect(stepLocation).toContain("throw new Error('Step not found.')");

    expect(racingArea).toContain(".from('atlas_pois')");
    expect(racingArea).toContain(".select('id')");
    expect(racingArea).toContain('.maybeSingle()');
    expect(racingArea).toContain("throw new Error('Racing area not found.')");

    expect(libraryItem).toContain(".from('library_items')");
    expect(libraryItem.match(/\.select\('id'\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(libraryItem.match(/\.maybeSingle\(\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(libraryItem.match(/throw new Error\('Library item not found\.'\)/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
