import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { DoCaptureItem } from '../doCaptureModel';

const LABEL = '#1C1C1E';

export interface QuickNoteCapturePreviewProps {
  capture: DoCaptureItem;
}

/**
 * Frame 2 — typed quick note body. Roman, single column, body grid slot.
 * Body text is rendered here; ts/chip/meta are owned by DoCaptureRow.
 */
export function QuickNoteCapturePreview({ capture }: QuickNoteCapturePreviewProps) {
  return (
    <View style={styles.body}>
      <Text style={styles.text}>{capture.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    // Slot is provided by DoCaptureRow's grid; this just wraps the text.
  },
  text: {
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.1,
    color: LABEL,
  },
});
