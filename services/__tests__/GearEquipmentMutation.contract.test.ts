import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('gear and equipment mutation contracts', () => {
  it('confirms deletes and verifies primary gear targets before clearing other rows', () => {
    const gear = readSource('services/GearService.ts');
    const equipment = readSource('services/EquipmentService.ts');

    expect(gear).toContain(".select('id')");
    expect(gear).toContain(".eq('id', item.id)");
    expect(gear).toContain(".eq('user_id', item.user_id)");
    expect(gear).toContain("if (!target) throw new Error('Gear item not found.')");
    expect(gear).toContain(".neq('id', item.id)");
    expect(gear).toContain("if (!data) throw new Error('Gear item not found.')");

    expect(equipment).toContain('.delete()');
    expect(equipment).toContain(".eq('id', equipmentId)");
    expect(equipment).toContain(".select('id')");
    expect(equipment).toContain('.maybeSingle()');
    expect(equipment).toContain("throw new Error('Equipment not found')");
  });
});
