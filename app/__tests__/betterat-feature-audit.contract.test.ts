import fs from 'node:fs';
import path from 'node:path';

function walkFiles(dir: string, predicate: (filePath: string) => boolean): string[] {
  const entries = fs.readdirSync(path.resolve(process.cwd(), dir), {withFileTypes: true});
  return entries.flatMap((entry) => {
    const relativePath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(relativePath, predicate);
    return predicate(relativePath) ? [relativePath] : [];
  });
}

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('BetterAt feature audit tracker contract', () => {
  it('keeps the canonical QA tracker aligned with the current route/backend surface', () => {
    const audit = read('docs/qa/betterat-feature-audit.md');
    const routeCount = walkFiles(
      'app',
      (filePath) =>
        /\.(ts|tsx)$/.test(filePath) &&
        !filePath.includes(`${path.sep}__tests__${path.sep}`),
    ).length;
    const edgeFunctionCount = walkFiles(
      'supabase/functions',
      (filePath) => filePath.endsWith(`${path.sep}index.ts`),
    ).length;

    expect(audit).toContain('Canonical QA tracker');
    expect(audit).toContain(`\`app/\` route and screen files: ${routeCount} non-test files`);
    expect(audit).toContain(`Supabase edge functions: ${edgeFunctionCount}`);
    expect(audit).toContain('## Feature Matrix');
    expect(audit).toContain('## Phase 3 Failure Log');
  });

  it('tracks the highest-risk BetterAt feature groups by stable ID', () => {
    const audit = read('docs/qa/betterat-feature-audit.md');
    const requiredFeatureIds = [
      'BA-AUTH-001',
      'BA-PRACTICE-001',
      'BA-PRACTICE-003',
      'BA-STEP-001',
      'BA-LIB-001',
      'BA-BLUEPRINT-001',
      'BA-DISCOVER-001',
      'BA-ATLAS-001',
      'BA-ORG-ADMIN-001',
      'BA-RACE-001',
      'BA-CLUB-001',
      'BA-AI-001',
    ];

    for (const featureId of requiredFeatureIds) {
      expect(audit).toContain(featureId);
    }
  });

  it('documents package verification commands without inventing a missing build script', () => {
    const audit = read('docs/qa/betterat-feature-audit.md');
    const packageJson = JSON.parse(read('package.json')) as {scripts?: Record<string, string>};

    expect(packageJson.scripts?.lint).toBeDefined();
    expect(packageJson.scripts?.typecheck).toBeDefined();
    expect(packageJson.scripts?.test).toBeDefined();
    expect(packageJson.scripts?.build).toBeUndefined();
    expect(packageJson.scripts?.['build:web']).toBeDefined();
    expect(audit).toContain('no script named exactly `build`');
    expect(audit).toContain('closest existing build command is `build:web`');
  });
});
