import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('AdminBillingSurface contracts', () => {
  it('initializes live checkout handler before no-billing early returns render buttons', () => {
    const source = readSource('components/admin/AdminBillingSurface.tsx');
    const handlerIndex = source.indexOf('const handleStartLiveCheckout = async');
    const noBillingIndex = source.indexOf('if (!billing) {');
    const buttonIndex = source.indexOf('onPress={() => handleStartLiveCheckout(plan.id)}');

    expect(handlerIndex).toBeGreaterThan(-1);
    expect(noBillingIndex).toBeGreaterThan(handlerIndex);
    expect(buttonIndex).toBeGreaterThan(noBillingIndex);
  });
});
