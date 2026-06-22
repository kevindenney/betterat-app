import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('useOrgSecurity contracts', () => {
  it('scopes verified-domain removal to the current org and detects zero-row deletes', () => {
    const source = readSource('hooks/useOrgSecurity.ts');

    expect(source).toContain(".from('org_verified_domains')");
    expect(source).toContain(".delete()\n        .eq('id', domainId)\n        .eq('org_id', orgId)");
    expect(source).toContain(".select('id')\n        .maybeSingle()");
    expect(source).toContain(
      "throw new Error('Domain not found or you do not have access to remove it.')",
    );
  });
});
