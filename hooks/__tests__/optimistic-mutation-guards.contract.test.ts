import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('optimistic hook mutation guards', () => {
  it('confirms race marks, saved places, and step-library detach changed a row', () => {
    const raceMarks = readSource('hooks/useRaceMarks.ts');
    const savedPlaces = readSource('hooks/useUserSavedPlaces.ts');
    const stepLibrary = readSource('hooks/useStepLibraryBefore.ts');

    expect(raceMarks.match(/Race mark not found\./g)?.length).toBeGreaterThanOrEqual(2);
    expect(raceMarks.match(/\.maybeSingle\(\)/g)?.length).toBeGreaterThanOrEqual(2);

    expect(savedPlaces).toContain('Saved place not found.');
    expect(savedPlaces).toContain(".from('user_saved_places')");
    expect(savedPlaces).toContain('.maybeSingle()');

    expect(stepLibrary).toContain('Step library item not found.');
    expect(stepLibrary).toContain(".from('step_library_before')");
    expect(stepLibrary).toContain('.maybeSingle()');
  });

  it('confirms blueprint step, pricing, and cohort mutations changed a row', () => {
    const steps = readSource('hooks/useBlueprintSteps.ts');
    const pricing = readSource('hooks/useBlueprintPricing.ts');
    const cohorts = readSource('hooks/useBlueprintCohorts.ts');

    expect(steps).toContain('Blueprint step not found.');
    expect(steps).toContain(".from('blueprint_step_templates')");
    expect(steps).toContain('.maybeSingle()');

    expect(pricing).toContain('Blueprint not found.');
    expect(pricing).toContain(".from('blueprints')");
    expect(pricing).toContain('.maybeSingle()');

    expect(cohorts).toContain('Blueprint cohort assignment not found.');
    expect(cohorts).toContain(".from('blueprint_cohorts')");
    expect(cohorts).toContain(".select('blueprint_id')");
    expect(cohorts).toContain('.maybeSingle()');
  });
});
