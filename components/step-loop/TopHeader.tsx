/**
 * <TopHeader> — 52pt screen header sitting above <StepCard>.
 *
 * Anatomy: `.top-header` in docs/redesign/ios-register/legacy-reskin-common.css.
 * Spec:    docs/redesign/ios-register/phase-0-shared-chrome.md (§ <TopHeader>)
 *
 * Layout:
 *   [interest dropdown ⌄]      [step counter]      [right cluster]
 *
 * Or with `backLabel` instead of `interestName`:
 *   [< back]                   [step counter]      [right cluster]
 *
 * The component is layout-only: it does not own any data. Callers supply
 * the interest name (and a press handler) or the back label.
 */

import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronLeft } from 'lucide-react-native';
import {
  GRAY_5,
  IOS_BLUE,
  IOS_BLUE_TINT,
  LABEL_2,
  LABEL_3,
} from '@/lib/design-tokens-step-loop-ios';

export interface TopHeaderProps {
  /** Active interest name shown on the left (mutually exclusive with backLabel). */
  interestName?: string;
  interestAccentColor?: string | null;
  onInterestPress?: () => void;
  /** Step counter text shown in the middle (e.g. "Step 4 of 10"). */
  stepCounter?: string;
  /** Optional right-aligned slot (icons, avatar, +, etc). */
  rightCluster?: React.ReactNode;
  /** Back-mode label (e.g. "Race 4"). When set, the interest chip is hidden. */
  backLabel?: string;
  onBackPress?: () => void;
  testID?: string;
}

export function TopHeader({
  interestName,
  interestAccentColor,
  onInterestPress,
  stepCounter,
  rightCluster,
  backLabel,
  onBackPress,
  testID,
}: TopHeaderProps) {
  const showBack = typeof backLabel === 'string' && backLabel.length > 0;

  return (
    <View style={styles.header} testID={testID}>
      <View style={styles.leftSlot}>
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Back to ${backLabel}`}
            onPress={onBackPress}
            hitSlop={8}
            style={styles.backButton}
          >
            <ChevronLeft size={18} color={IOS_BLUE} />
            <Text style={styles.backLabel} numberOfLines={1}>
              {backLabel}
            </Text>
          </Pressable>
        ) : interestName ? (
          <Pressable
            accessibilityRole={onInterestPress ? 'button' : 'text'}
            accessibilityLabel={
              onInterestPress
                ? `Current interest: ${interestName}. Tap to switch.`
                : `Active interest: ${interestName}`
            }
            onPress={onInterestPress}
            disabled={!onInterestPress}
            hitSlop={6}
            style={styles.interest}
          >
            <View
              style={[
                styles.interestDot,
                { backgroundColor: interestAccentColor ?? IOS_BLUE },
              ]}
            />
            <Text style={styles.interestName} numberOfLines={1}>
              {interestName}
            </Text>
            {onInterestPress ? (
              <ChevronDown size={12} color={LABEL_3} style={styles.switcherIcon} />
            ) : null}
          </Pressable>
        ) : (
          <View />
        )}
      </View>

      <View style={styles.centerSlot}>
        {stepCounter ? (
          <Text style={styles.stepCounter} numberOfLines={1}>
            {stepCounter}
          </Text>
        ) : null}
      </View>

      <View style={styles.rightSlot}>
        {rightCluster ? (
          <View style={styles.rightCluster}>{rightCluster}</View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 10,
    ...Platform.select({
      web: { width: '100%' as any },
      default: {},
    }),
  },
  leftSlot: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  centerSlot: {
    flexShrink: 0,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  rightSlot: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  interest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    minHeight: 30,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 15,
    backgroundColor: IOS_BLUE_TINT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GRAY_5,
  },
  interestDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  interestName: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    color: LABEL_2,
  },
  switcherIcon: {
    marginLeft: -1,
    alignSelf: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 2,
  },
  backLabel: {
    fontSize: 15,
    color: IOS_BLUE,
    letterSpacing: -0.2,
    marginLeft: -2,
  },
  stepCounter: {
    fontSize: 13,
    fontWeight: '500',
    color: LABEL_3,
    letterSpacing: -0.05,
    fontVariant: ['tabular-nums'],
  },
  rightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
