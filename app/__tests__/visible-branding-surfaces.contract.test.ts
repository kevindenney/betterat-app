import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('visible BetterAt branding surface contracts', () => {
  it('keeps visible app chrome, club, map, course, and pricing copy BetterAt-branded', () => {
    const pricing = readSource('components/landing/PricingSection.tsx');
    const courseEntryPanel = readSource('components/race-detail/CourseEntryPanel.tsx');
    const gpsTrackMap = readSource('components/races/GPSTrackMapView.web.tsx');
    const navigationDrawer = readSource('components/navigation/NavigationDrawer.tsx');
    const mapTab = readSource('app/(tabs)/map.tsx');
    const clubDashboard = readSource('app/club-dashboard.tsx');

    expect(pricing).toContain('BetterAt takes 5% only on sessions paid inside the platform.');
    expect(pricing).not.toContain('RegattaFlow takes 5% only on sessions paid inside the platform.');

    expect(courseEntryPanel).toContain('🌍 Visible to all BetterAt users');
    expect(courseEntryPanel).not.toContain('🌍 Visible to all RegattaFlow users');

    expect(gpsTrackMap).toContain('Open the BetterAt mobile app to see a live map');
    expect(gpsTrackMap).not.toContain('Open the RegattaFlow mobile app');

    expect(navigationDrawer).toContain("return activeItem?.label || 'BetterAt';");
    expect(navigationDrawer).not.toContain("return activeItem?.label || 'RegattaFlow';");

    expect(mapTab).toContain("professionalMode ? 'BetterAt Professional' : 'BetterAt Standard'");
    expect(mapTab).not.toContain("professionalMode ? 'RegattaFlow Professional' : 'RegattaFlow Standard'");

    expect(clubDashboard).toContain('Ask your club administrator to connect BetterAt');
    expect(clubDashboard).toContain('https://widgets.better.at/embed.js');
    expect(clubDashboard).not.toContain('connect RegattaFlow');
    expect(clubDashboard).not.toContain('https://widgets.regattaflow.com/embed.js');
  });

  it('keeps localized app-name values BetterAt-branded', () => {
    const localesDir = path.resolve(process.cwd(), 'lib/i18n/locales');
    const localeCodes = fs.readdirSync(localesDir);

    for (const localeCode of localeCodes) {
      const commonPath = path.join(localesDir, localeCode, 'common.json');
      const common = JSON.parse(fs.readFileSync(commonPath, 'utf8'));
      const appName = common.app?.name ?? common.app_name;

      expect(appName).toBe('BetterAt');
      expect(JSON.stringify(common)).not.toContain('"RegattaFlow"');
    }
  });
});
