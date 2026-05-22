/**
 * Marketing site route group — betterat.com/schools.
 *
 * Public (no auth required) — `schools` is in publicSegments of app/_layout.tsx.
 * No app chrome; each page owns its own marketing nav.
 */

import { Stack } from 'expo-router';

export default function SchoolsLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />;
}
