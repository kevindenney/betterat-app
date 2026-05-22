/**
 * Atlas route group — placeholder until the 5th-tab Atlas surface lands.
 *
 * Today this just hosts /atlas/sites — a verification list of the seeded
 * POI data. Once the map UI ships from the design pass, this will become
 * the real Atlas tab.
 */

import { Stack } from 'expo-router';

export default function AtlasLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />;
}
