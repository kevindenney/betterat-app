import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { formatElapsedMmSs } from './doCaptureModel';

const CORAL = '#FF6B6B';
const GRAY_5 = '#E5E5EA';
const LABEL = '#1C1C1E';
const LABEL_3 = 'rgba(60, 60, 67, 0.60)';

const PULSE_DURATION_MS = 1400;

export interface DoLiveHeaderProps {
  /** Number of captures in the stream — drives the left stat. */
  captureCount: number;
  /** Elapsed time since the activity started, in milliseconds — drives the right stat. */
  elapsedMs: number;
  /** Label rendered to the right of the pulsing dot. Defaults to "Capturing"; the parent card already shows LIVE · IN PROGRESS above. */
  liveLabel?: string;
}

/**
 * Frame 2 · A — Live indicator + B — Stats.
 * Coral pulse is the only foreground coral on the surface; everything else is neutral.
 */
export function DoLiveHeader({
  captureCount,
  elapsedMs,
  liveLabel = 'Capturing',
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
        style={styles.indicator}
        accessibilityLabel={`Capturing — ${captureCount} captures, ${formatElapsedMmSs(elapsedMs)} elapsed`}
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
        <Text style={styles.indicatorLabel} numberOfLines={1}>
          {liveLabel}
        </Text>
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
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
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
  indicatorLabel: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
    color: LABEL_3,
    flexShrink: 1,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    flexShrink: 0,
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
