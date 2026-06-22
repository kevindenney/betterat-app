import fs from 'node:fs';
import path from 'node:path';

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('Library and Discover state contracts', () => {
  const discoverSource = read('app/(tabs)/discover.tsx');
  const plansZoneSource = read('components/library/zones/PlansZone.tsx');
  const peopleZoneSource = read('components/library/zones/PeopleZone.tsx');
  const resourcesZoneSource = read('components/library/resources/ResourcesZone.tsx');

  it('keeps legacy Discover segment redirects mapped to their Library-era homes', () => {
    expect(discoverSource).toContain("raw === 'organizations' ? 'orgs'");
    expect(discoverSource).toContain("raw === 'blueprints' ? 'plans'");
    expect(discoverSource).toContain("href = '/(tabs)/watch'");
    expect(discoverSource).toContain("href = '/(tabs)/atlas'");
    expect(discoverSource).toContain("href = '/(tabs)/library?zone=follow'");
    expect(discoverSource).toContain("href = '/(tabs)/library?zone=orgs'");
    expect(discoverSource).toContain("href = '/(tabs)/library?zone=interests'");
    expect(discoverSource).toContain("href = '/(tabs)/library?zone=today'");
  });

  it('does not collapse plan loading or query errors into the empty-plan state', () => {
    expect(plansZoneSource).toContain('isLoading');
    expect(plansZoneSource).toContain('error');
    expect(plansZoneSource).toContain('refetch');
    expect(plansZoneSource).toContain('Could not load plans');
    expect(plansZoneSource).toContain('Retry loading plans');
    expect(plansZoneSource).toContain('No Blueprints yet');

    const loadingIndex = plansZoneSource.indexOf('if (isLoading)');
    const errorIndex = plansZoneSource.indexOf('if (error)');
    const emptyIndex = plansZoneSource.indexOf('if (!plans || plans.length === 0)');
    expect(loadingIndex).toBeGreaterThan(-1);
    expect(errorIndex).toBeGreaterThan(loadingIndex);
    expect(emptyIndex).toBeGreaterThan(errorIndex);
  });

  it('does not collapse people loading or query errors into the empty-following state', () => {
    expect(peopleZoneSource).toContain('isLoading');
    expect(peopleZoneSource).toContain('error');
    expect(peopleZoneSource).toContain('refetch');
    expect(peopleZoneSource).toContain('Could not load people');
    expect(peopleZoneSource).toContain('Retry loading people');
    expect(peopleZoneSource).toContain('Not following anyone yet');

    const loadingIndex = peopleZoneSource.indexOf('if (isLoading)');
    const errorIndex = peopleZoneSource.indexOf('if (error)');
    const emptyIndex = peopleZoneSource.indexOf('if (!people || people.length === 0)');
    expect(loadingIndex).toBeGreaterThan(-1);
    expect(errorIndex).toBeGreaterThan(loadingIndex);
    expect(emptyIndex).toBeGreaterThan(errorIndex);
  });

  it('keeps Resources capture available while showing resource loading and error states', () => {
    expect(resourcesZoneSource).toContain('Drop something in');
    expect(resourcesZoneSource).toContain('isLoading: zonesLoading');
    expect(resourcesZoneSource).toContain('error: zonesError');
    expect(resourcesZoneSource).toContain('refetch: refetchZones');
    expect(resourcesZoneSource).toContain('Could not load resources');
    expect(resourcesZoneSource).toContain('Retry loading resources');
    expect(resourcesZoneSource).toContain('Loading resources…');

    const dropInIndex = resourcesZoneSource.indexOf('Drop something in');
    const errorIndex = resourcesZoneSource.indexOf('zonesError ?');
    const loadingIndex = resourcesZoneSource.indexOf('zonesLoading && !zones');
    const recentGuardIndex = resourcesZoneSource.indexOf('!zonesError && !(zonesLoading && !zones)');
    expect(dropInIndex).toBeGreaterThan(-1);
    expect(errorIndex).toBeGreaterThan(dropInIndex);
    expect(loadingIndex).toBeGreaterThan(errorIndex);
    expect(recentGuardIndex).toBeGreaterThan(loadingIndex);
  });
});
