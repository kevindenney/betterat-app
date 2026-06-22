import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('connected service webhook contracts', () => {
  it('consumes Telegram link codes conditionally so concurrent callers cannot relink the same code', () => {
    const source = readSource('api/telegram/link.ts');

    expect(source).toContain('.eq(\'link_code\', code.toUpperCase())');
    expect(source).toContain(".is('linked_at', null)");
    expect(source).toContain(".select('id')");
    expect(source).toContain('.maybeSingle()');
    expect(source).toContain('if (!updatedLink)');
    expect(source).toContain("res.status(400).json({ error: 'Invalid or expired link code' })");
  });

  it('has a real WhatsApp link completion endpoint for webhook-issued settings links', () => {
    const apiSource = readSource('api/whatsapp/link.ts');
    const settingsSource = readSource('app/settings/whatsapp.tsx');
    const webhookSource = readSource('api/whatsapp/webhook.ts');

    expect(webhookSource).toContain('/settings/whatsapp?code=');
    expect(settingsSource).toContain('/api/whatsapp/link');
    expect(settingsSource).toContain(".from('whatsapp_links')");
    expect(apiSource).toContain(".from('whatsapp_links')");
    expect(apiSource).toContain(".eq('link_code', normalizedCode)");
    expect(apiSource).toContain(".is('linked_at', null)");
    expect(apiSource).toContain(".select('id')");
    expect(apiSource).toContain('.maybeSingle()');
    expect(apiSource).toContain('if (!updatedLink)');
    expect(apiSource).toContain("res.status(400).json({error: 'Invalid or expired link code'})");
  });

  it('does not approve WhatsApp webhook verification when the verify token is unconfigured', () => {
    const source = readSource('api/whatsapp/webhook.ts');

    expect(source).toContain('const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;');
    expect(source).toContain("if (verifyToken && mode === 'subscribe' && token === verifyToken && typeof challenge === 'string')");
    expect(source).not.toContain("if (mode === 'subscribe' && token === verifyToken && typeof challenge === 'string')");
    expect(source).toContain("res.status(403).end();");
  });
});
