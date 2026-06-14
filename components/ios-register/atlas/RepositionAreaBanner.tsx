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
  showActionBar?: boolean;
  targetKind?: 'area' | 'step';
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
  showActionBar = true,
  targetKind = 'area',
}: RepositionAreaBannerProps) {
  const insets = useSafeAreaInsets();
  const top = Math.max(insets.top, 8) + CHROME_CLEAR_HEIGHT;
  const noun = targetKind === 'step' ? 'step location' : 'racing area center';
  const pendingText =
    targetKind === 'step'
      ? `Tap the map where "${areaName}" should happen.`
      : `Tap the map to set a new center for ${areaName}.`;
  const movedText =
    targetKind === 'step'
      ? `New location selected for "${areaName}". Save it, or tap the map again to adjust.`
      : `New center selected for ${areaName}. Save it, or tap the map again to adjust.`;
  const bodyText = hasMoved ? movedText : pendingText;

  if (showActionBar) {
    return (
      <View style={[styles.dialog, { bottom: bottomOffset }]}>
        <View style={styles.dialogHeader}>
          <View style={styles.dialogTitleRow}>
            <Ionicons
              name={targetKind === 'step' ? 'location-outline' : 'move'}
              size={15}
              color={IOS_COLORS.systemBlue}
            />
            <Text style={styles.dialogEyebrow}>
              {hasMoved ? 'Ready to save' : `Set ${noun}`}
            </Text>
          </View>
        </View>
        <Text style={styles.dialogBody}>{bodyText}</Text>

        <View style={styles.actionRow}>
          <View style={[styles.btnSlot, styles.btnSlotLeft]}>
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
          </View>
          <View style={styles.btnSlot}>
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
                <Text style={styles.btnText}>Save position</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.topBanner, { top }]} pointerEvents="none">
      <View style={styles.topBannerInner}>
        <Ionicons name="move" size={14} color="#FFFFFF" />
        <Text style={styles.topBannerText} numberOfLines={2}>
          Tap on the map to set a new center for{' '}
          <Text style={styles.topBannerName}>{areaName}</Text>
        </Text>
      </View>
    </View>
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
  dialog: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 1310,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  dialogTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  dialogEyebrow: {
    color: IOS_COLORS.systemBlue,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  dialogBody: {
    color: IOS_REGISTER.label,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
  },
  // Wrapper Views with explicit flex sizing so each Pressable gets a
  // concrete width to render its bg against. Direct Pressables with
  // flex:1 inside the row weren't sizing on iOS — empty bar.
  btnSlot: {
    flex: 1,
  },
  btnSlotLeft: {
    marginRight: 10,
  },
  btn: {
    width: '100%',
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
