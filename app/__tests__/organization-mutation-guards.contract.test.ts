import fs from 'node:fs';
import path from 'node:path';

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('organization mutation guards', () => {
  it('treats no-row member updates as failed writes', () => {
    const source = read('app/organization/members.tsx');

    expect(source).toContain(".eq('id', row.id)");
    expect(source).toContain(".eq('organization_id', resolvedActiveOrgId)");
    expect(source).toContain(".select('id')");
    expect(source).toContain('.maybeSingle()');
    expect(source).toContain('Member not found or you do not have access to update them.');
    expect(source).toContain('Member not found or you do not have access to remove them.');
  });

  it('treats no-row access request decisions as failed writes', () => {
    const source = read('app/organization/access-requests.tsx');

    expect(source).toContain(".update(updatePayload)");
    expect(source).toContain(".eq('id', request.id)");
    expect(source).toContain(".eq('organization_id', resolvedActiveOrgId)");
    expect(source).toContain(".select('id')");
    expect(source).toContain('.maybeSingle()');
    expect(source).toContain('Request not found or you do not have access to update it.');
  });

  it('keeps cohort member add/remove idempotent and confirmed', () => {
    const source = read('app/organization/cohort/[cohortId].tsx');

    expect(source).toContain(".upsert({");
    expect(source).toContain("}, { onConflict: 'cohort_id,user_id', ignoreDuplicates: true })");
    expect(source).toContain(".eq('cohort_id', cohortId)");
    expect(source).toContain(".eq('user_id', userId)");
    expect(source).toContain(".select('user_id')");
    expect(source).toContain('.maybeSingle()');
    expect(source).toContain('Cohort member not found or you do not have access to remove them.');
  });
});
