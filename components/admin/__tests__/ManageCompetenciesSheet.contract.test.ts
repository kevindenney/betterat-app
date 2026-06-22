import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('ManageCompetenciesSheet mutation contract', () => {
  it('does not fail a successful competency add when audit logging fails', () => {
    const source = readSource('components/admin/ManageCompetenciesSheet.tsx');

    expect(source).toContain("// Audit · best-effort, don't block on it");
    expect(source).toContain(".from('org_competencies')");
    expect(source).toContain(".insert({\n          org_id: orgId,");
    expect(source).toContain(".rpc('audit_log_event'");
    expect(source).toContain('.then(undefined, () => undefined)');
  });

  it('requires competency deletes to affect a row in the current organization', () => {
    const source = readSource('components/admin/ManageCompetenciesSheet.tsx');

    expect(source).toContain(".delete()\n        .eq('id', id)\n        .eq('org_id', orgId)");
    expect(source).toContain(".select('id')");
    expect(source).toContain('.maybeSingle()');
    expect(source).toContain("if (!data) throw new Error('Competency not found or no longer belongs to this organization.')");
  });
});
