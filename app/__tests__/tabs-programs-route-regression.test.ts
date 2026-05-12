import fs from 'node:fs';
import path from 'node:path';

const appTabsDir = path.resolve(__dirname, '..', '(tabs)');

function readTabFile(name: string): string {
  return fs.readFileSync(path.join(appTabsDir, name), 'utf8');
}

describe('tabs programs route regression', () => {
  it('keeps programs as canonical route and race-management as alias', () => {
    const programsSource = readTabFile('programs.tsx');
    const raceManagementSource = readTabFile('race-management.tsx');

    expect(programsSource).toContain("./programs-experience");
    expect(raceManagementSource).toContain('trackRaceManagementAliasUsage');
    expect(raceManagementSource).toContain("isFeatureEnabled('RACE_MANAGEMENT_ALIAS_REDIRECT_ONLY')");
    expect(raceManagementSource).toContain('<Redirect href="/(tabs)/programs" />');
    expect(raceManagementSource).toContain('<ProgramsExperience />');
  });

  it('registers both programs and race-management tab screens in layout', () => {
    const layoutSource = readTabFile('_layout.tsx');

    expect(layoutSource).toContain('name="programs"');
    expect(layoutSource).toContain('name="race-management"');
    // After f0f35634 visibility is gated via tabBarButton, not href.
    expect(layoutSource).toContain("tabBarButton: !isTabVisible('programs')");
    expect(layoutSource).toContain("tabBarButton: !isTabVisible('race-management')");
  });
});
