import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('BlueprintCohortLinkSheet mutation contract', () => {
  it('links cohorts idempotently using the blueprint_cohorts composite key', () => {
    const source = readSource('components/admin/BlueprintCohortLinkSheet.tsx');

    expect(source).toContain('composite PK blueprint_id+cohort_id');
    expect(source).toContain(".from('blueprint_cohorts')");
    expect(source).toContain('.upsert(payload, { onConflict: \'blueprint_id,cohort_id\', ignoreDuplicates: true })');
    expect(source).not.toContain(".from('blueprint_cohorts').insert(payload)");
    expect(source).toContain(".rpc('audit_log_event'");
    expect(source).toContain('.then(undefined, () => undefined)');
  });
});
