import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatClockTime } from '../doCaptureModel';
import type { DoCaptureItem } from '../doCaptureModel';

const GRAY_4 = '#D1D1D6';
const GRAY_5 = '#E5E5EA';
const GRAY_6 = '#F2F2F7';
const LABEL = '#1C1C1E';
const LABEL_2 = '#3C3C43';
const LABEL_3 = 'rgba(60, 60, 67, 0.60)';

export interface TimeMarkerCapturePreviewProps {
  capture: DoCaptureItem;
}

/**
 * Frame 2 · E — auto-inserted phase boundary divider.
 * Hairline flanks an uppercase pill that reads "Beat 2 begins · 14:08".
 */
export function TimeMarkerCapturePreview({ capture }: TimeMarkerCapturePreviewProps) {
  const label = capture.markerLabel ?? capture.body;
  const clock = formatClockTime(capture.capturedAt);

  return (
    <View
      style={styles.row}
      accessibilityRole="header"
      accessibilityLabel={
        clock ? `${label} at ${clock}` : label
      }
    >
      <View style={styles.line} accessibilityElementsHidden importantForAccessibility="no" />
      <View style={styles.pill}>
        <Ionicons name="flag" size={11} color={LABEL_3} />
        <Text style={styles.lbl}>
          {label}
          {clock ? (
            <Text style={styles.em}>
              {' · '}
              {clock}
            </Text>
          ) : null}
        </Text>
      </View>
      <View style={styles.line} accessibilityElementsHidden importantForAccessibility="no" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginVertical: 2,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: GRAY_4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingTop: 3,
    paddingBottom: 4,
    borderRadius: 999,
    backgroundColor: GRAY_6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GRAY_5,
  },
  lbl: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: LABEL_2,
    textTransform: 'uppercase',
    fontVariant: ['tabular-nums'],
  },
  em: {
    color: LABEL,
  },
});
