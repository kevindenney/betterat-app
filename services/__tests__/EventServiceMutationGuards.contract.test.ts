import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('event service mutation guards', () => {
  it('confirms event and event document deletes changed a row', () => {
    const source = readSource('services/eventService.ts');

    expect(source).toContain('static async deleteEvent');
    expect(source).toContain('static async deleteDocument');
    expect(source).toContain('Event not found.');
    expect(source).toContain('Event document not found.');
    expect(source.match(/\.select\('id'\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(source.match(/\.maybeSingle\(\)/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
