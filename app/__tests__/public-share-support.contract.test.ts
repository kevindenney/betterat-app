import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('public, share, support, and install surface contracts', () => {
  it('keeps support, privacy, and terms routes BetterAt-branded with safe back fallbacks', () => {
    const support = readSource('app/support.tsx');
    const privacy = readSource('app/privacy.tsx');
    const terms = readSource('app/terms.tsx');

    expect(support).toContain("const SUPPORT_EMAIL = 'info@better.at'");
    expect(support).toContain('Linking.openURL(`mailto:${SUPPORT_EMAIL}`)');
    expect(support).toContain("router.canGoBack() ? router.back() : router.replace('/')");
    expect(support).toContain('Platform');
    expect(support).toContain('iOS, Android, and Web');
    expect(support).not.toContain('support@regattaflow');

    expect(privacy).toContain('BetterAt ("we", "our", or "us")');
    expect(privacy).toContain('Email: info@better.at');
    expect(privacy).toContain('Website: https://better.at');
    expect(privacy).toContain("router.canGoBack() ? router.back() : router.replace('/')");

    expect(terms).toContain('By using BetterAt, you agree to these terms');
    expect(terms).toContain('Questions about these terms: info@better.at');
    expect(terms).toContain("router.canGoBack() ? router.back() : router.replace('/')");
  });

  it('shares BetterAt profile URLs from QR and profile header entry points', () => {
    const qrSection = readSource('components/search/ProfileQRCodeSection.tsx');
    const profileHeader = readSource('components/sailor/profile/SailorProfileHeader.tsx');

    expect(qrSection).toContain('`https://better.at/profile/${userId}`');
    expect(qrSection).toContain('value={profileUrl}');
    expect(qrSection).toContain('message: `Follow me on BetterAt! ${profileUrl}`');
    expect(qrSection).toContain("title: 'My BetterAt Profile'");
    expect(qrSection).not.toContain('https://regattaflow.app/profile/');

    expect(profileHeader).toContain('`https://better.at/profile/${profile.userId}`');
    expect(profileHeader).toContain('message: `Check out ${profile.displayName} on BetterAt! ${profileUrl}`');
    expect(profileHeader).toContain('title: `${profile.displayName} on BetterAt`');
    expect(profileHeader).not.toContain('https://regattaflow.app/profile/');
    expect(profileHeader).not.toContain('on RegattaFlow');
  });

  it('keeps unified share tokens resolvable publicly and convertible after signup', () => {
    const publicShare = readSource('app/share/[token].tsx');
    const shareTokenService = readSource('services/ShareTokenService.ts');
    const sharedStepsService = readSource('services/SharedStepsService.ts');

    expect(publicShare).toContain('resolveShareToken(token)');
    expect(publicShare).toContain("if (state.payload.target_type === 'step')");
    expect(publicShare).toContain('<StepShareView payload={state.payload} token={token!} />');
    expect(publicShare).toContain('<BlueprintShareView payload={state.payload} token={token!} />');
    expect(publicShare).toContain("params.set('returnTo', `/share/${token}`)");
    expect(publicShare).toContain("params.set('blueprint', blueprintRef)");
    expect(publicShare).toContain("params.set('blueprintName', blueprintTitle)");
    expect(publicShare).toContain("router.push(`/(auth)/signup?${params.toString()}` as any)");
    expect(publicShare).toContain('Powered by BetterAt');
    expect(publicShare).toContain("error === 'expired'");
    expect(publicShare).toContain("error === 'revoked'");
    expect(publicShare).toContain("error === 'rate_limited'");
    expect(publicShare).toContain("error === 'target_missing'");

    expect(shareTokenService).toContain("supabase.rpc('create_share_token'");
    expect(shareTokenService).toContain("supabase.rpc('revoke_share_token'");
    expect(shareTokenService).toContain("supabase.rpc('resolve_share_token'");
    expect(shareTokenService).toContain("if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin)");
    expect(shareTokenService).toContain('return `${window.location.origin}/share/${token}`;');
    expect(shareTokenService).toContain("process.env.EXPO_PUBLIC_API_URL || 'https://better.at'");
    expect(shareTokenService).not.toContain("process.env.EXPO_PUBLIC_API_URL || 'https://regattaflow.com'");
    expect(sharedStepsService).toContain("token = await createShareToken('step', input.stepId, expiresAt)");
    expect(sharedStepsService).toContain('url: buildShareUrl(token)');
  });

  it('keeps legacy public share footers branded and linked to BetterAt', () => {
    const publicRegatta = readSource('app/p/[regattaId].tsx');
    const publicStrategy = readSource('app/p/strategy/[token].tsx');
    const publicStep = readSource('app/p/step/[token].tsx');
    const publicResults = readSource('app/p/results/[regattaId].tsx');
    const publicNotices = readSource('app/p/notices/[regattaId].tsx');
    const publicSchedule = readSource('app/p/schedule/[regattaId].tsx');
    const timelineStepService = readSource('services/TimelineStepService.ts');
    const publicPublishingService = readSource('services/PublicPublishingService.ts');
    const publicRegattasApi = readSource('api/public/regattas/[regattaId].ts');
    const publicClubsEventsApi = readSource('api/public/clubs/[clubId]/events.ts');
    const publicStepOgApi = readSource('api/public/steps/[token]/og.ts');

    expect(publicRegatta).toContain('Powered by BetterAt');
    expect(publicRegatta).toContain("Linking.openURL('https://better.at')");
    expect(publicRegatta).not.toContain('Powered by RegattaFlow');

    expect(publicStrategy).toContain('Powered by BetterAt');
    expect(publicStrategy).toContain("Linking.openURL('https://better.at')");
    expect(publicStrategy).not.toContain('Powered by RegattaFlow');

    expect(publicStep).toContain('Powered by BetterAt');
    expect(publicStep).toContain("Linking.openURL('https://better.at')");

    expect(publicResults).toContain('Powered by BetterAt');
    expect(publicNotices).toContain('Powered by BetterAt');
    expect(publicSchedule).toContain('Powered by BetterAt');
    expect(publicResults).not.toContain('Powered by RegattaFlow');
    expect(publicNotices).not.toContain('Powered by RegattaFlow');
    expect(publicSchedule).not.toContain('Powered by RegattaFlow');

    expect(publicStep).toContain("process.env.EXPO_PUBLIC_API_URL || 'https://better.at'");
    expect(publicStep).toContain('`https://better.at/api/public/steps/${token}`');
    expect(publicStep).not.toContain("process.env.EXPO_PUBLIC_API_URL || 'https://regattaflow.com'");
    expect(publicStep).not.toContain('`https://regattaflow.com/api/public/steps/${token}`');

    expect(publicStrategy).toContain("process.env.EXPO_PUBLIC_API_URL || 'https://better.at'");
    expect(publicStrategy).toContain('`https://better.at/api/public/strategies/${token}`');
    expect(publicStrategy).not.toContain("process.env.EXPO_PUBLIC_API_URL || 'https://regattaflow.com'");
    expect(publicStrategy).not.toContain('`https://regattaflow.com/api/public/strategies/${token}`');

    expect(timelineStepService).toContain("typeof window !== 'undefined' ? window.location.origin : 'https://better.at'");
    expect(timelineStepService).not.toContain("typeof window !== 'undefined' ? window.location.origin : 'https://regattaflow.com'");

    expect(publicPublishingService).toContain("const baseUrl = options?.baseUrl || 'https://better.at';");
    expect(publicPublishingService).not.toContain("const baseUrl = options?.baseUrl || 'https://regattaflow.com';");

    expect(publicRegattasApi).toContain("process.env.EXPO_PUBLIC_API_URL || 'https://better.at'");
    expect(publicClubsEventsApi).toContain("process.env.EXPO_PUBLIC_API_URL || 'https://better.at'");
    expect(publicStepOgApi).toContain("process.env.EXPO_PUBLIC_SITE_URL || 'https://better.at'");
  });

  it('keeps share sheets explicit about direct, group, link, suggest, and capture visibility behavior', () => {
    const shareStepSheet = readSource('components/share/ShareStepSheet.tsx');
    const shareCaptureSheet = readSource('components/share/ShareCaptureSheet.tsx');

    expect(shareStepSheet).toContain("export type ShareMode = 'direct' | 'group' | 'link' | 'suggest'");
    expect(shareStepSheet).toContain('onShareDirect: (recipientId: string) => Promise<void> | void;');
    expect(shareStepSheet).toContain('onShareToGroup: (groupId: string) => Promise<void> | void;');
    expect(shareStepSheet).toContain('onCopyLink: () => Promise<string> | string;');
    expect(shareStepSheet).toContain('onSuggestDirect?: (recipientId: string, message?: string) => Promise<void> | void;');
    expect(shareStepSheet).toContain('testID="share-step-direct"');
    expect(shareStepSheet).toContain('testID="share-step-suggest"');
    expect(shareStepSheet).toContain('testID="share-step-group"');
    expect(shareStepSheet).toContain('testID="share-step-copy-link"');
    expect(shareStepSheet).toContain('Anyone with the link can view · expires in 30 days');

    expect(shareCaptureSheet).toContain("const RINGS: { key: CaptureVisibility; name: string; desc: string; icon: 'lock' | 'users' | 'anchor' }[] = [");
    expect(shareCaptureSheet).toContain("{ key: 'private', name: 'Private'");
    expect(shareCaptureSheet).toContain("{ key: 'crew', name: 'Crew'");
    expect(shareCaptureSheet).toContain("{ key: 'fleet', name: 'Fleet / Cohort'");
    expect(shareCaptureSheet).toContain('await onChangeVisibility(next)');
    expect(shareCaptureSheet).toContain('Sharing to Crew/Fleet hides patient identifiers by default');
  });

  it('keeps install/download banner dismissible and platform-aware', () => {
    const banner = readSource('components/promo/AppDownloadBanner.tsx');

    expect(banner).toContain("const APP_STORE_URL = 'https://better.at';");
    expect(banner).toContain("const PLAY_STORE_URL = 'https://better.at';");
    expect(banner).toContain("const WEB_URL = 'https://better.at';");
    expect(banner).toContain("Platform.OS === 'web' ? WEB_URL : Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL");
    expect(banner).toContain('appStoreUrl?: string;');
    expect(banner).toContain('bottomOffset?: number;');
    expect(banner).toContain("headline = 'Get BetterAt'");
    expect(banner).toContain("ctaText = 'Open BetterAt'");
    expect(banner).toContain('const [isVisible, setIsVisible] = useState(true);');
    expect(banner).toContain('setIsVisible(false);');
    expect(banner).toContain("variant === 'sticky'");
    expect(banner).toContain('Math.max(insets.bottom, bottomOffset)');
    expect(banner).not.toContain('apps.apple.com/app/regattaflow');
    expect(banner).not.toContain('play.google.com/store/apps/details?id=com.regattaflow');
    expect(banner).not.toContain('https://regattaflow.com');
  });

  it('keeps public regatta unavailable states routed to BetterAt support', () => {
    const results = readSource('app/p/results/[regattaId].tsx');
    const notices = readSource('app/p/notices/[regattaId].tsx');
    const schedule = readSource('app/p/schedule/[regattaId].tsx');

    expect(results).toContain('mailto:info@better.at?subject=${encodeURIComponent(\'Public Results Unavailable\')');
    expect(notices).toContain('mailto:info@better.at?subject=${encodeURIComponent(\'Public Notices Unavailable\')');
    expect(schedule).toContain('mailto:info@better.at?subject=${encodeURIComponent(\'Public Schedule Unavailable\')');
    expect(results).not.toContain('mailto:support@regattaflow.com');
    expect(notices).not.toContain('mailto:support@regattaflow.com');
    expect(schedule).not.toContain('mailto:support@regattaflow.com');
  });

  it('keeps learning, registration payment, export, and map support handoffs on the BetterAt support path', () => {
    const course = readSource('app/(tabs)/learn/[courseId]/index.tsx');
    const coursePayment = readSource('services/CoursePaymentService.ts');
    const paymentNative = readSource('components/registration/PaymentFlowComponent.tsx');
    const paymentWeb = readSource('components/registration/PaymentFlowComponent.web.tsx');
    const instagram = readSource('components/learn/InstagramExporter.tsx');
    const locationMap = readSource('components/races/LocationMapPicker.native.tsx');

    expect(course).toContain('mailto:info@better.at?subject=${encodeURIComponent(\'Course setup issue\')');
    expect(paymentNative).toContain('mailto:info@better.at?subject=${encodeURIComponent(\'Web Payment Support\')');
    expect(paymentNative).toContain('Please use the BetterAt mobile app to complete payment');
    expect(paymentNative).toContain("merchantDisplayName: 'BetterAt'");
    expect(paymentNative).toContain("returnURL: 'betterat://stripe-redirect'");
    expect(coursePayment).toContain(": 'betterat://';");
    expect(paymentWeb).toContain('mailto:info@better.at?subject=Web%20Payment%20Support');
    expect(instagram).toContain('mailto:info@better.at?subject=Instagram%20Export%20Setup');
    expect(instagram).toContain('BetterAt carousel: ${skillName}');
    expect(instagram).toContain('betterat-mark-rounding-carousel.zip');
    expect(instagram).toContain("MediaLibrary.getAlbumAsync('BetterAt')");
    expect(instagram).toContain('slides saved to your camera roll in the "BetterAt" album.');
    expect(instagram).toContain('link.download = `betterat-slide-${index + 1}.png`;');
    expect(locationMap).toContain('const mailtoUrl = `mailto:info@better.at?subject=${subject}&body=${body}`;');

    expect(course).not.toContain('support@regattaflow.com');
    expect(coursePayment).not.toContain(": 'regattaflow://';");
    expect(paymentNative).not.toContain('support@regattaflow.com');
    expect(paymentNative).not.toContain('Please use the RegattaFlow mobile app');
    expect(paymentNative).not.toContain("merchantDisplayName: 'RegattaFlow'");
    expect(paymentNative).not.toContain("returnURL: 'regattaflow://stripe-redirect'");
    expect(paymentWeb).not.toContain('support@regattaflow.com');
    expect(instagram).not.toContain('support@regattaflow.com');
    expect(instagram).not.toContain('RegattaFlow carousel');
    expect(instagram).not.toContain('regattaflow-mark-rounding-carousel.zip');
    expect(instagram).not.toContain("MediaLibrary.getAlbumAsync('RegattaFlow')");
    expect(instagram).not.toContain('"RegattaFlow" album');
    expect(instagram).not.toContain('regattaflow-slide-${index + 1}.png');
    expect(locationMap).not.toContain('support@regattaflow.com');
  });

  it('keeps Instagram learning slide exports BetterAt-branded', () => {
    const instagramSlide = readSource('components/learn/InstagramSlide.tsx');
    const skillExportService = readSource('services/SkillExportService.ts');

    expect(instagramSlide).toContain('Renders a single Instagram-ready slide with BetterAt branding');
    expect(instagramSlide).toContain('Get BetterAt');
    expect(instagramSlide).toContain('BetterAt</Text>');
    expect(instagramSlide).toContain("slide.footer || 'better.at'");
    expect(instagramSlide).not.toContain('Get RegattaFlow');
    expect(instagramSlide).not.toContain('RegattaFlow</Text>');
    expect(instagramSlide).not.toContain('regattaflow.com');

    expect(skillExportService).toContain("BetterAt's AI-powered sailing coach");
    expect(skillExportService).toContain('real-time tactics with BetterAt.');
    expect(skillExportService).not.toContain("RegattaFlow's AI-powered sailing coach");
    expect(skillExportService).not.toContain('real-time tactics with RegattaFlow.');
  });

  it('keeps public marketing contact CTAs routed to BetterAt support on web and native', () => {
    const forOrganizations = readSource('app/for-organizations.tsx');
    const clubs = readSource('app/clubs.tsx');
    const podcast = readSource('app/podcast.tsx');
    const podcasts = readSource('app/podcasts.tsx');

    expect(forOrganizations).toContain("const url = 'mailto:info@better.at?subject=Schedule Demo Request';");
    expect(forOrganizations).toContain('window.location.href = url;');
    expect(forOrganizations).toContain('Linking.openURL(url);');
    expect(forOrganizations).toContain('<Text style={styles.brandName}>BetterAt</Text>');
    expect(forOrganizations).toContain('"BetterAt made us look incredibly professional. Participation doubled the following year."');
    expect(forOrganizations).toContain('© 2025 BetterAt. All rights reserved.');
    expect(forOrganizations).not.toContain('demo@regattaflow.com');
    expect(forOrganizations).not.toContain('<Text style={styles.brandName}>RegattaFlow</Text>');
    expect(forOrganizations).not.toContain('© 2025 RegattaFlow. All rights reserved.');

    expect(clubs).toContain("const url = 'mailto:info@better.at?subject=Club Enterprise Inquiry';");
    expect(clubs).toContain('window.location.href = url;');
    expect(clubs).toContain('Linking.openURL(url);');
    expect(clubs).not.toContain('sales@regattaflow.io');

    expect(podcast).toContain('mailto:info@better.at?subject=Podcast%20Notifications');
    expect(podcast).toContain('BetterAt%20podcast%20episodes%20launch');
    expect(podcast).toContain('BetterAt Podcast');
    expect(podcasts).toContain('mailto:info@better.at?subject=Podcast%20Notifications');
    expect(podcasts).toContain('new%20BetterAt%20podcast%20episodes%20are%20available');
    expect(podcasts).toContain('BetterAt Podcast');
    expect(podcasts).toContain('The BetterAt Podcast brings you expert insights');
    expect(podcast).not.toContain('podcast@regattaflow.com');
    expect(podcasts).not.toContain('podcast@regattaflow.com');
    expect(podcast).not.toContain('RegattaFlow Podcast');
    expect(podcasts).not.toContain('RegattaFlow Podcast');
  });
});
