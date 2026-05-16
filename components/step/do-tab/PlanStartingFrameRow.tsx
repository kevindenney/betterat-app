import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import type { StepPlanData } from '@/types/step-detail';

interface PlanStartingFrameRowProps {
  planData: StepPlanData;
  onPress?: () => void;
  disabled?: boolean;
}

export function hasPlanStartingFrameContent(planData: StepPlanData): boolean {
  if (planData.what_will_you_do?.trim()) return true;
  if (planData.why_reasoning?.trim()) return true;
  if (planData.how_sub_steps?.some((s) => s.text?.trim())) return true;
  return false;
}

export function PlanStartingFrameRow({
  planData,
  onPress,
  disabled,
}: PlanStartingFrameRowProps) {
  const hasContent = hasPlanStartingFrameContent(planData);
  const isDisabled = disabled || !hasContent;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        pressed && !isDisabled && styles.rowPressed,
        isDisabled && styles.rowDisabled,
      ]}
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel="Auto-summarize my Plan as a starting frame"
      accessibilityState={{ disabled: isDisabled }}
    >
      <View style={styles.glyph}>
        <Ionicons name="sparkles" size={14} color="#FFFFFF" />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>Auto-summarize my Plan as a starting frame</Text>
        <Text style={styles.sub}>
          Pull <Text style={styles.subEm}>What · How · Why</Text> into Do as opening context
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={IOS_COLORS.tertiaryLabel} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
    paddingVertical: IOS_SPACING.sm,
    paddingHorizontal: IOS_SPACING.md,
    borderRadius: 12,
    backgroundColor: IOS_COLORS.systemGray6,
    borderWidth: 1,
    borderColor: IOS_COLORS.systemGray5,
  },
  rowPressed: {
    opacity: 0.7,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  glyph: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: IOS_COLORS.systemBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  sub: {
    fontSize: 11,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  subEm: {
    fontStyle: 'italic',
    color: IOS_COLORS.label,
  },
});
