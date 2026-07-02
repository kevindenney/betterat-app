/**
 * ZoomLevelPicker — vertical four-glyph rail on the right edge.
 *
 * Resolves the gesture-affordance conflict the bottom horizontal pill
 * created: horizontal swipe already means "previous / next step", so a
 * horizontal segmented control on the same axis reads as "swipe me to
 * change zoom" — which it isn't. Zoom is a depth axis (pinch), so the
 * picker belongs on the vertical axis. Stacking the four glyphs on the
 * right edge frees the horizontal axis for the swipe-between-steps
 * gesture (which the L1 peeks indicate).
 *
 * Pinch remains the primary gesture; the rail is a tap-to-jump
 * affordance plus a "where am I in the zoom ladder" indicator that's
 * always visible. Tapping the ONE glyph while already at L1 calls
 * onSnapToCurrent (return-to-NOW, mirrors the Apple Photos pattern of
 * tap-current-period-to-snap).
 *
 * Order: most-zoomed-out at top (ALL), most-zoomed-in at bottom (ONE),
 * so pinching out moves up the rail.
 */

import React, { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';
import { triggerHaptic } from '@/lib/haptics';
import {
  ZOOM_LEVEL_LABELS,
  ZOOM_LEVEL_SCOPE_LABELS,
  type ZoomLevel,
} from './types';

interface ZoomLevelPickerProps {
  level: ZoomLevel;
  onChange: (next: ZoomLevel) => void;
  /** Called when the L1 glyph is tapped while already at L1. */
  onSnapToCurrent?: () => void;
  /** Distance from the right edge in pt. */
  rightOffset?: number;
  /** Persona-native noun for the L3 scope ("arc", "rotation", "season")
   *  — substituted into the L3 screen-reader label so it matches the
   *  visible header vocab. */
  periodNoun?: string;
  /** Fade + lift the rail off-axis (and disable its touches) while a text
   *  input / composer is focused, so it never collides with a send button
   *  or the rising keyboard. Mirrors Apple Photos hiding its toolbar when
   *  an input takes over. */
  hidden?: boolean;
}

// L2 (WEEK) merged into L1 (STEP) — rail shows Step·Arc·All, top to bottom: All, Arc, Step.
const RAIL_ORDER: ZoomLevel[] = [4, 3, 1];

const GLYPH_SIZE = 26;
const SEGMENT_SIZE = 52;
const RAIL_PADDING = 7;
const DEFAULT_RIGHT_OFFSET = 10;

/** Horizontal lane the floating rail occupies, measured from the right
 *  edge: rail box (segment + padding both sides) + right offset + a small
 *  breathing gap. Full-bleed level content (charts/sparklines) should
 *  subtract this from its width so data never renders under the rail. */
export const ZOOM_RAIL_RESERVED_WIDTH =
  SEGMENT_SIZE + RAIL_PADDING * 2 + DEFAULT_RIGHT_OFFSET + 8;

/** Per-component dodge for content that would otherwise sit under the
 *  floating rail. Native keeps the Apple-Photos hover: the rail floats over
 *  edge-to-edge content and full-bleed pieces subtract this locally. On web
 *  the canvas reserves the rail's whole lane at the level stage instead
 *  (mouse users kept finding interactive controls hidden under the rail),
 *  so local dodges collapse to 0. */
export const ZOOM_RAIL_CONTENT_DODGE =
  Platform.OS === 'web' ? 0 : ZOOM_RAIL_RESERVED_WIDTH;

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

function RailSegment({
  level,
  active,
  onPress,
  scopeLabel,
  label,
}: {
  level: ZoomLevel;
  active: boolean;
  onPress: () => void;
  scopeLabel: string;
  label: string;
}) {
  const scale = useSharedValue(active ? 1 : 0.88);

  useEffect(() => {
    scale.value = withSpring(active ? 1.12 : 0.88, {
      damping: 14,
      stiffness: 220,
    });
  }, [active, scale]);

  const glyphStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const tint = active ? IOS_COLORS.systemBlue : IOS_REGISTER.labelSecondary;

  return (
    <Pressable
      testID={`timeline-zoom-level-${level}`}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={scopeLabel}
      style={({ pressed }) => [
        styles.segment,
        active && styles.segmentActive,
        pressed && !active && styles.segmentPressed,
      ]}
    >
      <Animated.View style={glyphStyle}>
        <LevelGlyph level={level} color={tint} />
      </Animated.View>
      <Text
        style={[styles.segmentLabel, active && styles.segmentLabelActive]}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ZoomLevelPicker({
  level,
  onChange,
  onSnapToCurrent,
  rightOffset = DEFAULT_RIGHT_OFFSET,
  periodNoun = 'arc',
  hidden = false,
}: ZoomLevelPickerProps) {
  const hideProgress = useSharedValue(hidden ? 1 : 0);
  useEffect(() => {
    hideProgress.value = withTiming(hidden ? 1 : 0, { duration: 180 });
  }, [hidden, hideProgress]);

  const hostAnimStyle = useAnimatedStyle(() => ({
    opacity: 1 - hideProgress.value,
    transform: [{ translateX: hideProgress.value * 24 }],
  }));

  const scopeLabelFor = (l: ZoomLevel) =>
    l === 3 ? `Current ${periodNoun}` : ZOOM_LEVEL_SCOPE_LABELS[l];
  // The rail is a fixed depth ladder (Apple-Photos-style STEP/WEEK/ARC/ALL),
  // not a content surface — uniform short tokens that always fit the 52pt
  // segment. The persona-native period noun ("sketchbook", "rotation"…) is
  // 6–10 chars and lives where it has room: the season header eyebrow, the
  // arc switcher, and the a11y scope label below ("Current sketchbook").
  const labelFor = (l: ZoomLevel) => ZOOM_LEVEL_LABELS[l];
  const handlePress = (target: ZoomLevel) => {
    if (target === level) {
      if (target === 1 && onSnapToCurrent) {
        triggerHaptic('selection');
        onSnapToCurrent();
      }
      return;
    }
    triggerHaptic('impactLight');
    onChange(target);
  };

  return (
    <Animated.View
      testID="timeline-zoom-rail"
      pointerEvents={hidden ? 'none' : 'box-none'}
      style={[styles.host, { right: rightOffset }, hostAnimStyle]}
      accessibilityRole="tablist"
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
    >
      <View style={styles.rail}>
        {RAIL_ORDER.map((l) => (
          <RailSegment
            key={l}
            level={l}
            active={l === level}
            onPress={() => handlePress(l)}
            scopeLabel={scopeLabelFor(l)}
            label={labelFor(l)}
          />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 50,
  },
  rail: {
    flexDirection: 'column',
    padding: RAIL_PADDING,
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 34,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.22)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.16,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  segment: {
    width: SEGMENT_SIZE,
    height: SEGMENT_SIZE,
    borderRadius: SEGMENT_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  segmentLabel: {
    maxWidth: SEGMENT_SIZE - 4,
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    textAlign: 'center',
    color: IOS_REGISTER.labelSecondary,
  },
  segmentLabelActive: {
    color: IOS_COLORS.systemBlue,
  },
  segmentActive: {
    backgroundColor: 'rgba(0, 122, 255, 0.14)',
  },
  segmentPressed: {
    backgroundColor: 'rgba(118, 118, 128, 0.08)',
  },
});

export default ZoomLevelPicker;
