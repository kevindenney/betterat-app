/**
 * Card Navigation System - Constants
 *
 * Apple Human Interface Guidelines (HIG) compliant constants.
 * Card-specific constants extending the existing navigation animation constants.
 * Imports and re-exports core animation configs for consistency.
 */

import { Dimensions } from 'react-native';
import {
  SNAP_SPRING_CONFIG,
  DETAIL_SNAP_SPRING_CONFIG,
  PRESS_SPRING_CONFIG,
  FOCUS_SPRING_CONFIG,
  VELOCITY_THRESHOLD,
  GESTURE_ACTIVE_OFFSET,
  GESTURE_LOCK_DISTANCE,
  GESTURE_UNLOCK_DELAY,
  DECELERATION_RATE,
  CARD_SCALE,
  CARD_OPACITY,
  CARD_WIDTH_RATIO,
  PEEK_WIDTH_RATIO,
  INITIAL_NUM_TO_RENDER,
  MAX_TO_RENDER_PER_BATCH,
  WINDOW_SIZE,
} from '@/constants/navigationAnimations';

// =============================================================================
// TUFTE DESIGN SYSTEM
// =============================================================================

/**
 * Warm paper background - inspired by financial newspapers (FT salmon, WSJ)
 * Creates hue contrast with cool white cards, not just luminance
 */
export const TUFTE_BACKGROUND = '#F2F2F7';

/**
 * Slightly darker warm tone for drawer/secondary backgrounds
 */
export const TUFTE_BACKGROUND_SECONDARY = '#E5E5EA';

/**
 * Warm gray for text - complements paper background
 */
export const TUFTE_TEXT = '#000000';

// =============================================================================
// iOS SYSTEM COLORS (Apple HIG)
// =============================================================================

export const IOS_COLORS = {
  // Primary Colors
  blue: '#007AFF',
  green: '#34C759',
  orange: '#FF9500',
  red: '#FF3B30',
  purple: '#AF52DE',
  teal: '#5AC8FA',
  cyan: '#32ADE6',
  indigo: '#5856D6',
  pink: '#FF2D55',
  yellow: '#FFCC00',

  // Gray Scale
  gray: '#8E8E93',
  gray2: '#AEAEB2',
  gray3: '#C7C7CC',
  gray4: '#D1D1D6',
  gray5: '#E5E5EA',
  gray6: '#F2F2F7',

  // Label Colors
  label: '#000000',
  secondaryLabel: '#3C3C43',
  tertiaryLabel: '#48484A',
  quaternaryLabel: '#636366',

  // Background Colors
  systemBackground: '#FFFFFF',
  secondarySystemBackground: '#F2F2F7',
  tertiarySystemBackground: '#FFFFFF',

  // Grouped Background Colors (using Tufte warm paper)
  systemGroupedBackground: TUFTE_BACKGROUND,
  secondarySystemGroupedBackground: '#FFFFFF',

  // Separator
  separator: '#3C3C434A',
} as const;

// =============================================================================
// RE-EXPORTS
// =============================================================================

export {
  SNAP_SPRING_CONFIG,
  DETAIL_SNAP_SPRING_CONFIG,
  PRESS_SPRING_CONFIG,
  FOCUS_SPRING_CONFIG,
  VELOCITY_THRESHOLD,
  GESTURE_ACTIVE_OFFSET,
  GESTURE_LOCK_DISTANCE,
  GESTURE_UNLOCK_DELAY,
  DECELERATION_RATE,
  CARD_SCALE,
  CARD_OPACITY,
  CARD_WIDTH_RATIO,
  PEEK_WIDTH_RATIO,
  INITIAL_NUM_TO_RENDER,
  MAX_TO_RENDER_PER_BATCH,
  WINDOW_SIZE,
};

// =============================================================================
// CARD GRID DIMENSIONS
// =============================================================================

/**
 * Card height as ratio of screen height
 * 58% height allows ~100px visible peek of card below
 */
export const CARD_HEIGHT_RATIO = 0.58;

/**
 * Vertical peek as ratio of screen height
 * 12% of next card visible at bottom (~100px on typical screen)
 */
export const VERTICAL_PEEK_RATIO = 0.12;

/**
 * Card border radius in pixels
 * Consistent with Apple design language
 */
export const CARD_BORDER_RADIUS = 16;

/**
 * Horizontal gap between cards in pixels
 * 8px gap ensures ~12px peek of adjacent cards with 90% card width
 */
export const HORIZONTAL_CARD_GAP = 8;

/**
 * Vertical gap between cards in pixels
 */
export const VERTICAL_CARD_GAP = 12;

/**
 * Shadow configuration for cards
 * Apple-style multi-layer shadow
 */
export const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.15,
  shadowRadius: 12,
  elevation: 8, // Android
} as const;

/**
 * Light shadow for pressed state
 */
export const CARD_SHADOW_PRESSED = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 8,
  elevation: 4,
} as const;

/**
 * Apple HIG card shadow - subtle, refined floating effect
 * Clean shadow that doesn't overpower the content
 */
export const CARD_SHADOW_DRAMATIC = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 8,
} as const;

/**
 * Web-specific card shadow (Apple HIG - subtle and refined)
 */
export const CARD_SHADOW_DRAMATIC_WEB =
  '0 2px 4px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.08)';

/**
 * Dramatic shadow for expanded cards
 */
export const CARD_SHADOW_DRAMATIC_EXPANDED = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.32,
  shadowRadius: 28,
  elevation: 20,
} as const;

/**
 * Web-specific dramatic expanded shadow
 */
export const CARD_SHADOW_DRAMATIC_EXPANDED_WEB =
  '0 6px 12px rgba(0, 0, 0, 0.12), 0 16px 36px rgba(0, 0, 0, 0.22), 0 32px 64px rgba(0, 0, 0, 0.1)';

// =============================================================================
// GESTURE CONFIGURATION
// =============================================================================

/**
 * Distance threshold for snapping to next card
 * If drag exceeds this + velocity threshold, snap to next
 */
export const SNAP_DISTANCE_THRESHOLD = 50;

/**
 * Ratio for determining gesture axis priority
 * If horizontal velocity > vertical * this, treat as horizontal
 */
export const AXIS_PRIORITY_RATIO = 1.5;

// =============================================================================
// ANIMATION CONFIGURATION
// =============================================================================

/**
 * Scale values for vertical card stack
 * Slightly different from horizontal for visual hierarchy
 */
export const VERTICAL_CARD_SCALE = {
  active: 1.0,
  inactive: 0.94,
  pressed: 0.97,
} as const;

/**
 * Opacity values for vertical card stack
 * Higher contrast for depth perception
 */
export const VERTICAL_CARD_OPACITY = {
  active: 1.0,
  inactive: 0.5,
} as const;

/**
 * Rotation for 3D depth effect on horizontal scroll
 */
export const CARD_ROTATE_Y = {
  left: -2,
  center: 0,
  right: 2,
} as const;

// =============================================================================
// EXPANSION CONFIGURATION
// =============================================================================

/**
 * Expanded card height as ratio of screen height
 * 85% gives room for status bar and a subtle hint at bottom
 */
export const EXPANDED_HEIGHT_RATIO = 0.85;

/**
 * Animation duration for expand/collapse in ms
 */
export const EXPANSION_ANIMATION_DURATION = 300;

/**
 * Shadow for expanded cards (more pronounced)
 */
export const CARD_SHADOW_EXPANDED = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.2,
  shadowRadius: 16,
  elevation: 12,
} as const;

// =============================================================================
// PERSISTENCE
// =============================================================================

/**
 * AsyncStorage key for card navigation state
 */
export const PERSISTENCE_KEY = '@regattaflow/card_navigation_state';

/**
 * Debounce time for saving state (ms)
 */
export const PERSISTENCE_DEBOUNCE = 500;

// =============================================================================
// DIMENSION HELPERS
// =============================================================================

/**
 * Get current screen dimensions
 */
export function getScreenDimensions() {
  const { width, height } = Dimensions.get('window');
  return { width, height };
}

/**
 * Portrait carousel card sizing (web)
 * The zoomed-in carousel uses narrow-tall cards to match the zoomed-out
 * MiniCard grid. Constants here bound calculateWebCardWidth so desktop
 * cards don't stretch to landscape.
 */
export const MIN_PORTRAIT_CARD_WIDTH = 380;
export const MAX_PORTRAIT_CARD_WIDTH = 440;

/**
 * Portrait carousel card height as ratio of window height.
 * Separate from CARD_HEIGHT_RATIO (which drives native vertical stacking math)
 * so we can keep the web carousel tall without touching shared layout.
 */
export const PORTRAIT_CARD_HEIGHT_RATIO = 0.85;

/**
 * Calculate web-specific card width based on container width.
 *
 * Portrait-capped: on tablet+ we clamp the width between MIN_ and
 * MAX_PORTRAIT_CARD_WIDTH so the carousel card stays narrow-tall and the
 * neighbors still peek from both sides. Mobile keeps the standard 86% ratio.
 */
export function calculateWebCardWidth(containerWidth: number): number {
  // Mobile: use standard ratio (already narrow on phones)
  if (containerWidth < 600) {
    return Math.round(containerWidth * CARD_WIDTH_RATIO);
  }

  // Tablet+: clamp to the portrait band so cards never go landscape.
  // If the container is too small to fit the floor plus side-peek, fall back
  // to what fits (floor wins — side peek is nice-to-have, not required).
  const desired = Math.min(
    MAX_PORTRAIT_CARD_WIDTH,
    Math.max(MIN_PORTRAIT_CARD_WIDTH, Math.round(containerWidth * 0.4))
  );
  // Leave at least a small margin so neighbors can peek; otherwise just fit.
  const maxFit = containerWidth - 32;
  return Math.min(desired, maxFit);
}

/**
 * Calculate card dimensions based on screen size
 */
export function calculateCardDimensions(
  screenWidth: number,
  screenHeight: number
) {
  const cardWidth = Math.round(screenWidth * CARD_WIDTH_RATIO);
  const cardHeight = Math.round(screenHeight * CARD_HEIGHT_RATIO);
  const horizontalPeek = Math.round(screenWidth * PEEK_WIDTH_RATIO);
  const verticalPeek = Math.round(screenHeight * VERTICAL_PEEK_RATIO);

  // Center horizontally with small peek of adjacent cards
  const contentPaddingLeft = Math.round((screenWidth - cardWidth) / 2);

  // Position vertically to show peek of card below
  // 8% from top gives room for status bar and leaves ~24% at bottom for peek
  const contentPaddingTop = Math.round(screenHeight * 0.08);

  // Snap intervals include gap
  const horizontalSnapInterval = cardWidth + HORIZONTAL_CARD_GAP;
  const verticalSnapInterval = cardHeight + VERTICAL_CARD_GAP;

  return {
    cardWidth,
    cardHeight,
    screenWidth,
    screenHeight,
    borderRadius: CARD_BORDER_RADIUS,
    horizontalPeek,
    verticalPeek,
    horizontalSnapInterval,
    verticalSnapInterval,
    contentPaddingLeft,
    contentPaddingTop,
  };
}

// =============================================================================
// FEATURE FLAGS (local to card system)
// =============================================================================

/**
 * Enable debug logging for card navigation
 */
export const DEBUG_CARD_NAVIGATION = __DEV__;

/**
 * Enable haptic feedback
 */
export const ENABLE_HAPTICS = true;

/**
 * Enable state persistence
 */
export const ENABLE_PERSISTENCE = true;
