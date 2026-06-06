/**
 * LocationAnchor — small "where am I" pill rendered in tab chrome.
 *
 * Answers the persistent comprehension gap: a user opening Atlas, Practice,
 * or any geographically-aware tab has no anchor for *where in the world*
 * they're looking. The Practice tab's "NEAR" button is meaningless without
 * one; Atlas's map orientation is implicit. This component is the shared
 * primitive every tab can lean on.
 *
 * v1: static label sourced by the caller (typically "Region · HomeVenue",
 * e.g. "Hong Kong · RHKYC"). v2 will accept an onPress to open a venue
 * picker and a `live` flag for GPS-derived region.
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
  /** Future-proofing: a tap will eventually open a venue picker. */
  onPress?: () => void;
}

export function LocationAnchor({ region, venue, onPress }: LocationAnchorProps) {
  if (!region && !venue) return null;
  const label = region && venue ? `${region} · ${venue}` : (region ?? venue ?? '');
  const Wrapper: React.ElementType = onPress ? Pressable : View;
  return (
    <Wrapper style={styles.pill} onPress={onPress} hitSlop={6}>
      <Ionicons
        name="location"
        size={11}
        color="rgba(60, 60, 67, 0.78)"
        style={styles.icon}
      />
      <Text style={styles.text} numberOfLines={1}>
        {label}
      </Text>
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
    backgroundColor: 'rgba(255,255,255,0.82)',
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
  text: {
    fontSize: 12,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    color: 'rgba(60, 60, 67, 0.85)',
    letterSpacing: -0.1,
  },
});
