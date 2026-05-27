/**
 * useCurrentLocation — one-shot GPS read for "fly to me" affordances
 * (Atlas locate button, "near me" search, etc.).
 *
 * Wraps expo-location with two guards:
 *  - Web: returns null (no native bridge).
 *  - Repeat denials: we remember the user said no in this session and
 *    stop asking. Callers fall back to home venue / default coords.
 *
 * Returns a stable `getCurrentLocation` callback rather than a value so
 * consumers can trigger the read on user gesture (matching iOS Maps,
 * where locate is a button press, not a background subscription).
 */

import { useCallback, useRef } from 'react';
import { Platform } from 'react-native';

let LocationModule: typeof import('expo-location') | null = null;
async function getLocationModule() {
  if (Platform.OS === 'web') return null;
  if (!LocationModule) {
    try {
      LocationModule = await import('expo-location');
    } catch {
      return null;
    }
  }
  return LocationModule;
}

export interface CurrentLocation {
  lat: number;
  lng: number;
  accuracy: number | null;
}

export function useCurrentLocation() {
  // Session-scoped denial flag so we don't re-prompt after the user
  // declined once. Survives re-renders but resets on app restart, so
  // returning users still get a chance to grant later.
  const deniedRef = useRef(false);

  const getCurrentLocation = useCallback(async (): Promise<CurrentLocation | null> => {
    if (deniedRef.current) return null;
    const Location = await getLocationModule();
    if (!Location) return null;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        deniedRef.current = true;
        return null;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? null,
      };
    } catch (err) {
      console.warn('[atlas] GPS read failed', err);
      return null;
    }
  }, []);

  return { getCurrentLocation };
}
