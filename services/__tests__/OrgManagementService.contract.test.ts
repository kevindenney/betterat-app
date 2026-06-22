import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('OrgManagementService mutation contract', () => {
  it('requires archiveOrg to confirm an organization row was updated', () => {
    const source = readSource('services/OrgManagementService.ts');

    expect(source).toContain('static async archiveOrg(orgId: string): Promise<void>');
    expect(source).toContain(".update({\n        status: 'archived'");
    expect(source).toContain(".eq('id', orgId)\n      .select('id')\n      .maybeSingle()");
    expect(source).toContain("if (!data) {\n      throw new Error('Organization not found or you do not have access to archive it.')");
  });
});
