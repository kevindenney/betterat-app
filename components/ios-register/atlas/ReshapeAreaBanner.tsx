/**
 * ReshapeAreaBanner — overlay chrome shown while the user is adjusting
 * a racing area's polygon corners (tap a handle to select, tap the map
 * to move it; press-and-hold dragging also works). The vertex count
 * stays the same; only positions change. Sibling of RetraceAreaBanner
 * (which replaces the shape wholesale).
 */

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';

interface ReshapeAreaBannerProps {
  areaName: string;
  /** True once at least one handle has been dragged. Gates Save. */
  dirty: boolean;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
  bottomOffset?: number;
}

// Same chrome-clear offset as the sibling banners so this never sits
// under the floating chrome cluster.
const CHROME_CLEAR_HEIGHT = 96;

export function ReshapeAreaBanner({
  areaName,
  dirty,
  saving,
  onCancel,
  onSave,
  bottomOffset = 16,
}: ReshapeAreaBannerProps) {
  const insets = useSafeAreaInsets();
  const top = Math.max(insets.top, 8) + CHROME_CLEAR_HEIGHT;
  const canSave = dirty && !saving;
  return (
    <>
      <View style={[styles.topBanner, { top }]} pointerEvents="none">
        <View style={styles.topBannerInner}>
          <Ionicons name="move" size={14} color="#FFFFFF" />
          <Text style={styles.topBannerText} numberOfLines={3}>
            <Text style={styles.topBannerName}>{areaName}</Text>
            {'\n'}
            Tap a corner to select it, then tap the map to move it there.
          </Text>
        </View>
      </View>

      <View style={[styles.actionBar, { bottom: bottomOffset }]} pointerEvents="box-none">
        {/* Chrome lives on child Views, not the Pressables: a function-form
            Pressable `style` silently drops backgrounds (same trap as
            VisionBlock — see f798c7fe). */}
        <Pressable
          onPress={onCancel}
          disabled={saving}
          style={styles.btnFlex}
          accessibilityRole="button"
          accessibilityLabel="Cancel reshape"
        >
          {({ pressed }) => (
            <View
              style={[
                styles.btn,
                styles.btnSecondary,
                pressed && !saving && { opacity: 0.7 },
                saving && { opacity: 0.5 },
              ]}
            >
              <Text style={styles.btnSecondaryText}>Cancel</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          onPress={onSave}
          disabled={!canSave}
          style={styles.btnFlex}
          accessibilityRole="button"
          accessibilityLabel="Save new shape"
        >
          {({ pressed }) => (
            <View
              style={[
                styles.btn,
                styles.btnPrimary,
                !canSave && styles.btnDisabled,
                pressed && canSave && { opacity: 0.85 },
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={[styles.btnPrimaryText, !canSave && styles.btnDisabledText]}>
                  {dirty ? 'Save shape' : 'Tap a corner'}
                </Text>
              )}
            </View>
          )}
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  topBanner: {
    position: 'absolute',
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
    gap: 8,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  btnFlex: {
    flex: 1,
  },
  btn: {
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  btnSecondary: {
    backgroundColor: '#D1D1D6',
    borderWidth: 1,
    borderColor: 'rgba(60, 60, 67, 0.18)',
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
  btnDisabled: {
    backgroundColor: '#D1D1D6',
    borderWidth: 1,
    borderColor: 'rgba(60, 60, 67, 0.18)',
  },
  btnDisabledText: {
    color: IOS_REGISTER.label,
    opacity: 0.7,
  },
});
