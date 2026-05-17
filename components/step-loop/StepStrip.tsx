/**
 * <StepStrip> — em-weighted series + sub-context strip.
 *
 * Anatomy: `.step-strip` in docs/redesign/ios-register/legacy-reskin-common.css.
 * Spec:    docs/redesign/ios-register/phase-0-shared-chrome.md (§ <StepStrip>)
 *
 * Renders as a 33pt-high band beneath the state header:
 *   [round-blue icon] [primary em] · [secondary muted]
 *
 * The first segment (primary) is em-weighted (.label color, 600). The
 * secondary tail is muted (label-2, 400) and truncates with ellipsis.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Flag, Trophy } from 'lucide-react-native';
import {
  GRAY_5,
  IOS_BLUE,
  IOS_BLUE_TINT,
  LABEL,
  LABEL_2,
  LABEL_4,
} from '@/lib/design-tokens-step-loop-ios';

export type StepStripIcon = 'flag-3' | 'trophy' | 'flag';

export interface StepStripProps {
  icon?: StepStripIcon;
  /** Em-weighted anchor — usually a series or season name. */
  primary: string;
  /** Optional muted sub-context tail. */
  secondary?: string;
  testID?: string;
}

function StripIcon({ name }: { name: StepStripIcon }) {
  const Component = name === 'trophy' ? Trophy : Flag;
  return (
    <View style={styles.icon}>
      <Component size={11} color={IOS_BLUE} strokeWidth={2.2} />
    </View>
  );
}

export function StepStrip({
  icon = 'flag-3',
  primary,
  secondary,
  testID,
}: StepStripProps) {
  return (
    <View style={styles.strip} testID={testID}>
      <StripIcon name={icon} />
      <Text style={styles.text} numberOfLines={1} ellipsizeMode="tail">
        <Text style={styles.em}>{primary}</Text>
        {secondary ? (
          <>
            <Text style={styles.sep}>{'  ·  '}</Text>
            <Text>{secondary}</Text>
          </>
        ) : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    height: 33,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: GRAY_5,
    backgroundColor: '#FAFAFC',
  },
  icon: {
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
