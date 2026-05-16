/**
 * SeriesStrip — canonical Frame 1 of the Series feature.
 *
 * White card slotted between the interest header and the zoomed-out timeline.
 * Per docs/redesign/ios-register/series-feature-canonical.html Frame 1:
 *
 *   ┌────┬───────────────────────────────────────────┬────┐
 *   │ 🏆 │ SEASON                                    │  ⌄ │
 *   │    │ Winter 2025–2026 · 6 of 14 steps          │    │
 *   │    │ ▰▰▰▰▱▱▱▱▱▱▱▱▱▱  (iOS-blue progress)        │    │
 *   └────┴───────────────────────────────────────────┴────┘
 *
 * Tap target = full row → opens the switch-Series sheet (Frame 2, later commit).
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface SeriesStripProps {
  /** Per-interest singular label (Season / Term / Workshop / Block / Series). */
  label: string;
  /** Active Series name (e.g. "Winter 2025–2026"). */
  name: string;
  /** 1-based current step index. */
  currentIndex: number;
  /** Total step count across the active Series. */
  totalSteps: number;
  /** Progress fraction in [0, 1], typically currentIndex / totalSteps. */
  progress: number;
  /** Optional date range (e.g. "Nov 1, 2025 – May 31, 2026"). Reserved for Frame 2. */
  dateRange?: string;
  /** Tap handler for opening the switch-Series sheet (Frame 2). */
  onPress: () => void;
}

const clamp01 = (n: number): number => {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
};

export function SeriesStrip({
  label,
  name,
  currentIndex,
  totalSteps,
  progress,
  onPress,
}: SeriesStripProps) {
  const safeProgress = clamp01(progress);
  const safeCurrent = Math.max(0, Math.floor(currentIndex || 0));
  const safeTotal = Math.max(0, Math.floor(totalSteps || 0));
  const showCount = safeTotal > 0;
  const upperLabel = label.toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`Switch ${label.toLowerCase()}`}
      accessibilityHint={`Opens ${label.toLowerCase()} picker`}
      testID="series-strip"
    >
      <View style={styles.trophy}>
        <Ionicons name="trophy" size={14} color="#8A5A00" />
      </View>

      <View style={styles.body}>
        <Text style={styles.eyebrow} testID="series-strip-eyebrow">
          {upperLabel}
        </Text>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1} testID="series-strip-name">
            {name}
          </Text>
          {showCount && (
            <>
              <Text style={styles.sep}>·</Text>
              <Text style={styles.count} testID="series-strip-count">
                {safeCurrent} of {safeTotal} steps
              </Text>
            </>
          )}
        </View>
        <View style={styles.progressTrack} accessibilityElementsHidden>
          <View
            style={[styles.progressFill, { width: `${safeProgress * 100}%` }]}
            testID="series-strip-progress"
          />
        </View>
      </View>

      <Ionicons
        name="chevron-down"
        size={16}
        color="#8E8E93"
        style={styles.chev}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 14,
    marginBottom: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trophy: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFD789',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 1,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#8E8E93',
    marginBottom: 2,
    lineHeight: 11,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    minWidth: 0,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.25,
    color: '#000000',
    flexShrink: 1,
  },
  sep: {
    fontSize: 13,
    color: '#C7C7CC',
    marginHorizontal: 4,
  },
  count: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#8E8E93',
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    marginTop: 8,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#E5E5EA',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 999,
  },
  chev: {
    alignSelf: 'center',
  },
});
