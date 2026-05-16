import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  WAVEFORM_BAR_COUNT,
  WAVEFORM_TAIL_QUIET,
  buildWaveformHeights,
  formatVoiceDuration,
} from '../doCaptureModel';
import type { DoCaptureItem } from '../doCaptureModel';

const IOS_BLUE = '#007AFF';
const LABEL_3 = 'rgba(60, 60, 67, 0.60)';

export interface VoiceCapturePreviewProps {
  capture: DoCaptureItem;
  onPressPlay?: (captureId: string) => void;
}

/**
 * Frame 2 · D — 18-bar inline voice waveform player.
 * Final 4 bars render at 32% opacity per canonical spec.
 */
export function VoiceCapturePreview({ capture, onPressPlay }: VoiceCapturePreviewProps) {
  const heights = buildWaveformHeights(capture.voicePeaks);
  const duration = formatVoiceDuration(capture.voiceDurationSec);

  return (
    <View
      style={styles.row}
      accessibilityLabel={
        capture.voiceDurationSec ? `Voice clip · ${duration}` : 'Voice clip'
      }
    >
      <Pressable
        onPress={onPressPlay ? () => onPressPlay(capture.id) : undefined}
        style={({ pressed }) => [styles.play, pressed && styles.playPressed]}
        accessibilityRole="button"
        accessibilityLabel="Play voice"
        hitSlop={8}
      >
        <Ionicons name="play" size={12} color="#FFFFFF" />
      </Pressable>
      <View style={styles.bars} accessibilityElementsHidden importantForAccessibility="no">
        {heights.map((h, i) => {
          const isTail = i >= WAVEFORM_BAR_COUNT - WAVEFORM_TAIL_QUIET;
          return (
            <View
              key={i}
              style={[styles.bar, isTail && styles.barTail, { height: h }]}
            />
          );
        })}
      </View>
      {duration ? <Text style={styles.dur}>{duration}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 2,
  },
  play: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: IOS_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: IOS_BLUE,
    shadowOpacity: 0.45,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  playPressed: {
    opacity: 0.7,
  },
  bars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    height: 22,
  },
  bar: {
    flex: 1,
    backgroundColor: IOS_BLUE,
    borderRadius: 1,
    opacity: 0.85,
    minWidth: 2,
  },
  barTail: {
    opacity: 0.32,
  },
  dur: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: -0.05,
    color: LABEL_3,
    fontVariant: ['tabular-nums'],
  },
});
