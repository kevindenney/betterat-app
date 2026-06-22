import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('AddPersonSheet invite mutation contract', () => {
  it('submits a computed invite queue instead of relying on blurred email chips', () => {
    const source = readSource('components/admin/AddPersonSheet.tsx');

    expect(source).toContain('mutationFn: async (queuedEmails: EmailChip[])');
    expect(source).toContain('if (queuedEmails.length === 0)');
    expect(source).toContain('const payload = queuedEmails.map((chip) => ({');
    expect(source).toContain('function sendQueuedInvites()');
    expect(source).toContain('const draftChips = parseDraftChips(emailDraft);');
    expect(source).toContain('const queuedEmails = [...emails, ...draftChips];');
    expect(source).toContain('sendMutation.mutate(queuedEmails);');
    expect(source).not.toContain('onPress={() => sendMutation.mutate()}');
  });

  it('does not fail sent invites when audit logging fails', () => {
    const source = readSource('components/admin/AddPersonSheet.tsx');

    expect(source).toContain(".from('organization_invites')");
    expect(source).toContain(".functions.invoke(\n          'send-org-invite'");
    expect(source).toContain(".rpc('audit_log_event'");
    expect(source).toContain('.then(undefined, () => undefined)');
  });
});
