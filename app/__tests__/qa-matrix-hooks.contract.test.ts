import fs from 'fs';
import path from 'path';

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('QA matrix automation hook contracts', () => {
  it('keeps requester/admin learn cues stable', () => {
    const source = read('app/(tabs)/learn.tsx');

    expect(source).toContain('Admin tools');
    expect(source).toContain('Request sent');
    expect(source).toContain('Invite required');
    expect(source).toContain('Use invite token');
    expect(source).toContain('Restricted');
    // Cohort surface was simplified to a pill row labelled "Your cohort(s)".
    expect(source).toContain('Your cohort');
    expect(source).toContain('Leave organization?');
  });

  it('keeps members management actions and filters available', () => {
    const source = read('app/organization/members.tsx');

    expect(source).toContain('Search members');
    expect(source).toContain('Role');
    expect(source).toContain('Reset to pending');
    expect(source).toContain('Remove access');
    expect(source).toContain("setSortOption('status')");
    expect(source).toContain("setSortOption('role')");
  });

  it('keeps cohort and blueprint authoring cues available', () => {
    const cohortsSource = read('app/organization/cohorts.tsx');
    const cohortDetailSource = read('app/organization/cohort/[cohortId].tsx');
    // Route is still /organization/templates for back-compat; screen is now
    // the Blueprints management surface (templates.tsx header comment).
    const blueprintsSource = read('app/organization/templates.tsx');

    expect(cohortsSource).toContain('Create cohort');
    expect(cohortDetailSource).toContain('Add members');
    expect(blueprintsSource).toContain('Generate blueprint');
    expect(blueprintsSource).toContain('New blueprint');
    expect(blueprintsSource).toContain('Create empty blueprint');
  });
});
