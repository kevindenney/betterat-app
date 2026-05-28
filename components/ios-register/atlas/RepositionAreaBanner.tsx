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

import { IOS_COLORS } from '@/lib/design-tokens-ios';

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
            styles.btnCancel,
            pressed && { opacity: 0.7 },
            saving && { opacity: 0.5 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Cancel reposition"
        >
          <Text style={styles.btnText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={onSave}
          disabled={!hasMoved || saving}
          style={({ pressed }) => [
            styles.btn,
            hasMoved ? styles.btnSave : styles.btnSaveDisabled,
            pressed && hasMoved && !saving && { opacity: 0.85 },
            saving && { opacity: 0.7 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Save new position"
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.btnText}>
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
  // Each button takes 50% of the bar via flex:1. Solid-color fills with
  // white text — no transparent alphas, no wrapper Views, no subtle
  // borders. After several rounds of "white on white" reports, this is
  // the simplest shape that's guaranteed to render two visible pills.
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancel: {
    backgroundColor: '#3A3A3C',
  },
  btnSave: {
    backgroundColor: IOS_COLORS.systemBlue,
  },
  btnSaveDisabled: {
    backgroundColor: '#8E8E93',
  },
  btnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
