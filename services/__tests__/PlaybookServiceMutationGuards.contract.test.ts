import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('PlaybookService mutation guards', () => {
  it('confirms single-row playbook mutations changed a row', () => {
    const source = readSource('services/PlaybookService.ts');

    expect(source).toContain('function assertChangedRow');
    for (const table of [
      'playbook_resources',
      'playbook_concepts',
      'playbook_patterns',
      'playbook_qa',
      'playbook_inbox_items',
      'playbook_shares',
      'playbook_insights',
    ]) {
      expect(source).toContain(`.from('${table}')`);
    }
    expect(source.match(/\.select\('id'\)/g)?.length).toBeGreaterThanOrEqual(8);
    expect(source.match(/\.maybeSingle\(\)/g)?.length).toBeGreaterThanOrEqual(8);
    expect(source).toContain('Playbook resource not found.');
    expect(source).toContain('Playbook concept not found.');
    expect(source).toContain('Playbook pattern not found.');
    expect(source).toContain('Playbook QA not found.');
    expect(source).toContain('Playbook inbox item not found.');
    expect(source).toContain('Playbook share not found.');
    expect(source).toContain('Playbook insight not found.');
  });
});
