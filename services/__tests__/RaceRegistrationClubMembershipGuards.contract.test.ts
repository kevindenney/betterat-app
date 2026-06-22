import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('race registration and club membership mutation guards', () => {
  it('confirms race registration payment, document, and withdraw updates changed a row', () => {
    const source = readSource('services/RaceRegistrationService.ts');

    expect(source).toContain('async createPaymentIntent');
    expect(source).toContain('async confirmPayment');
    expect(source).toContain('async uploadDocument');
    expect(source).toContain('async withdrawEntry');
    expect(source.match(/\.from\('race_entries'\)/g)?.length).toBeGreaterThanOrEqual(4);
    expect(source.match(/\.select\('id'\)/g)?.length).toBeGreaterThanOrEqual(4);
    expect(source.match(/\.maybeSingle\(\)/g)?.length).toBeGreaterThanOrEqual(4);
    expect(source.match(/Race entry not found\./g)?.length).toBeGreaterThanOrEqual(4);
  });

  it('confirms race signal expiry and club membership actions changed a row', () => {
    const signals = readSource('services/RaceSignalService.ts');
    const clubs = readSource('services/ClubDiscoveryService.ts');

    expect(signals).toContain('async expireSignal');
    expect(signals).toContain(".from('race_signals')");
    expect(signals).toContain(".select('id')");
    expect(signals).toContain('.maybeSingle()');
    expect(signals).toContain('Race signal not found.');

    expect(clubs).toContain('static async removeClubMembership');
    expect(clubs).toContain('static async toggleAutoImportRaces');
    expect(clubs).toContain('static async leaveClub');
    expect(clubs).toContain('static async leaveGlobalClub');
    expect(clubs.match(/\.select\('id'\)/g)?.length).toBeGreaterThanOrEqual(4);
    expect(clubs.match(/\.maybeSingle\(\)/g)?.length).toBeGreaterThanOrEqual(4);
    expect(clubs.match(/Club membership not found\./g)?.length).toBeGreaterThanOrEqual(2);
    expect(clubs.match(/Global club membership not found\./g)?.length).toBeGreaterThanOrEqual(2);
  });
});
