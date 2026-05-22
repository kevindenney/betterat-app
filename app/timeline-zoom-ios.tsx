/**
 * Timeline Zoom — iOS register preview.
 *
 * The Practice tab as a single zoomable canvas (L1 Step → L2 Week →
 * L3 Season → L4 Years). Pinch is the primary gesture; the right-rail
 * 1/2/3/4 pill stack is the secondary affordance.
 *
 * Wire-up status:
 *   Preview only — renders <TimelineZoomCanvas /> with the canonical
 *   nursing sample dataset (Emily Shaw's clinical year). The canonical
 *   cutover that replaces the existing two-state taskbar toggle in
 *   Practice tab lands in a follow-up commit once gesture + snap
 *   behavior are validated on device.
 *
 * Deferred (separate commits): multi-select bulk edit, drag-to-reorder,
 * move-to-season sheet, notifications inbox, mentor iPad cohort
 * dashboard, provenance row + Discuss tab + AI combinators.
 *
 * Open at /timeline-zoom-ios. Gated by FEATURE_FLAGS.TIMELINE_ZOOM_IOS_REGISTER.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import {
  TimelineZoomCanvas,
  TIMELINE_ZOOM_SAMPLE_DATASET,
  type ZoomLevel,
} from '@/components/ios-register';

const LEVEL_PICKER: { id: ZoomLevel; label: string; sub: string }[] = [
  { id: 1, label: 'L1', sub: 'Step' },
  { id: 2, label: 'L2', sub: 'Week' },
  { id: 3, label: 'L3', sub: 'Season' },
  { id: 4, label: 'L4', sub: 'Years' },
];

export default function TimelineZoomIosPreview() {
  const [initialLevel, setInitialLevel] = useState<ZoomLevel>(1);
  // Remount canvas when initial level changes so the picker actually jumps.
  const [nonce, setNonce] = useState(0);

  const handlePick = (lvl: ZoomLevel) => {
    setInitialLevel(lvl);
    setNonce((n) => n + 1);
  };

  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topChrome}>
        <View style={styles.leftPad} />
        <Pressable
          style={styles.glyphBtn}
          hitSlop={8}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)/practice' as never);
          }}
          accessibilityLabel="Close iOS preview"
        >
          <Ionicons name="close" size={22} color={IOS_REGISTER.accentUserAction} />
        </Pressable>
      </View>

      <PreviewBanner />

      <View style={styles.framePickerRow}>
        {LEVEL_PICKER.map((item) => {
          const active = item.id === initialLevel;
          return (
            <Pressable
              key={item.id}
              onPress={() => handlePick(item.id)}
              style={[styles.framePickerChip, active && styles.framePickerChipActive]}
            >
              <Text style={[styles.framePickerLabel, active && styles.framePickerLabelActive]}>
                {item.label}
              </Text>
              <Text style={[styles.framePickerSub, active && styles.framePickerSubActive]}>
                {item.sub}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.phoneStage}>
        <View style={styles.phoneFrame}>
          <TimelineZoomCanvas
            key={nonce}
            dataset={TIMELINE_ZOOM_SAMPLE_DATASET}
            initialLevel={initialLevel}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function PreviewBanner() {
  return (
    <View style={styles.banner}>
      <Ionicons name="information-circle" size={14} color={IOS_REGISTER.labelSecondary} />
      <Text style={styles.bannerText}>
        Preview: the practice tab as one zoomable canvas — L1 Step, L2 Week,
        L3 Season, L4 Years. Pinch to change depths or tap the right-rail
        pill. Tap any card at L2/L3/L4 to zoom into L1.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  topChrome: {
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftPad: { width: 22 },
  glyphBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bannerText: {
    flex: 1,
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    lineHeight: 17,
    letterSpacing: -0.05,
  },
  framePickerRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
    justifyContent: 'center',
  },
  framePickerChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: IOS_REGISTER.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    alignItems: 'center',
    minWidth: 64,
  },
  framePickerChipActive: {
    backgroundColor: IOS_REGISTER.accentUserAction,
    borderColor: IOS_REGISTER.accentUserAction,
  },
  framePickerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: IOS_REGISTER.label,
    letterSpacing: -0.1,
  },
  framePickerLabelActive: {
    color: '#FFFFFF',
  },
  framePickerSub: {
    marginTop: 1,
    fontSize: 9.5,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.05,
  },
  framePickerSubActive: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  phoneStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  phoneFrame: {
    width: 360,
    maxWidth: '100%',
    height: '100%',
    maxHeight: 760,
    backgroundColor: '#FFFFFF',
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#0F172A',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
});
