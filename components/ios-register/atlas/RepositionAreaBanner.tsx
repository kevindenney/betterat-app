/**
 * RepositionAreaBanner — overlay chrome shown while the user is
 * repositioning a racing area via tap-to-place. Lives on top of the
 * map canvas. Map taps elsewhere update the candidate center via the
 * existing handleMapPress wiring; this component just shows the user
 * what's happening and gives them Save / Cancel.
 */

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';

interface RepositionAreaBannerProps {
  areaName: string;
  hasMoved: boolean;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
  bottomOffset?: number;
}

// The Atlas floating chrome (location anchor + layers/mail/profile
// cluster + filter pill) eats ~96pt below the safe-area inset on F1.
// Push the reposition banner past that so it never sits behind the
// system clock / dynamic island AND never overlaps the cluster row.
const CHROME_CLEAR_HEIGHT = 96;

export function RepositionAreaBanner({
  areaName,
  hasMoved,
  saving,
  onCancel,
  onSave,
  bottomOffset = 16,
}: RepositionAreaBannerProps) {
  const insets = useSafeAreaInsets();
  const top = Math.max(insets.top, 8) + CHROME_CLEAR_HEIGHT;
  return (
    <>
      <View style={[styles.topBanner, { top }]} pointerEvents="none">
        <View style={styles.topBannerInner}>
          <Ionicons name="move" size={14} color="#FFFFFF" />
          <Text style={styles.topBannerText} numberOfLines={2}>
            Tap on the map to set a new center for{' '}
            <Text style={styles.topBannerName}>{areaName}</Text>
          </Text>
        </View>
      </View>

      <View style={[styles.actionBar, { bottom: bottomOffset }]} pointerEvents="box-none">
        <Pressable
          onPress={onCancel}
          disabled={saving}
          style={({ pressed }) => [
            styles.btn,
            styles.btnSecondary,
            pressed && { opacity: 0.7 },
            saving && { opacity: 0.5 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Cancel reposition"
        >
          <Text style={styles.btnSecondaryText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={onSave}
          disabled={!hasMoved || saving}
          style={({ pressed }) => [
            styles.btn,
            styles.btnPrimary,
            (!hasMoved || saving) && styles.btnDisabled,
            pressed && hasMoved && !saving && { opacity: 0.8 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Save new position"
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text
              style={[
                styles.btnPrimaryText,
                !hasMoved && styles.btnDisabledText,
              ]}
            >
              {hasMoved ? 'Save position' : 'Tap the map…'}
            </Text>
          )}
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  topBanner: {
    position: 'absolute',
    // `top` is overridden inline (safe-area insets + chrome clearance).
    left: 12,
    right: 12,
    zIndex: 1300,
    alignItems: 'center',
  },
  topBannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(10, 132, 255, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    maxWidth: 480,
  },
  topBannerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
    lineHeight: 17,
  },
  topBannerName: {
    fontWeight: '700',
  },
  actionBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 1310,
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondary: {
    backgroundColor: 'rgba(120, 120, 130, 0.14)',
  },
  btnSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  btnPrimary: {
    backgroundColor: IOS_COLORS.systemBlue,
  },
  btnPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Disabled state was previously rgba(blue, 0.4) with white text —
  // over the white card that resolves to near-white with white text
  // and the user reasonably reports "Save is missing." Use a strong
  // mid-gray fill with a 1pt outline and dark gray text so the
  // "Tap the map…" affordance is impossible to miss.
  btnDisabled: {
    backgroundColor: '#EDEDF0',
    borderWidth: 1,
    borderColor: 'rgba(60, 60, 67, 0.18)',
  },
  btnDisabledText: {
    color: IOS_REGISTER.label,
    opacity: 0.7,
  },
});
