/**
 * WebDrawerProvider - Context for web navigation drawer state
 *
 * Provides open/close/toggle functions for the sidebar drawer on web.
 * Used by TabScreenToolbar (hamburger button) and _layout.tsx (drawer rendering).
 * On native, the drawer is never shown — all functions are no-ops.
 *
 * Pin functionality: When pinned, the drawer stays open and cannot be collapsed.
 * Defaults to pinned & open on web for persistent sidebar experience.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

/**
 * Sidebar starts pinned open at this width; below it starts collapsed.
 * Also the floor below which the sidebar cannot render at all, so the
 * sidebar toggle must be hidden under it (the control would be dead).
 */
export const SIDEBAR_PIN_BREAKPOINT = 1024;

interface WebDrawerContextValue {
  isDrawerOpen: boolean;
  isPinned: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  togglePin: () => void;
  setIsPinned: (pinned: boolean) => void;
}

const WebDrawerContext = createContext<WebDrawerContextValue>({
  isDrawerOpen: false,
  isPinned: false,
  openDrawer: () => {},
  closeDrawer: () => {},
  toggleDrawer: () => {},
  togglePin: () => {},
  setIsPinned: () => {},
});

export function WebDrawerProvider({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  // On wide web: start open + pinned. On narrow web: start closed + unpinned.
  const isWide = isWeb && width >= SIDEBAR_PIN_BREAKPOINT;
  const [isDrawerOpen, setIsDrawerOpen] = useState(isWide);
  const [isPinned, setIsPinned] = useState(isWide);

  const openDrawer = useCallback(() => {
    if (Platform.OS === 'web') setIsDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    // Only close if not pinned
    if (!isPinned) {
      setIsDrawerOpen(false);
    }
  }, [isPinned]);

  const toggleDrawer = useCallback(() => {
    if (Platform.OS === 'web') {
      setIsDrawerOpen((prev) => {
        const next = !prev;
        // If closing while pinned, also unpin
        if (!next && isPinned) setIsPinned(false);
        return next;
      });
    }
  }, [isPinned]);

  const togglePin = useCallback(() => {
    if (Platform.OS === 'web') {
      setIsPinned((prev) => {
        const newPinned = !prev;
        // If pinning, ensure drawer is open
        if (newPinned) {
          setIsDrawerOpen(true);
        }
        return newPinned;
      });
    }
  }, []);

  return (
    <WebDrawerContext.Provider
      value={{
        isDrawerOpen,
        isPinned,
        openDrawer,
        closeDrawer,
        toggleDrawer,
        togglePin,
        setIsPinned,
      }}
    >
      {children}
    </WebDrawerContext.Provider>
  );
}

export const useWebDrawer = () => useContext(WebDrawerContext);
