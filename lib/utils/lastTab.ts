import { Platform } from 'react-native';

const STORAGE_KEY = 'regattaflow_last_tab';

/**
 * Top-level tab paths that are safe to restore.
 * Deep links (e.g., /race/123) are intentionally excluded
 * so we never restore stale detail screens.
 */
const VALID_TAB_PREFIXES = [
  '/practice', '/races', '/library', '/watch', '/atlas', '/connect', '/learn', '/reflect', '/search',
  '/follow', '/community', '/discuss',
  '/courses', '/boat', '/profile', '/settings', '/strategy',
  '/map', '/clients', '/schedule', '/earnings', '/events',
  '/members', '/race-management', '/calendar', '/fleet',
];

function isValidTabPath(pathname: string): boolean {
  return VALID_TAB_PREFIXES.some(prefix => pathname === prefix || pathname === `${prefix}/index`);
}

/** Persist the current tab pathname (web only, no-op on native). */
export function saveLastTab(pathname: string): void {
  if (Platform.OS !== 'web') return;
  if (!isValidTabPath(pathname)) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, pathname);
  } catch {
    // Silently ignore — quota errors, SSR, etc.
  }
}

/** Read the previously saved tab pathname (web only, returns null on native). */
export function getLastTab(): string | null {
  if (Platform.OS !== 'web') return null;

  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Clear the saved tab (call on sign-out). */
export function clearLastTab(): void {
  if (Platform.OS !== 'web') return;

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silently ignore
  }
}
