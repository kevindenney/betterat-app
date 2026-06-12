/**
 * LocationAnchor — small "where am I" pill rendered in tab chrome.
 *
 * Answers the persistent comprehension gap: a user opening Atlas, Practice,
 * or any geographically-aware tab has no anchor for *where in the world*
 * they're looking. The Practice tab's "NEAR" button is meaningless without
 * one; Atlas's map orientation is implicit. This component is the shared
 * primitive every tab can lean on.
 *
 * Label is sourced by the caller (typically `useUserHomeVenue()` — the
 * location focus when set, home venue as fallback). Pass `onPress` to open
 * the location picker; a chevron renders so the pill reads as tappable.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontFamily } from '@/lib/design-tokens-editorial';

export interface LocationAnchorProps {
  /**
   * Region label, e.g. "Hong Kong". When null, the pill renders nothing —
   * callers should pass the result of `useUserHomeVenue()` directly and
   * let the component handle the empty state.
   */
  region?: string | null;
  /**
   * Optional venue suffix, e.g. "RHKYC". Rendered as "{region} · {venue}".
   * Skip when the user has no home venue set.
   */
  venue?: string | null;
  /** Opens the location picker. Adds a chevron affordance when present. */
  onPress?: () => void;
}

export function LocationAnchor({ region, venue, onPress }: LocationAnchorProps) {
  if (!region && !venue) return null;
  const label = region && venue ? `${region} · ${venue}` : (region ?? venue ?? '');
  const Wrapper: React.ElementType = onPress ? Pressable : View;
  return (
    <Wrapper
      style={styles.pill}
      onPress={onPress}
      hitSlop={6}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `Change location: ${label}` : undefined}
    >
      <Ionicons
        name="location"
        size={11}
        color="rgba(60, 60, 67, 0.78)"
        style={styles.icon}
      />
      <Text style={styles.text} numberOfLines={1}>
        {label}
      </Text>
      {onPress ? (
        <Ionicons
          name="chevron-down"
          size={10}
          color="rgba(60, 60, 67, 0.55)"
          style={styles.chevron}
        />
      ) : null}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    // Opaque fill: a semi-transparent white over the translucent toolbar
    // composited a faint vertical seam ("white line") down the pill.
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.10)',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  icon: {
    marginRight: 4,
  },
  chevron: {
    marginLeft: 4,
  },
  text: {
    fontSize: 12,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    color: 'rgba(60, 60, 67, 0.85)',
    letterSpacing: -0.1,
  },
});
