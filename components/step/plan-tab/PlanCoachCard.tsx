import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { STEP_COLORS } from '@/lib/step-theme';
import type { PlanInteriorState } from './planState';

interface PlanCoachCardProps {
  state: PlanInteriorState;
  onPress?: () => void;
  disabledReason?: string;
}

export function PlanCoachCard({ state, onPress, disabledReason }: PlanCoachCardProps) {
  const disabled = !onPress;

  if (state === 'locked') {
    return (
      <View style={styles.lockedSummary}>
        <Ionicons name="lock-closed-outline" size={15} color={IOS_COLORS.secondaryLabel} />
        <Text style={styles.lockedText}>Plan is locked for review.</Text>
      </View>
    );
  }

  if (state === 'empty') {
    return (
      <Pressable
        style={[styles.heroCard, disabled && styles.heroCardDisabled]}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
      >
        <View style={styles.heroIcon}>
          <Ionicons name="sparkles" size={22} color="#FFFFFF" />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.heroEyebrow}>Recommended first move</Text>
          <Text style={styles.heroTitle}>Build with AI Coach</Text>
          <Text style={styles.heroBody}>
            {disabledReason || 'Talk through what, how, and why. BetterAt will turn it into a usable plan.'}
          </Text>
        </View>
        <Ionicons
          name={disabled ? 'alert-circle-outline' : 'chevron-forward'}
          size={18}
          color={disabled ? IOS_COLORS.systemGray2 : IOS_COLORS.systemPurple}
        />
      </Pressable>
    );
  }

  return (
    <Pressable
      style={[styles.inlineLink, disabled && styles.inlineLinkDisabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Ionicons name="sparkles" size={14} color={IOS_COLORS.systemPurple} />
      <Text style={[styles.inlineLinkText, disabled && styles.inlineLinkTextDisabled]}>
        {disabledReason || 'Continue with AI Coach'}
      </Text>
      <Ionicons name="chevron-forward" size={12} color={IOS_COLORS.systemPurple} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
    backgroundColor: 'rgba(88, 86, 214, 0.09)',
    borderColor: 'rgba(88, 86, 214, 0.22)',
    borderWidth: 1,
    borderRadius: 18,
    padding: IOS_SPACING.md,
    marginBottom: IOS_SPACING.sm,
  },
  heroCardDisabled: {
    opacity: 0.62,
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_COLORS.systemPurple,
  },
  heroCopy: {
    flex: 1,
    gap: 2,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: IOS_COLORS.systemPurple,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: STEP_COLORS.label,
  },
  heroBody: {
    fontSize: 13,
    lineHeight: 18,
    color: IOS_COLORS.secondaryLabel,
  },
  inlineLink: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 2,
    marginBottom: IOS_SPACING.xs,
  },
  inlineLinkDisabled: {
    opacity: 0.6,
  },
  inlineLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: IOS_COLORS.systemPurple,
  },
  inlineLinkTextDisabled: {
    color: IOS_COLORS.secondaryLabel,
  },
  lockedSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 12,
    padding: IOS_SPACING.sm,
    marginBottom: IOS_SPACING.sm,
  },
  lockedText: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    fontWeight: '600',
  },
});
