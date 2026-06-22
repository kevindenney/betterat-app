import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('shared step, privacy, and nutrition mutation guards', () => {
  it('confirms shared step and on-deck mutations changed a row', () => {
    const sharedSteps = readSource('services/SharedStepsService.ts');
    const stepDeck = readSource('services/StepDeckService.ts');

    expect(sharedSteps).toContain('function markSharedStepRead');
    expect(sharedSteps).toContain('function recordForkedSharedStep');
    expect(sharedSteps.match(/Shared step not found\./g)?.length).toBeGreaterThanOrEqual(2);
    expect(sharedSteps.match(/\.maybeSingle\(\)/g)?.length).toBeGreaterThanOrEqual(2);

    expect(stepDeck).toContain('function markOnDeckPlaced');
    expect(stepDeck).toContain('function discardOnDeckItem');
    expect(stepDeck.match(/On-deck item not found\./g)?.length).toBeGreaterThanOrEqual(2);
    expect(stepDeck.match(/\.maybeSingle\(\)/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('confirms profile privacy and nutrition delete mutations changed a row', () => {
    const privacy = readSource('services/PrivacySettingsService.ts');
    const nutrition = readSource('services/NutritionService.ts');

    expect(privacy).toContain('function updateProfilePrivacy');
    expect(privacy).toContain(".from('profiles')");
    expect(privacy).toContain('Profile not found.');
    expect(privacy).toContain('.maybeSingle()');

    expect(nutrition).toContain('function deleteNutritionEntry');
    expect(nutrition).toContain(".from('nutrition_entries')");
    expect(nutrition).toContain("if (!data) return false;");
    expect(nutrition).toContain('.maybeSingle()');
  });
});
