/**
 * useTravelFocusSuggestion — "looks like you've traveled" recognition.
 *
 * If location permission is ALREADY granted (never prompts — that stays in
 * the picker), compares the device position to the user's location focus.
 * More than 50km apart → returns a one-tap suggestion to re-center. Never
 * auto-switches: the user must accept (privacy is fail-closed, and a focus
 * change re-centers Nearby/Atlas, which should never happen silently).
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';

import { haversineDistance } from '@/lib/courseGeometry';
import { labelForCoords } from '@/hooks/useLocationFocus';

const TRAVEL_THRESHOLD_KM = 50;

export interface TravelFocusSuggestion {
  lat: number;
  lng: number;
  label: string;
  distanceKm: number;
}

export function useTravelFocusSuggestion(params: {
  focusLat: number | null;
  focusLng: number | null;
}): { suggestion: TravelFocusSuggestion | null; dismiss: () => void } {
  const { focusLat, focusLng } = params;
  const [dismissed, setDismissed] = useState(false);
  const hasFocus = focusLat != null && focusLng != null;

  const { data } = useQuery({
    // Key on coarse focus coords so accepting the suggestion (focus moves)
    // re-evaluates and the pill disappears.
    queryKey: ['travel-focus-suggestion', focusLat?.toFixed(2), focusLng?.toFixed(2)],
    enabled: hasFocus,
    staleTime: 10 * 60_000,
    retry: false,
    queryFn: async (): Promise<TravelFocusSuggestion | null> => {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') return null;

      const pos =
        (await Location.getLastKnownPositionAsync()) ??
        (await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }));
      if (!pos) return null;

      const { latitude: lat, longitude: lng } = pos.coords;
      const distanceKm = haversineDistance(focusLat!, focusLng!, lat, lng) / 1000;
      if (distanceKm <= TRAVEL_THRESHOLD_KM) return null;

      const label = await labelForCoords(lat, lng);
      return { lat, lng, label, distanceKm };
    },
  });

  return {
    suggestion: dismissed ? null : (data ?? null),
    dismiss: () => setDismissed(true),
  };
}
