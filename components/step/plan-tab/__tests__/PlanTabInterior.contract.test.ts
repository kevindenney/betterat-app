import fs from 'fs';
import path from 'path';

const interiorSource = fs.readFileSync(
  path.join(__dirname, '..', 'PlanTabInterior.tsx'),
  'utf8',
);
const coachSource = fs.readFileSync(
  path.join(__dirname, '..', 'PlanCoachCard.tsx'),
  'utf8',
);
const source = `${interiorSource}\n${coachSource}`;

describe('PlanTabInterior contract', () => {
  it('contains the canonical Plan field labels', () => {
    expect(source).toContain('WHAT WILL YOU DO?');
    expect(source).toContain('HOW WILL YOU DO IT?');
    expect(source).toContain('WHY IS THIS NEXT?');
  });

  it('contains the canonical AI Coach entry points', () => {
    expect(source).toContain('Build with AI Coach');
    expect(source).toContain('Continue with AI Coach');
    expect(source).toContain('or fill in manually');
  });

  it('contains the ready-state label', () => {
    expect(source).toContain('Plan ready');
  });
});
