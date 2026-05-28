/**
 * ZoomLevelPicker — the four-level zoom control for the timeline canvas.
 *
 * Apple-Photos-style segmented pill floating above the tab bar. Each
 * segment carries a distinctive glyph (one dot, 2×2 grid, arc, stacked
 * bars) + a short label (ONE / NEAR / ARC / ALL). The current level
 * elevates to a white sub-pill so the active scope reads at a glance.
 *
 * Pinch remains the primary gesture; this control is the tap-to-jump
 * affordance and the "where am I in the zoom ladder" indicator.
 *
 * Tapping the L1 segment when already at L1 calls onSnapToCurrent — the
 * "back to NOW" gesture (matches Apple Photos' tap-current-day-to-snap
 * pattern).
 */

import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { ZOOM_LEVEL_SCOPE_LABELS, type ZoomLevel } from './types';

interface ZoomLevelPickerProps {
  level: ZoomLevel;
  onChange: (next: ZoomLevel) => void;
  /** Called when the L1 segment is tapped while already at L1. */
  onSnapToCurrent?: () => void;
  /** Distance from the bottom edge in pt (used to clear the tab bar). */
  bottomOffset?: number;
}

const LEVELS: ZoomLevel[] = [1, 2, 3, 4];

const SHORT_LABEL: Record<ZoomLevel, string> = {
  1: 'ONE',
  2: 'NEAR',
  3: 'ARC',
  4: 'ALL',
};

const GLYPH_SIZE = 18;

function LevelGlyph({ level, color }: { level: ZoomLevel; color: string }) {
  switch (level) {
    case 1:
      return (
        <Svg width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox="0 0 18 18">
          <Circle cx="9" cy="9" r="4.5" fill={color} />
        </Svg>
      );
    case 2:
      return (
        <Svg width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox="0 0 18 18">
          <Circle cx="6" cy="6" r="2" fill={color} />
          <Circle cx="12" cy="6" r="2" fill={color} />
          <Circle cx="6" cy="12" r="2" fill={color} />
          <Circle cx="12" cy="12" r="2" fill={color} />
        </Svg>
      );
    case 3:
      return (
        <Svg width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox="0 0 18 18">
          <Path
            d="M 2.5 14 Q 9 0.5 15.5 14"
            stroke={color}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
          />
        </Svg>
      );
    case 4:
      return (
        <Svg width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox="0 0 18 18">
          <Rect x="2" y="4" width="14" height="2" rx="1" fill={color} />
          <Rect x="2" y="8" width="10" height="2" rx="1" fill={color} />
          <Rect x="2" y="12" width="14" height="2" rx="1" fill={color} />
        </Svg>
      );
  }
}

export function ZoomLevelPicker({
  level,
  onChange,
  onSnapToCurrent,
  bottomOffset = 28,
}: ZoomLevelPickerProps) {
  const handlePress = (target: ZoomLevel) => {
    if (target === level) {
      if (target === 1 && onSnapToCurrent) onSnapToCurrent();
      return;
    }
    onChange(target);
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { bottom: bottomOffset }]}
      accessibilityRole="tablist"
    >
      <BlurView
        intensity={Platform.OS === 'ios' ? 60 : 0}
        tint="light"
        style={styles.pill}
      >
        {LEVELS.map((l) => {
          const active = l === level;
          const tint = active ? IOS_REGISTER.label : IOS_REGISTER.labelSecondary;
          return (
            <Pressable
              key={l}
              onPress={() => handlePress(l)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={ZOOM_LEVEL_SCOPE_LABELS[l]}
              style={({ pressed }) => [
                styles.segment,
                active && styles.segmentActive,
                pressed && !active && styles.segmentPressed,
              ]}
            >
              <LevelGlyph level={l} color={tint} />
              <Text style={[styles.label, active && styles.labelActive]}>
                {SHORT_LABEL[l]}
              </Text>
            </Pressable>
          );
        })}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
  },
  pill: {
    flexDirection: 'row',
    borderRadius: 18,
    padding: 4,
    gap: 2,
    overflow: 'hidden',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(248, 248, 250, 0.65)' : 'rgba(248, 248, 250, 0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.18)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.14,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 4 },
      },
      android: {
        elevation: 8,
      },
      default: {},
    }),
  },
  segment: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    minWidth: 60,
    borderRadius: 14,
    alignItems: 'center',
    gap: 2,
  },
  segmentActive: {
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
      },
      android: {
        elevation: 2,
      },
      default: {},
    }),
  },
  segmentPressed: {
    backgroundColor: 'rgba(118, 118, 128, 0.08)',
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: IOS_REGISTER.labelSecondary,
  },
  labelActive: {
    color: IOS_REGISTER.label,
  },
});

export default ZoomLevelPicker;
