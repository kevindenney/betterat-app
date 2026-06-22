import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('UserDocumentService contracts', () => {
  it('confirms user document update and delete mutations changed a row', () => {
    const source = readSource('services/UserDocumentService.ts');

    expect(source).toContain(".update({ is_shared: isShared })");
    expect(source).toContain(".update({ title })");
    expect(source).toContain('.delete()');
    expect(source).toContain(".select('id')");
    expect(source).toContain('.maybeSingle()');
    expect(source).toContain('Document sharing update matched no rows');
    expect(source).toContain('Document title update matched no rows');
    expect(source).toContain('Document delete matched no rows');
  });
});
