import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { formatElapsedMmSs } from './doCaptureModel';

const CORAL = '#FF6B6B';
const CORAL_DEEP = '#E54848';
const CORAL_TINT = 'rgba(255, 107, 107, 0.10)';
const CORAL_SOFT = 'rgba(255, 107, 107, 0.18)';
const GRAY_5 = '#E5E5EA';
const LABEL = '#1C1C1E';
const LABEL_3 = 'rgba(60, 60, 67, 0.60)';

const PULSE_DURATION_MS = 1400;

export interface DoLiveHeaderProps {
  /** Number of captures in the stream — drives the left stat. */
  captureCount: number;
  /** Elapsed time since the activity started, in milliseconds — drives the right stat. */
  elapsedMs: number;
  /** Label rendered to the right of the pulsing dot. Defaults to canonical "Live · capturing". */
  liveLabel?: string;
}

/**
 * Frame 2 · A — Live pill + B — Stats.
 * Coral pulse is the only foreground coral on the surface; everything else is neutral.
 */
export function DoLiveHeader({
  captureCount,
  elapsedMs,
  liveLabel = 'Live · capturing',
}: DoLiveHeaderProps) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: PULSE_DURATION_MS,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.55, 0, 0] });

  return (
    <View style={styles.row} accessibilityRole="header">
      <View
        style={styles.pill}
        accessibilityLabel={`Live · capturing — ${captureCount} captures, ${formatElapsedMmSs(elapsedMs)} elapsed`}
      >
        <View style={styles.dotWrap} accessibilityElementsHidden importantForAccessibility="no">
          <Animated.View
            pointerEvents="none"
            style={[
              styles.dotRing,
              { transform: [{ scale: ringScale }], opacity: ringOpacity },
            ]}
          />
          <View style={styles.dot} />
        </View>
        <Text style={styles.pillLabel}>{liveLabel}</Text>
      </View>

      <View style={styles.stats} accessibilityLabel="Capture stats">
        <Stat num={String(captureCount)} label="Captures" />
        <View style={styles.statsSep} />
        <Stat num={formatElapsedMmSs(elapsedMs)} label="Elapsed" />
      </View>
    </View>
  );
}

function Stat({ num, label }: { num: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statNum}>{num}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingTop: 13,
    paddingRight: 18,
    paddingBottom: 12,
    paddingLeft: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: GRAY_5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingTop: 5,
    paddingRight: 11,
    paddingBottom: 5,
    paddingLeft: 9,
    borderRadius: 999,
    backgroundColor: CORAL_TINT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CORAL_SOFT,
  },
  dotWrap: {
    width: 8,
    height: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: CORAL,
  },
  dotRing: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: CORAL,
  },
  pillLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: CORAL_DEEP,
    textTransform: 'uppercase',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  stat: {
    alignItems: 'flex-end',
  },
  statNum: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.4,
    color: LABEL,
    fontVariant: ['tabular-nums'],
    lineHeight: 18,
  },
  statLbl: {
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: LABEL_3,
    textTransform: 'uppercase',
    marginTop: 3,
  },
  statsSep: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: GRAY_5,
    alignSelf: 'stretch',
    marginVertical: 2,
  },
});
