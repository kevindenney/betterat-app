/**
 * <StatePill> — seven-variant state pill for the iOS register step loop.
 *
 * Anatomy: `.state-pill` + variant classes in
 *   docs/redesign/ios-register/legacy-reskin-common.css
 * Spec:    docs/redesign/ios-register/phase-0-shared-chrome.md (§ <StatePill>)
 *
 * Variants:
 *   planned  → gray pill, no glyph         (pre-step)
 *   current  → blue pill, 8px blue dot     (this step is up next)
 *   live     → coral pill, pulsing dot     (capturing right now)
 *   complete → green pill, tick glyph      (step done)
 *   reflect  → purple pill, sparkles glyph (long-arc / reflect surface)
 *   settled  → green pill, tick glyph      (settled / locked in)
 *   between  → amber pill, no glyph        (hinge state between steps)
 */

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { Check, Clock3, Sparkles } from 'lucide-react-native';
import {
  GRAY_5,
  GRAY_6,
  IOS_AMBER,
  IOS_BLUE,
  IOS_BLUE_DEEP,
  IOS_BLUE_STRONG,
  IOS_BLUE_TINT,
  IOS_CORAL,
  IOS_CORAL_DEEP,
  IOS_CORAL_SOFT,
  IOS_CORAL_TINT,
  IOS_GREEN,
  IOS_GREEN_DEEP,
  IOS_GREEN_SOFT,
  IOS_GREEN_TINT,
  IOS_PURPLE,
  IOS_PURPLE_DEEP,
  IOS_PURPLE_SOFT,
  IOS_PURPLE_TINT,
  LABEL,
  LABEL_2,
  LABEL_3,
} from '@/lib/design-tokens-step-loop-ios';

export type StatePillVariant =
  | 'planned'
  | 'current'
  | 'live'
  | 'complete'
  | 'reflect'
  | 'settled'
  | 'between';

export interface StatePillStat {
  num?: string;
  label?: string;
  icon?: 'clock';
  onPress?: () => void;
  accessibilityLabel?: string;
  active?: boolean;
}

export interface StatePillProps {
  variant: StatePillVariant;
  label: string;
  /** Optional right-aligned stats group (used in Do tab header). */
  stats?: StatePillStat[];
  testID?: string;
}

interface VariantSpec {
  background: string;
  border: string;
  labelColor: string;
}

const VARIANT_SPECS: Record<StatePillVariant, VariantSpec> = {
  planned: { background: GRAY_6, border: GRAY_5, labelColor: LABEL_2 },
  current: { background: IOS_BLUE_TINT, border: IOS_BLUE_STRONG, labelColor: IOS_BLUE_DEEP },
  live: { background: IOS_CORAL_TINT, border: IOS_CORAL_SOFT, labelColor: IOS_CORAL_DEEP },
  complete: { background: IOS_GREEN_TINT, border: IOS_GREEN_SOFT, labelColor: IOS_GREEN_DEEP },
  reflect: { background: IOS_PURPLE_TINT, border: IOS_PURPLE_SOFT, labelColor: IOS_PURPLE_DEEP },
  settled: { background: IOS_GREEN_TINT, border: IOS_GREEN_SOFT, labelColor: IOS_GREEN_DEEP },
  between: { background: 'rgba(194, 138, 42, 0.10)', border: 'rgba(194, 138, 42, 0.22)', labelColor: IOS_AMBER },
};

function LivePulse() {
  const opacity = useSharedValue(1);

  useEffect(() => {
    // 1.4s ease-out repeating fade as called out in the brief.
    opacity.value = withRepeat(
      withTiming(0.3, { duration: 1400, easing: Easing.out(Easing.ease) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(opacity);
    };
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.pulseDot, animatedStyle]} />;
}

function VariantGlyph({ variant }: { variant: StatePillVariant }) {
  if (variant === 'live') {
    return <LivePulse />;
  }
  if (variant === 'complete' || variant === 'settled') {
    return (
      <View style={[styles.tick, { backgroundColor: IOS_GREEN }]}>
        <Check size={9} color="#FFFFFF" strokeWidth={3} />
      </View>
    );
  }
  if (variant === 'reflect') {
    return (
      <View style={[styles.tick, { backgroundColor: IOS_PURPLE }]}>
        <Sparkles size={8.5} color="#FFFFFF" />
      </View>
    );
  }
  if (variant === 'current') {
    return <View style={styles.blueDot} />;
  }
  return null;
}

export function StatePill({ variant, label, stats, testID }: StatePillProps) {
  const spec = VARIANT_SPECS[variant];

  const pill = (
    <View
      testID={testID}
      style={[
        styles.pill,
        { backgroundColor: spec.background, borderColor: spec.border },
      ]}
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      <VariantGlyph variant={variant} />
      <Text style={[styles.label, { color: spec.labelColor }]}>{label}</Text>
    </View>
  );

  if (!stats || stats.length === 0) {
    return pill;
  }

  return (
    <View style={styles.row}>
      {pill}
      <View style={styles.stats}>
        {stats.map((stat, index) => (
          <React.Fragment key={`${stat.label}-${index}`}>
            {index > 0 && <View style={styles.statsSeparator} />}
            <StatePillStatView stat={stat} />
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

function StatePillStatView({ stat }: { stat: StatePillStat }) {
  const content = stat.icon === 'clock' ? (
    <Clock3 size={16} color={stat.active ? LABEL : LABEL_3} strokeWidth={2.1} />
  ) : (
    <>
      <Text style={styles.statNum}>{stat.num}</Text>
      {stat.label ? <Text style={styles.statLabel}>{stat.label}</Text> : null}
    </>
  );

  if (stat.onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={stat.accessibilityLabel ?? stat.label}
        onPress={stat.onPress}
        hitSlop={8}
        style={({ pressed }) => [
          styles.stat,
          stat.icon && styles.iconStat,
          stat.active && styles.iconStatActive,
          pressed && styles.statPressed,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={[styles.stat, stat.icon && styles.iconStat]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingLeft: 7,
    paddingRight: 9,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: IOS_CORAL,
  },
  blueDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: IOS_BLUE,
  },
  tick: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  stat: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  iconStat: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconStatActive: {
    backgroundColor: GRAY_6,
  },
  statPressed: {
    opacity: 0.65,
  },
  statNum: {
    fontSize: 17,
    fontWeight: '600',
    color: LABEL,
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
    lineHeight: 18,
  },
  statLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: LABEL_3,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 3,
  },
  statsSeparator: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: GRAY_5,
    marginVertical: 2,
  },
});
