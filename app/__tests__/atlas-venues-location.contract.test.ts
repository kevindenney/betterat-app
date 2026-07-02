import fs from 'fs';
import path from 'path';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('Atlas, venues, location, QR, and check-in contracts', () => {
  it('keeps Atlas interest routing, plan picker handoff, and nearby anchors explicit', () => {
    const atlasTab = readSource('app/(tabs)/atlas.tsx');
    const atlasPicker = readSource('app/atlas-picker.tsx');

    expect(atlasTab).toContain('function pickFrameForInterest(slug: string | null): AtlasFrameId');
    expect(atlasTab).toContain("if (s === 'nursing' || s === 'msn' || s === 'msn-nursing') return 'f4';");
    expect(atlasTab).toContain("return `${name ?? 'Sailing'} · race areas, clubs, and marks`;");
    expect(atlasTab).toContain("return `${name ?? 'Nursing'} · labs, wards, and shift sites`;");
    expect(atlasTab).toContain("return { lat: 39.297, lng: -76.591, label: 'Baltimore' };");
    expect(atlasTab).toContain("if (frame === 'f2' || frame === 'f3' || frame === 'f6')");
    expect(atlasTab).toContain("return isSailingInterestSlug(currentInterestSlug) ? 'sail-racing' : currentInterestSlug;");
    expect(atlasTab).toContain("const isFromPlan = params.fromPlan === '1';");
    expect(atlasTab).toContain('if (pin) AtlasPickerBus.emit({ lat: pin.lat, lng: pin.lng, place: pin.place });');
    expect(atlasTab).toContain('else AtlasPickerBus.cancel();');
    expect(atlasTab).toContain('if (router.canGoBack()) router.back();');
    expect(atlasTab).toContain("router.push('/account')");
    expect(atlasTab).toContain("router.push('/(tabs)/practice')");
    expect(atlasTab).toContain("router.push(`/organizations/${slug}` as any)");
    expect(atlasTab).toContain("router.push(`/race/ios/water/${stepId}` as any)");
    expect(atlasPicker).toContain("export { default } from './(tabs)/atlas';");
  });

  it('keeps Atlas map chrome platform-safe and location fallback behavior intact', () => {
    const atlasTab = readSource('app/(tabs)/atlas.tsx');
    const atlasScreen = readSource('components/ios-register/atlas/AtlasScreen.tsx');
    const atlasLocationTest = readSource('components/ios-register/atlas/__tests__/AtlasLocation.contract.test.ts');
    const currentLocation = readSource('hooks/useCurrentLocation.ts');

    expect(currentLocation).toContain("if (Platform.OS === 'web') return null;");
    expect(currentLocation).toContain('requestForegroundPermissionsAsync');
    expect(currentLocation).toContain("status !== 'granted'");
    expect(currentLocation).toContain('deniedRef.current = true');
    expect(currentLocation).toContain('GPS_TIMEOUT_MS = 4000');
    expect(currentLocation).toContain('Promise.race');
    expect(currentLocation).toContain('getCurrentPositionAsync');

    expect(atlasTab).toContain('initialFocus={initialFocus}');
    expect(atlasTab).toContain('initialPeerFocus={initialPeerFocus}');
    expect(atlasTab).toContain('nearbyOverlayOpen={nearbyOpen}');
    expect(atlasTab).toContain('bottomSheetOffset={tabBarSpace}');
    expect(atlasScreen).toContain('void getCurrentLocation().then((pos) => {');
    expect(atlasScreen).toContain('setSearchFocus({ lat: pos.lat, lng: pos.lng })');
    expect(atlasScreen).toContain('homeVenue?.lat != null && homeVenue?.lng != null');
    expect(atlasScreen).toContain('setSearchFocus({ lat: homeVenue.lat, lng: homeVenue.lng })');
    expect(atlasLocationTest).toContain('waits for the native map to be ready before applying focus locations');
    expect(atlasLocationTest).toContain('keeps web map focus stable across unrelated parent renders');
  });

  it('keeps venue detail feed/map segments, post creation, and saved venue mutations scoped', () => {
    const venueDetail = readSource('app/venue/[id].tsx');
    const venueFeed = readSource('app/venue/feed/index.tsx');
    const postCreate = readSource('app/venue/post/create.tsx');
    const feedSegment = readSource('components/venue/segments/VenueFeedSegment.tsx');
    const mapSegment = readSource('components/venue/segments/VenueMapSegment.tsx');
    const savedVenueService = readSource('services/SavedVenueService.ts');
    const embedDiscuss = readSource('app/embed/discuss.tsx');
    const postDetail = readSource('components/venue/post/PostDetailScreen.tsx');
    const clubScoring = readSource('app/club/scoring/[regattaId].tsx');

    expect(venueDetail).toContain(".from('sailing_venues')");
    expect(venueDetail).toContain(".eq('id', actualId)");
    expect(venueDetail).toContain("const SEGMENTS: { value: VenueDetailSegment; label: string }[] = [");
    expect(venueDetail).toContain("{ value: 'feed', label: 'Feed' }");
    expect(venueDetail).toContain("{ value: 'map', label: 'Map' }");
    expect(venueDetail).toContain('await saveVenue(venue.id)');
    expect(venueDetail).toContain('await unsaveVenue(venue.id)');
    expect(venueDetail).toContain('queryClient.setQueryData(communityFeedKeys.post(post.id), post)');
    expect(venueDetail).toContain("router.push(`/venue/post/${post.id}`)");
    expect(venueDetail).toContain('<PostComposer');
    expect(venueDetail).toContain('<AddRacingAreaSheet');

    expect(venueFeed).toContain('const { venueId } = useLocalSearchParams');
    expect(venueFeed).toContain('if (!venueId) return null;');
    expect(venueFeed).toContain("router.push(`/venue/post/${post.id}`)");
    expect(venueFeed).toContain('<PostComposer');

    expect(postCreate).toContain('if (poiId)');
    expect(postCreate).toContain('poiId={poiId}');
    expect(postCreate).toContain('poiName={poiName}');
    expect(postCreate).toContain('catalogRaceId={catalogRaceId}');
    expect(postCreate).toContain('catalogRaceName={catalogRaceName}');
    expect(postCreate).toContain("router.replace('/(tabs)/connect')");
    expect(postCreate).toContain("router.push('/community/create')");
    expect(postCreate).toContain("Platform.select({\n      web: { outlineStyle: 'none' } as any");

    expect(feedSegment).toContain("const [sort, setSort] = useState<FeedSortType>('hot');");
    expect(feedSegment).toContain('selectedTagIds={selectedTagIds}');
    expect(feedSegment).toContain('renderHeader={renderHeader}');
    expect(mapSegment).toContain('const DEFAULT_LAYERS: MapLayers = {');
    expect(mapSegment).toContain('const [previewedVenue, setPreviewedVenue] = useState<Venue | null>(null);');
    expect(mapSegment).toContain('onMarkerPress={handleMarkerPress}');
    expect(mapSegment).toContain('onSwitchVenue={handleSwitchVenue}');
    expect(mapSegment).toContain("showAlert('Switch Failed', 'Could not switch to the selected venue.')");

    expect(savedVenueService).toContain(".eq('user_id', user.id)");
    expect(savedVenueService).toContain(".eq('venue_id', venueId)");
    expect(savedVenueService).toContain(".select('id')");
    expect(savedVenueService).toContain('.maybeSingle()');
    expect(savedVenueService).toContain("throw new Error('Saved venue not found.')");

    expect(embedDiscuss).toContain('const url = `https://better.at/venue/post/${post.id}`;');
    expect(embedDiscuss).toContain('subheadline="Join 100+ communities on BetterAt"');
    expect(embedDiscuss).not.toContain('https://regattaflow.com/venue/post/${post.id}');
    expect(embedDiscuss).not.toContain('Join 100+ communities on RegattaFlow');

    expect(postDetail).toContain('message: `${post.title} - BetterAt`,');
    expect(postDetail).not.toContain('message: `${post.title} - RegattaFlow`,');

    expect(clubScoring).toContain('const url = `https://better.at/p/results/${regattaId}`;');
    expect(clubScoring).not.toContain('https://regattaflow.com/p/results/${regattaId}');
  });

  it('keeps QR scanning BetterAt-branded and resilient when camera support is unavailable', () => {
    const scanner = readSource('app/scan-qr.tsx');

    expect(scanner).toContain("const ExpoCamera = require('expo-camera');");
    expect(scanner).toContain('CameraView = ExpoCamera.CameraView;');
    expect(scanner).toContain('useCameraPermissions = ExpoCamera.useCameraPermissions;');
    expect(scanner).toContain('function extractSailorId(data: string): string | null');
    expect(scanner).toContain('const profilePrefixes = [\'sailor\', \'profile\', \'user\', \'s\', \'p\'];');
    expect(scanner).toContain('url.searchParams.get(\'id\') || url.searchParams.get(\'sailor\')');
    expect(scanner).toContain("router.replace(`/sailor-journey/${sailorId}/latest`)");
    expect(scanner).toContain('Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)');
    expect(scanner).toContain("Linking.openURL(\n              'mailto:info@better.at?subject=QR%20Scanner%20Camera%20Setup");
    expect(scanner).toContain('This QR code does not contain a valid BetterAt profile.');
    expect(scanner).not.toContain('support@regattaflow.com?subject=QR%20Scanner%20Camera%20Setup');
    expect(scanner).not.toContain("valid RegattaFlow sailor profile");
  });

  it('keeps check-in QR, roster, realtime, and sharing behavior explicit', () => {
    const selfCheckIn = readSource('app/check-in/[token].tsx');
    const dashboard = readSource('app/club/check-in/[raceId].tsx');
    const service = readSource('services/CheckInService.ts');

    expect(selfCheckIn).toContain(".eq('check_in_qr_token', token)");
    expect(selfCheckIn).toContain('setError(\'Invalid or expired check-in code\')');
    expect(selfCheckIn).toContain('setError(\'Self check-in is not enabled for this race\')');
    expect(selfCheckIn).toContain('navigator.geolocation.getCurrentPosition');
    expect(selfCheckIn).toContain('await checkInService.selfCheckIn(token!, entryId, location || undefined)');
    expect(selfCheckIn).toContain("['checked_in', 'late'].includes(e.race_check_ins?.[0]?.status)");
    expect(selfCheckIn).toContain('deadlinePassed');

    expect(dashboard).toContain("const [regattaId, raceNumberStr] = (raceId || '').split('_');");
    expect(dashboard).toContain('checkInService.getRoster(regattaId, raceNumber)');
    expect(dashboard).toContain('checkInService.getFleetStatus(regattaId, raceNumber)');
    expect(dashboard).toContain('checkInService.getRaceConfig(regattaId, raceNumber)');
    expect(dashboard).toContain('checkInService.subscribeToCheckIns(regattaId, raceNumber');
    expect(dashboard).toContain('checkInService.unsubscribeFromCheckIns(regattaId, raceNumber)');
    expect(dashboard).toContain('await checkInService.checkIn(regattaId, raceNumber, entryId)');
    expect(dashboard).toContain('await checkInService.scratch(regattaId, raceNumber, entry.entry_id, reason)');
    expect(dashboard).toContain('await checkInService.markDNS(regattaId, raceNumber, entry.entry_id)');
    expect(dashboard).toContain('await checkInService.undoCheckIn(regattaId, raceNumber, entryId)');
    expect(dashboard).toContain('await checkInService.batchCheckIn(');
    expect(dashboard).toContain("if (Platform.OS === 'web')");
    expect(dashboard).toContain('nav.clipboard.writeText(url)');
    expect(dashboard).toContain('await Share.share({');

    expect(service).toContain('getQRCodeUrl(qrToken: string, baseUrl: string = \'https://better.at\'): string');
    expect(service).not.toContain('getQRCodeUrl(qrToken: string, baseUrl: string = \'https://regattaflow.com\'): string');
    expect(service).toContain('return `${baseUrl}/check-in/${qrToken}`;');
  });

  it('keeps professional map controls and support handoffs aligned with BetterAt contact paths', () => {
    const mapScreen = readSource('app/(tabs)/map.tsx');
    const professionalMap = readSource('components/map/ProfessionalMapScreen.tsx');

    expect(mapScreen).toContain('const [professionalMode, setProfessionalMode] = useState(true);');
    expect(mapScreen).toContain('const [courseVisualizationMode, setCourseVisualizationMode] = useState(false);');
    expect(mapScreen).toContain('createSampleExtractedCourse');
    expect(mapScreen).toContain('<ProfessionalMapScreen');
    expect(mapScreen).toContain('<RaceCourseVisualization');

    expect(professionalMap).toContain('const [currentMode, setCurrentMode] = useState<MapInteractionMode>(\'navigate\');');
    expect(professionalMap).toContain('const [is3D, setIs3D] = useState(true);');
    expect(professionalMap).toContain('<ProfessionalMapControls');
    expect(professionalMap).toContain('<WebMapView');
    expect(professionalMap).toContain('<StrategyChatInterface');
    expect(professionalMap).toContain("'mailto:info@better.at?subject=Offline%20Map%20Pack%20Request'");
    expect(professionalMap).not.toContain('mailto:support@regattaflow.com?subject=Offline%20Map%20Pack%20Request');
  });
});
