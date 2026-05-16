import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const IOS_BLUE = '#007AFF';
const IOS_BLUE_TINT = 'rgba(0, 122, 255, 0.10)';
const GRAY_5 = '#E5E5EA';
const LABEL = '#1C1C1E';
const LABEL_2 = '#3C3C43';
const LABEL_4 = 'rgba(60, 60, 67, 0.30)';
const STRIP_BG = '#FAFAFC';

export interface DoStepContextStripProps {
  /** Step title — the emphasised first segment ("Light-air starts in shifty breeze"). */
  stepTitle: string;
  /** Trailing context segments rendered after the title with bullet separators. */
  contextSegments?: string[];
}

/**
 * Frame 2 — quiet step context strip beneath the live header.
 * Renders single-line ellipsised text; canonical white space behaviour.
 */
export function DoStepContextStrip({ stepTitle, contextSegments = [] }: DoStepContextStripProps) {
  return (
    <View style={styles.row}>
      <View style={styles.ico}>
        <Ionicons name="flag-outline" size={11} color={IOS_BLUE} />
      </View>
      <Text style={styles.text} numberOfLines={1} ellipsizeMode="tail">
        <Text style={styles.em}>{stepTitle}</Text>
        {contextSegments.map((seg, i) => (
          <Text key={`${i}-${seg}`}>
            <Text style={styles.sep}> · </Text>
            <Text>{seg}</Text>
          </Text>
        ))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    paddingRight: 18,
    paddingBottom: 9,
    paddingLeft: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: GRAY_5,
    backgroundColor: STRIP_BG,
  },
  ico: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: IOS_BLUE_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    fontSize: 11.5,
    color: LABEL_2,
    letterSpacing: -0.05,
    lineHeight: 14,
  },
  em: {
    fontWeight: '600',
    color: LABEL,
  },
  sep: {
    color: LABEL_4,
  },
});
