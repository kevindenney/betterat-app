import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('BlueprintService mutation guards', () => {
  it('confirms destructive and single-record blueprint mutations changed a row', () => {
    const source = readSource('services/BlueprintService.ts');

    expect(source).toContain(".from('timeline_blueprints')");
    expect(source).toContain(".from('blueprint_steps')");
    expect(source).toContain(".from('blueprint_subscriptions')");
    expect(source).toContain(".select('id')");
    expect(source).toContain(".select('step_id')");
    expect(source).toContain('.maybeSingle()');
    expect(source).toContain("throw new Error('Blueprint not found.')");
    expect(source).toContain("throw new Error('Blueprint step not found.')");
    expect(source).toContain("throw new Error('Blueprint subscription not found.')");
    expect(source).toContain('if (inspirationUpdateError) throw inspirationUpdateError;');
  });
});
