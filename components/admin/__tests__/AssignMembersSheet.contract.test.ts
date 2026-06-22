import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('AssignMembersSheet mutation contract', () => {
  it('assigns cohort members idempotently using the cohort/user unique key', () => {
    const source = readSource('components/admin/AssignMembersSheet.tsx');

    expect(source).toContain('idempotently upserts them into betterat_org_cohort_members');
    expect(source).toContain(".from('betterat_org_cohort_members')");
    expect(source).toContain(".upsert(payload, { onConflict: 'cohort_id,user_id', ignoreDuplicates: true })");
    expect(source).not.toContain(".from('betterat_org_cohort_members')\n        .insert(payload)");
    expect(source).toContain(".rpc('audit_log_event'");
    expect(source).toContain('.then(undefined, () => undefined)');
  });
});
