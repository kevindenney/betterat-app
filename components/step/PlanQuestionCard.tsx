/**
 * PlanQuestionCard — card for each planning question.
 * Always shows content (not collapsible).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS as _IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { STEP_COLORS as _STEP_COLORS, STEP_PALETTE } from '@/lib/step-theme';
import { text } from '@/lib/design-tokens-editorial';

interface PlanQuestionCardProps {
  icon: string;
  title: string;
  /** Whether this question has been answered */
  isComplete?: boolean;
  /** @deprecated No longer used — kept for call-site compat */
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

export function PlanQuestionCard({
  icon,
  title,
  isComplete = false,
  children,
}: PlanQuestionCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconCircle, isComplete && styles.iconCircleComplete]}>
            <Ionicons
              name={isComplete ? 'checkmark' : (icon as any)}
              size={16}
              color={isComplete ? STEP_PALETTE.ctaText : STEP_PALETTE.textSecondary}
            />
          </View>
          <Text style={[styles.title, isComplete && styles.titleComplete]}>{title}</Text>
        </View>
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: STEP_PALETTE.bgPrimary,
    borderRadius: 12,
    marginBottom: IOS_SPACING.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: STEP_PALETTE.borderTertiary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: IOS_SPACING.md,
    paddingBottom: 0,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
    flex: 1,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: STEP_PALETTE.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleComplete: {
    backgroundColor: STEP_PALETTE.ctaBg,
  },
  title: {
    ...text.sansEyebrow,
    // ALL-CAPS restored per iOS register decision #4 (reverses 0fcf2264).
    // The sansEyebrow recipe already includes textTransform: 'uppercase'.
    color: STEP_PALETTE.textTertiary,
    flex: 1,
  },
  titleComplete: {
    color: STEP_PALETTE.textSecondary,
  },
  content: {
    paddingHorizontal: IOS_SPACING.md,
    paddingBottom: IOS_SPACING.md,
    paddingTop: IOS_SPACING.sm,
  },
});
