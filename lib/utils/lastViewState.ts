import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_KEY = 'betterat_last_view_state';
const STALENESS_MS = 24 * 60 * 60 * 1000;

export interface LastViewState {
  /** The selected step/race ID the user was viewing */
  selectedStepId: string | null;
  /** The interest slug that was active */
  interestSlug: string | null;
  /** Whether the grid/zoomed-out view was active */
  isGridView: boolean | null;
  /** The zoom level (1/3/4) the user was at */
  zoomLevel: number | null;
  /** Timestamp of when this was saved (for staleness checks) */
  savedAt: number;
}

// On native, AsyncStorage is async — but the timeline canvas reads view state
// synchronously at mount. We keep a sync in-memory cache, hydrated once from
// AsyncStorage at app startup, so the first read can land on the saved level
// without a visible jump.
let nativeCache: LastViewState | null = null;
let nativeHydrated = false;

function isFresh(state: LastViewState | null): LastViewState | null {
  if (!state) return null;
  if (Date.now() - state.savedAt > STALENESS_MS) return null;
  return state;
}

/** Pre-warm the native sync cache from AsyncStorage. Call once at app startup. */
export async function hydrateLastViewState(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (nativeHydrated) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) nativeCache = JSON.parse(raw) as LastViewState;
  } catch {
    // Silently ignore — corrupt JSON, storage errors, etc.
  } finally {
    nativeHydrated = true;
  }
}

/** Whether the native cache is ready (always true on web). */
export function isLastViewStateHydrated(): boolean {
  return Platform.OS === 'web' ? true : nativeHydrated;
}

/** Save the current view state (cross-platform). */
export function saveLastViewState(state: Partial<LastViewState>): void {
  const existing = getLastViewState();
  const merged: LastViewState = {
    selectedStepId: 'selectedStepId' in state ? (state.selectedStepId ?? null) : (existing?.selectedStepId ?? null),
    interestSlug: 'interestSlug' in state ? (state.interestSlug ?? null) : (existing?.interestSlug ?? null),
    isGridView: 'isGridView' in state ? (state.isGridView ?? null) : (existing?.isGridView ?? null),
    zoomLevel: 'zoomLevel' in state ? (state.zoomLevel ?? null) : (existing?.zoomLevel ?? null),
    savedAt: Date.now(),
  };

  if (Platform.OS === 'web') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {
      // Silently ignore — quota errors, SSR, etc.
    }
    return;
  }

  nativeCache = merged;
  nativeHydrated = true;
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged)).catch(() => {
    // Silently ignore
  });
}

/** Read the previously saved view state (cross-platform, sync). */
export function getLastViewState(): LastViewState | null {
  if (Platform.OS === 'web') {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return isFresh(JSON.parse(raw) as LastViewState);
    } catch {
      return null;
    }
  }

  return isFresh(nativeCache);
}

/** Clear the saved view state (call on sign-out). */
export function clearLastViewState(): void {
  if (Platform.OS === 'web') {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Silently ignore
    }
    return;
  }

  nativeCache = null;
  AsyncStorage.removeItem(STORAGE_KEY).catch(() => {
    // Silently ignore
  });
}
