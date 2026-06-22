import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('AdminShell auth gate contract', () => {
  it('redirects known signed-out visitors to login instead of leaving them on the loading shell', () => {
    const source = readSource('components/admin/AdminShell.tsx');

    expect(source).toContain('const pathname = usePathname();');
    expect(source).toContain('signOut, ready');
    expect(source).toContain('if (!ready || menu.loading || isOrgAdmin) return;');
    expect(source).toContain('if (!user) {');
    expect(source).toContain("pathname: '/(auth)/login'");
    expect(source).toContain('params: { returnTo: pathname || `/admin/${orgId}` }');
    expect(source).toContain('router.replace(getDashboardRoute(userProfile?.user_type ?? null));');
    expect(source).toContain('if (!ready || !user || menu.loading || !isOrgAdmin)');
  });
});
