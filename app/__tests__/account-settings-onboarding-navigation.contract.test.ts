import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('account, settings, onboarding, and navigation contracts', () => {
  it('routes settings users to the correct account surface by persona', () => {
    const settingsShim = readSource('app/settings.tsx');
    const accountRoute = readSource('app/account.tsx');
    const accountModal = readSource('components/account/AccountModalContent.tsx');

    expect(settingsShim).toContain('<Redirect href="/(tabs)/settings" />');
    expect(settingsShim).toContain('<Redirect href="/account" />');
    expect(accountRoute).toContain("if (Platform.OS === 'web')");
    expect(accountRoute).toContain('<WebAccountModal />');
    expect(accountRoute).toContain('<AccountModalContent />');

    expect(accountModal).toContain("router.push('/settings/public-face')");
    expect(accountModal).toContain("router.push('/(tabs)/library?zone=plans')");
    expect(accountModal).toContain("router.push('/settings/notifications')");
    expect(accountModal).toContain("router.push('/settings/organization-access')");
    expect(accountModal).toContain("router.push('/settings/change-password')");
    expect(accountModal).toContain("router.push('/settings/delete-account')");
    expect(accountModal).toContain("router.push('/subscription')");
    expect(accountModal).toContain("router.push('/(auth)/sailor-onboarding-comprehensive')");
    expect(accountModal).toContain("setTeamManagerVisible(true)");
    expect(accountModal).toContain("capabilities?.hasMentoring");
    expect(accountModal).toContain("await removeCapability('mentoring')");
    expect(accountModal).toContain("`betterat-${user?.id ?? 'demo'}@demo.betterat.app`");
    expect(accountModal).not.toContain("`regatta-${user?.id ?? 'demo'}@demo.regattaflow.io`");
    expect(accountModal).toContain("showAlert('Support', 'Email us at info@better.at')");
  });

  it('keeps profile and public-face editing behavior explicit', () => {
    const editProfile = readSource('app/settings/edit-profile.tsx');
    const publicFace = readSource('app/settings/public-face.tsx');

    expect(editProfile).toContain('ImagePicker.launchImageLibraryAsync');
    expect(editProfile).toContain('AvatarStorageService.uploadAvatar');
    expect(editProfile).toContain("router.push(`/profile/${user.id}?preview=1` as any)");
    expect(editProfile).toContain("router.push('/settings/public-face' as any)");
    expect(editProfile).toContain("queryClient.invalidateQueries({ queryKey: ['person-public-sections'] })");
    expect(editProfile).toContain("queryClient.invalidateQueries({ queryKey: ['sailor-full-profile', user.id] })");
    expect(editProfile).toContain("behavior={Platform.OS === 'ios' ? 'padding' : 'height'}");

    expect(publicFace).toContain('getPublicFaceSettings(user.id)');
    expect(publicFace).toContain('getPrivacySettings(user.id)');
    expect(publicFace).toContain('updateProfilePrivacy(user.id');
    expect(publicFace).toContain('updatePublicFaceDescriptors(');
    expect(publicFace).toContain('setPublicFacePrimaryInterest(');
    expect(publicFace).toContain('setPublicFaceInterestActive(');
    expect(publicFace).toContain('movePublicFaceInterest(');
    expect(publicFace).toContain('AvatarStorageService.uploadAvatar');
    expect(publicFace).toContain("queryClient.invalidateQueries({ queryKey: ['person-public-sections'] })");
  });

  it('preserves privacy and notification settings behavior across iOS, Android, and Chrome/web', () => {
    const privacy = readSource('app/settings/privacy.tsx');
    const notifications = readSource('app/settings/notifications.tsx');

    expect(privacy).toContain('Promise.race([');
    expect(privacy).toContain('new Promise<PrivacySettings>((resolve) =>');
    expect(privacy).toContain('}, 8000),');
    expect(privacy).toContain('const updated = { ...settings, [key]: value };');
    expect(privacy).toContain('setSettings(updated); // optimistic');
    expect(privacy).toContain('await updateProfilePrivacy(user.id, { [key]: value })');
    expect(privacy).toContain("queryClient.invalidateQueries({ queryKey: ['person-public-sections'] })");
    expect(privacy).toContain("if (Platform.OS === 'ios')");
    expect(privacy).toContain('ActionSheetIOS.showActionSheetWithOptions');
    expect(privacy).toContain('// Web/Android: cycle through options');
    expect(privacy).toContain("router.push(`/profile/${user.id}?preview=1` as any)");

    expect(notifications).toContain("Platform.OS !== 'web'");
    expect(notifications).toContain('DateTimePicker');
    expect(notifications).toContain("display={Platform.OS === 'ios' ? 'spinner' : 'default'}");
    expect(notifications).toContain("if (Platform.OS === 'android')");
    expect(notifications).toContain("Platform.OS === 'web'");
    expect(notifications).toContain('confirmWebTime');
    expect(notifications).toContain("webTimeInput.match(/^(\\d{1,2}):(\\d{2})$/)");
    expect(notifications).toContain("await NotificationService.updatePreferences(user.id, patch)");
    expect(notifications).toContain("supabase.from('user_preferences').upsert");
    expect(notifications).toContain("await Promise.all([");
  });

  it('keeps connected services and devices scoped, persona-aware, and BetterAt-branded', () => {
    const connectedDevices = readSource('app/settings/connected-devices.tsx');
    const telegram = readSource('app/settings/telegram.tsx');
    const whatsapp = readSource('app/settings/whatsapp.tsx');
    const clubSettings = readSource('app/(tabs)/settings.tsx');

    expect(connectedDevices).toContain("const isSailing = currentInterest?.slug === 'sail-racing'");
    expect(connectedDevices).toContain('? [...UNIVERSAL_DEVICES, ...SAILING_DEVICES]');
    expect(connectedDevices).toContain(': UNIVERSAL_DEVICES');
    expect(connectedDevices).toContain('mailto:info@better.at?subject=Device%20Integration%20Feedback');
    expect(connectedDevices).not.toContain('mailto:support@regattaflow.com?subject=Device%20Integration%20Feedback');
    expect(clubSettings).toContain("showAlert('Support', 'Email us at info@better.at')");
    expect(clubSettings).toContain("`betterat-${user?.id ?? 'demo'}@demo.betterat.app`");
    expect(clubSettings).not.toContain("showAlert('Support', 'Email us at support@regattaflow.com')");
    expect(clubSettings).not.toContain("`regatta-${user?.id ?? 'demo'}@demo.regattaflow.io`");

    for (const source of [telegram, whatsapp]) {
      expect(source).toContain('if (!link || !user?.id) return;');
      expect(source).toContain(".eq('id', link.id)");
      expect(source).toContain(".eq('user_id', user.id)");
    }
  });

  it('keeps canonical navigation in sync for bottom tabs, web sidebar, and route helpers', () => {
    const navConfig = readSource('lib/navigation-config.ts');
    const floatingTabBar = readSource('components/navigation/FloatingTabBar.tsx');
    const webSidebar = readSource('components/navigation/WebSidebarNav.tsx');

    expect(navConfig).toContain("return '/(tabs)/events'");
    expect(navConfig).toContain("return '/(tabs)/practice'");
    expect(navConfig).toContain("{ name: 'races', title: 'Practice'");
    expect(navConfig).toContain("{ key: 'races', label: 'Practice', route: '/(tabs)/practice'");
    expect(navConfig).toContain("{ key: 'racing', label: 'Programs & Placements', route: '/(tabs)/programs'");
    expect(navConfig).toContain('export const SAILOR_SECONDARY_ITEMS: NavItem[] = []');
    expect(navConfig).toContain('export const LEARNER_FOOTER_ITEMS: NavItem[] = []');
    expect(navConfig).toContain("route.replace('/(tabs)/', '/').replace('/index', '')");

    expect(floatingTabBar).toContain("Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'");
    expect(floatingTabBar).toContain("Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'");
    expect(floatingTabBar).toContain("const androidBottomExtra = Platform.OS === 'android' ? 12 : 0");
    expect(floatingTabBar).toContain("web: {\n        position: 'fixed'");
    expect(floatingTabBar).toContain('scrollHidden.value * scrollHideDistance');
    expect(floatingTabBar).toContain('badgeCount > 99 ?');

    expect(webSidebar).toContain('export const WEB_SIDEBAR_WIDTH = 280');
    expect(webSidebar).toContain("router.push('/?view=landing'");
    expect(webSidebar).toContain("handleNavigation('/(auth)/login')");
    expect(webSidebar).toContain("handleNavigation('/(auth)/signup')");
  });

  it('keeps welcome and onboarding routes resumable and platform-neutral', () => {
    const welcome = readSource('app/welcome.tsx');
    const onboardingIndex = readSource('app/onboarding/index.tsx');
    const chooseStart = readSource('app/onboarding/choose-start.tsx');
    const onboardingState = readSource('services/onboarding/OnboardingStateService.ts');
    const featureTour = readSource('services/onboarding/FeatureTourService.ts');
    const sailorSampleData = readSource('services/onboarding/SailorSampleDataService.ts');

    // /welcome is a legacy alias for the value funnel. It must re-export the
    // pick-craft screen (NOT navigate): <Redirect> during initial mount races
    // the value stack's route resolution on web, and router.replace in an
    // effect fires before the Root Layout mounts on cold load.
    expect(welcome).toContain("export { default } from './onboarding/value/pick-craft';");

    expect(onboardingIndex).toContain('OnboardingStateService.getStartingRoute()');
    expect(onboardingIndex).toContain('router.replace(startingRoute as any)');
    expect(onboardingState).toContain("return '/onboarding/profile/name-photo'");

    expect(chooseStart).toContain("AsyncStorage.getItem('onboarding_interest_order')");
    expect(chooseStart).toContain("AsyncStorage.getItem('onboarding_interest_slug')");
    expect(chooseStart).toContain('await switchInterest(selectedSlug)');
    expect(chooseStart).toContain('await OnboardingStateService.markOnboardingSeen()');
    expect(chooseStart).toContain("AsyncStorage.getItem('post_onboarding_return_to')");
    expect(chooseStart).toContain("router.replace(returnTo as any)");
    expect(chooseStart).toContain("router.replace('/onboarding/connect-telegram')");
    expect(chooseStart).toContain("paddingTop: Platform.OS === 'ios' ? 60 : 48");

    expect(featureTour).toContain('BetterAt helps you prepare for races, learn tactics, and track your progress.');
    expect(featureTour).toContain('BetterAt helps you track progress, learn from others, and stay on top of your goals.');
    expect(featureTour).not.toContain('RegattaFlow helps you prepare for races');
    expect(sailorSampleData).toContain('sample-crew-${index + 1}@betterat.local');
    expect(sailorSampleData).not.toContain('sample-crew-${index + 1}@regattaflow.local');
  });
});
