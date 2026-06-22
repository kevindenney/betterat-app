import fs from 'node:fs';
import path from 'node:path';

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('Atlas location and map focus contracts', () => {
  const currentLocationSource = read('hooks/useCurrentLocation.ts');
  const atlasScreenSource = read('components/ios-register/atlas/AtlasScreen.tsx');
  const canvasSource = read('components/ios-register/atlas/AtlasMapLibreCanvas.tsx');

  it('keeps GPS access user-gesture driven and non-blocking', () => {
    expect(currentLocationSource).toContain("Platform.OS === 'web'");
    expect(currentLocationSource).toContain('requestForegroundPermissionsAsync');
    expect(currentLocationSource).toContain("status !== 'granted'");
    expect(currentLocationSource).toContain('deniedRef.current = true');
    expect(currentLocationSource).toContain('Promise.race');
    expect(currentLocationSource).toContain('GPS_TIMEOUT_MS = 4000');
    expect(currentLocationSource).toContain('getCurrentPositionAsync');

    const permissionIndex = currentLocationSource.indexOf('requestForegroundPermissionsAsync');
    const positionIndex = currentLocationSource.indexOf('getCurrentPositionAsync');
    const timeoutIndex = currentLocationSource.indexOf('GPS_TIMEOUT_MS');
    expect(permissionIndex).toBeGreaterThan(-1);
    expect(positionIndex).toBeGreaterThan(permissionIndex);
    expect(timeoutIndex).toBeLessThan(positionIndex);
  });

  it('falls Atlas locate back to the home venue when GPS is unavailable or denied', () => {
    expect(atlasScreenSource).toContain('const { getCurrentLocation } = useCurrentLocation();');
    expect(atlasScreenSource).toContain('onLocatePress={() => {');
    expect(atlasScreenSource).toContain('void getCurrentLocation().then((pos) => {');
    expect(atlasScreenSource).toContain('setSearchFocus({ lat: pos.lat, lng: pos.lng })');
    expect(atlasScreenSource).toContain('homeVenue?.lat != null && homeVenue?.lng != null');
    expect(atlasScreenSource).toContain('setSearchFocus({ lat: homeVenue.lat, lng: homeVenue.lng })');

    const locateIndex = atlasScreenSource.indexOf('void getCurrentLocation().then((pos) => {');
    const gpsFocusIndex = atlasScreenSource.indexOf('setSearchFocus({ lat: pos.lat, lng: pos.lng })');
    const homeFallbackIndex = atlasScreenSource.indexOf(
      'setSearchFocus({ lat: homeVenue.lat, lng: homeVenue.lng })',
    );
    expect(locateIndex).toBeGreaterThan(-1);
    expect(gpsFocusIndex).toBeGreaterThan(locateIndex);
    expect(homeFallbackIndex).toBeGreaterThan(gpsFocusIndex);
  });

  it('waits for the native map to be ready before applying focus locations', () => {
    expect(canvasSource).toContain('if (!focusLocation) return;');
    expect(canvasSource).toContain('if (!mapReady) return;');
    expect(canvasSource).toContain('focusLocation.bounds');
    expect(canvasSource).toContain('cameraRef.current?.setStop');
    expect(canvasSource).toContain('cameraRef.current?.flyTo');

    const focusGuardIndex = canvasSource.indexOf('if (!focusLocation) return;');
    const readyGuardIndex = canvasSource.indexOf('if (!mapReady) return;');
    const boundsIndex = canvasSource.indexOf('focusLocation.bounds');
    const flyToIndex = canvasSource.indexOf('cameraRef.current?.flyTo', boundsIndex);
    expect(focusGuardIndex).toBeGreaterThan(-1);
    expect(readyGuardIndex).toBeGreaterThan(focusGuardIndex);
    expect(boundsIndex).toBeGreaterThan(readyGuardIndex);
    expect(flyToIndex).toBeGreaterThan(boundsIndex);
  });

  it('keeps web map focus stable across unrelated parent renders', () => {
    expect(canvasSource).toContain('map.fitBounds');
    expect(canvasSource).toContain('map.easeTo');
    expect(canvasSource).toContain('including the\n    // focusLocation object itself causes easeTo to re-fire');
    expect(canvasSource).toContain('focusLocation?.lat');
    expect(canvasSource).toContain('focusLocation?.lng');
    expect(canvasSource).toContain('focusLocation?.bounds');

    const webFocusIndex = canvasSource.lastIndexOf('if (!map || !isLoaded || !focusLocation) return;');
    const easeIndex = canvasSource.indexOf('map.easeTo', webFocusIndex);
    const depsIndex = canvasSource.indexOf('focusLocation?.lat', easeIndex);
    expect(webFocusIndex).toBeGreaterThan(-1);
    expect(easeIndex).toBeGreaterThan(webFocusIndex);
    expect(depsIndex).toBeGreaterThan(easeIndex);
  });
});
