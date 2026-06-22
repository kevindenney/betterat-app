import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('PublicFaceSettingsService contracts', () => {
  it('confirms public-face interest mutations changed the intended row', () => {
    const source = readSource('services/PublicFaceSettingsService.ts');

    expect(source).toContain("if (!current) throw new Error('Interest not found.')");
    expect(source).toContain(".update(updatePayload)");
    expect(source).toContain(".update({ is_primary: true, is_active: true })");
    expect(source).toContain(".update({ sort_order: sortOrder })");
    expect(source).toContain(".update({ is_primary: true })");
    expect(source).toContain(".select('interest_id')");
    expect(source).toContain('.maybeSingle()');
    expect(source).toContain("if (!updated) throw new Error('Interest not found.')");
    expect(source).toContain("const missing = results.find((result) => !result.data)");
    expect(source).toContain(".neq('interest_id', membershipId)");
  });
});
