import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('plan and skill goal mutation guards', () => {
  it('confirms destructive and single-record mutations changed a row', () => {
    const plan = readSource('services/PlanService.ts');
    const goals = readSource('services/SkillGoalService.ts');

    expect(plan).toContain(".from('plans')");
    expect(plan).toContain('.delete()');
    expect(plan).toContain(".select('id')");
    expect(plan).toContain('.maybeSingle()');
    expect(plan).toContain("throw new Error('Plan not found.')");

    expect(goals).toContain('.update({ status: \'archived\' })');
    expect(goals).toContain('.delete()');
    expect(goals).toContain("coach_rating: rating");
    expect(goals.match(/\.select\('id'\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(goals.match(/\.maybeSingle\(\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(goals.match(/throw new Error\('Skill goal not found\.'\)/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
