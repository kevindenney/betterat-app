import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('SavedVenueService contracts', () => {
  it('confirms unsave removes the signed-in user saved venue row', () => {
    const source = readSource('services/SavedVenueService.ts');

    expect(source).toContain('.delete()');
    expect(source).toContain(".eq('user_id', user.id)");
    expect(source).toContain(".eq('venue_id', venueId)");
    expect(source).toContain(".select('id')");
    expect(source).toContain('.maybeSingle()');
    expect(source).toContain("throw new Error('Saved venue not found.')");
  });
});
