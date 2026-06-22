import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('CohortEditSheet mutation contract', () => {
  it('requires cohort edits to match the org row and keeps audit logging best-effort', () => {
    const source = readSource('components/admin/CohortEditSheet.tsx');

    expect(source).toContain(".from('betterat_org_cohorts')");
    expect(source).toContain('.update(payload)');
    expect(source).toContain(".eq('id', cohortId)");
    expect(source).toContain(".eq('org_id', orgId)");
    expect(source).toContain(".select('id')");
    expect(source).toContain('.maybeSingle()');
    expect(source).toContain('if (!data) throw new Error');
    expect(source).toContain('Cohort could not be saved.');
    expect(source).toContain(".rpc('audit_log_event'");
    expect(source).toContain('.then(undefined, () => undefined)');
  });
});
