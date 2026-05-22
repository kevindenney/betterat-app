/**
 * Org admin route group — iPad/desktop class.
 *
 * Hides the Stack header; StudioShell (navy accent) owns the chrome.
 */

import { Stack } from 'expo-router';

export default function AdminLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />;
}
