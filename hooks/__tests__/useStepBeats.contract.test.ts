import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('useStepBeats mutation contracts', () => {
  it('confirms optimistic beat mutations changed the intended row', () => {
    const source = readSource('hooks/useStepBeats.ts');

    expect(source).toContain("function assertChangedStepBeat(data: { id: string } | null): void");
    expect(source).toContain("throw new Error('Step beat not found.')");
    expect(source).toContain('.update(patch)');
    expect(source).toContain('.delete()');
    expect(source).toContain('.update({ done })');
    expect(source).toContain('.update({ position: idx + 1 })');
    expect(source).toContain(".select('id')");
    expect(source).toContain('.maybeSingle()');
    expect(source.match(/assertChangedStepBeat\(data\)/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
