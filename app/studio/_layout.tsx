/**
 * Creator Studio route group.
 *
 * Hides the Stack header — the StudioShell owns its own chrome. Studio is
 * iPad/desktop-class; on phone widths the page will render with a "use a
 * larger screen" gate (handled in index.tsx).
 */

import { Stack } from 'expo-router';

export default function StudioLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />;
}
