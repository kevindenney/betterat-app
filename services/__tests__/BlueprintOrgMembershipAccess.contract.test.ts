import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('organization membership access checks', () => {
  it('uses the resolved membership state for program member timelines and blueprint access', () => {
    const programs = readSource('hooks/usePrograms.ts');
    const blueprintService = readSource('services/BlueprintService.ts');
    const blueprintTools = readSource('services/mcp/tools/blueprints.ts');

    expect(programs).toContain("import { isResolvedOrgMembershipActive } from '@/hooks/orgMembershipStatus'");
    expect(programs).toContain(".select('user_id, role, status, membership_status')");
    expect(programs).toContain('const activeMembers = ((members ?? []) as any[]).filter((member) => isResolvedOrgMembershipActive(member))');
    expect(programs).not.toContain(".in('membership_status', ['active'])");

    expect(blueprintService).toContain("import { isResolvedOrgMembershipActive } from '@/hooks/orgMembershipStatus'");
    expect(blueprintService).toContain(".select('id,status,membership_status')");
    expect(blueprintService).toContain('isOrgMember = data ? isResolvedOrgMembershipActive(data) : false');

    expect(blueprintTools).toContain("import { isResolvedOrgMembershipActive } from '../../../hooks/orgMembershipStatus'");
    expect(blueprintTools).toContain(".select('id,status,membership_status')");
    expect(blueprintTools).toContain('!membership || !isResolvedOrgMembershipActive(membership)');
    expect(blueprintTools).not.toContain(".in('membership_status', ['active'])");
  });
});
