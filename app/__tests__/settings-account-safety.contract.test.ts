import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('settings account safety contracts', () => {
  it('guards account deletion behind an authenticated user id and concrete reauth email', () => {
    const source = readSource('app/settings/delete-account.tsx');

    expect(source).toContain('if (!user?.id)');
    expect(source).toContain("showAlert('Error', 'You must be signed in to delete your account')");
    expect(source).toContain('if (!isOAuthUser && !user.email)');
    expect(source).toContain("showAlert('Error', 'No email address is available for password confirmation')");
    expect(source).toContain('email: user.email');
    expect(source).toContain(".eq('id', user.id)");
    expect(source).toContain(".select('id')");
    expect(source).toContain('.maybeSingle()');
    expect(source).toContain("throw new Error('Could not schedule account deletion.')");
    expect(source).not.toContain(".eq('id', user?.id)");
  });

  it('does not report password reset success until Supabase returns without error', () => {
    const source = readSource('app/settings/change-password.tsx');

    expect(source).toContain('if (!user?.email)');
    expect(source).toContain("showAlert('Error', 'No email address is available for password confirmation')");
    expect(source).toContain("showAlert('Error', 'No email address is available for password reset')");
    expect(source).toContain('const { error } = await supabase.auth.resetPasswordForEmail(user.email);');
    expect(source).toContain('if (error) throw error;');
    expect(source).not.toContain("await supabase.auth.resetPasswordForEmail(user?.email || '')");
  });

  it('confirms connected-service disconnects are scoped to the signed-in user', () => {
    const telegram = readSource('app/settings/telegram.tsx');
    const whatsapp = readSource('app/settings/whatsapp.tsx');

    for (const source of [telegram, whatsapp]) {
      expect(source).toContain('if (!link || !user?.id) return;');
      expect(source).toContain(".eq('id', link.id)");
      expect(source).toContain(".eq('user_id', user.id)");
      expect(source).toContain(".select('id')");
      expect(source).toContain('.maybeSingle()');
    }
    expect(telegram).toContain("throw new Error('Telegram link not found.')");
    expect(whatsapp).toContain("throw new Error('WhatsApp link not found.')");
  });
});
