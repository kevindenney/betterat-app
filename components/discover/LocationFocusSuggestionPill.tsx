/**
 * LocationFocusSuggestionPill — one-tap "you've traveled" banner.
 *
 * Renders only when useTravelFocusSuggestion detects the device is far from
 * the current location focus. Accepting opens a map-preview confirmation
 * (LocationConfirmSheet) so the user sees where the focus is moving before
 * it applies; the X dismisses for the session. Self-contained: surfaces just
 * pass the focus coords.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { useTravelFocusSuggestion } from '@/hooks/useTravelFocusSuggestion';
import {
  LocationConfirmSheet,
  type LocationConfirmTarget,
} from '@/components/discover/LocationConfirmSheet';

interface LocationFocusSuggestionPillProps {
  focusLat: number | null;
  focusLng: number | null;
}

export function LocationFocusSuggestionPill({
  focusLat,
  focusLng,
}: LocationFocusSuggestionPillProps) {
  const { suggestion, dismiss } = useTravelFocusSuggestion({ focusLat, focusLng });
  const [confirmTarget, setConfirmTarget] = useState<LocationConfirmTarget | null>(null);

  if (!suggestion) return null;

  return (
    <>
      <View style={styles.pill}>
        <Ionicons name="airplane-outline" size={16} color="#0A84FF" />
        <Text style={styles.text} numberOfLines={2}>
          Looks like you’re near <Text style={styles.place}>{suggestion.label}</Text>
        </Text>
        <Pressable
          style={styles.acceptBtn}
          onPress={() =>
            setConfirmTarget({
              lat: suggestion.lat,
              lng: suggestion.lng,
              label: suggestion.label,
            })
          }
          accessibilityRole="button"
          accessibilityLabel={`Preview and set location to ${suggestion.label}`}
        >
          <Text style={styles.acceptText}>Set location</Text>
        </Pressable>
        <Pressable
          hitSlop={8}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss location suggestion"
        >
          <Ionicons name="close" size={16} color={IOS_COLORS.secondaryLabel} />
        </Pressable>
      </View>

      <LocationConfirmSheet
        target={confirmTarget}
        onCancel={() => setConfirmTarget(null)}
        onConfirmed={() => {
          setConfirmTarget(null);
          dismiss();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: IOS_SPACING.md,
    marginBottom: IOS_SPACING.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(10, 132, 255, 0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(10, 132, 255, 0.25)',
  },
  text: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 16,
    color: IOS_COLORS.label,
  },
  place: {
    fontWeight: '700',
  },
  acceptBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#0A84FF',
    minWidth: 84,
    alignItems: 'center',
  },
  acceptText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default LocationFocusSuggestionPill;
