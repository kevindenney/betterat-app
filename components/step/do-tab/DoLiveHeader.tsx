import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { StatePill } from '@/components/step-loop';
import { formatElapsedMmSs } from './doCaptureModel';

const GRAY_5 = '#E5E5EA';

const PULSE_DURATION_MS = 1400;

export interface DoLiveHeaderProps {
  /** Number of captures in the stream — drives the left stat. */
  captureCount: number;
  /** Elapsed time since the activity started, in milliseconds — drives the right stat. */
  elapsedMs: number;
  /** Label rendered to the right of the pulsing dot. */
  liveLabel?: string;
  /** When false, elapsed time collapses behind the small clock toggle. */
  timerVisible?: boolean;
  onToggleTimer?: () => void;
}

/**
 * Frame 2 · A — Live indicator + B — Stats.
 * Coral pulse is the only foreground coral on the surface; everything else is neutral.
 */
export function DoLiveHeader({
  captureCount,
  elapsedMs,
  liveLabel = 'Live · capturing',
  timerVisible = true,
  onToggleTimer,
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

  return (
    <View style={styles.row} accessibilityRole="header">
      <StatePill
        variant="live"
        label={liveLabel}
        stats={[
          { num: String(captureCount), label: 'Captures' },
          ...(timerVisible
            ? [{ num: formatElapsedMmSs(elapsedMs), label: 'Elapsed' }]
            : []),
          {
            icon: 'clock',
            active: timerVisible,
            onPress: onToggleTimer,
            accessibilityLabel: timerVisible ? 'Hide elapsed time' : 'Show elapsed time',
          },
        ]}
      />
      <Animated.View pointerEvents="none" style={styles.hiddenPulseForTest} />
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
  hiddenPulseForTest: {
    position: 'absolute',
    width: 0,
    height: 0,
    opacity: 0,
  },
});
