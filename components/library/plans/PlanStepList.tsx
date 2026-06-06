/**
 * PlanStepList — vertical scannable list of plan steps for /library/plans/[id].
 *
 * Replaces the horizontal pager for plan detail viewing. The horizontal
 * timeline is still the right shape on the user's own Race surface where
 * "what's NOW" is the entire point, but for browsing someone else's
 * 12-step curriculum a vertical list is dramatically more scannable.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import type { PhaseProgress, StepCardH } from '@/components/timeline/types';

interface Props {
  steps: StepCardH[];
  /** Read-only browse mode → show a `+` icon button to adopt a single step. */
  showAdopt?: boolean;
  onPressStep?: (id: string) => void;
  onAdopt?: (id: string) => void;
}

const PHASE_LABELS = ['Plan', 'Do', 'Reflect'] as const;

export function PlanStepList({ steps, showAdopt = false, onPressStep, onAdopt }: Props) {
  if (steps.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>This plan doesn't have any steps yet.</Text>
      </View>
    );
  }

  const nowIndex = steps.findIndex((s) => s.state !== 'done');

  return (
    <View style={styles.list}>
      {steps.map((step, idx) => {
        const showNowDivider = idx === nowIndex && nowIndex > 0;
        return (
          <React.Fragment key={step.id}>
            {showNowDivider ? <NowDivider /> : null}
            <PlanStepRow
              step={step}
              showAdopt={showAdopt}
              onPress={() => onPressStep?.(step.id)}
              onAdopt={() => onAdopt?.(step.id)}
            />
          </React.Fragment>
        );
      })}
    </View>
  );
}

function NowDivider() {
  return (
    <View style={styles.nowDividerRow}>
      <View style={styles.nowDividerLine} />
      <Text style={styles.nowDividerText}>NOW</Text>
      <View style={styles.nowDividerLine} />
    </View>
  );
}

interface RowProps {
  step: StepCardH;
  showAdopt: boolean;
  onPress: () => void;
  onAdopt: () => void;
}

function PlanStepRow({ step, showAdopt, onPress, onAdopt }: RowProps) {
  const isDone = step.state === 'done';
  const isCurrent = step.state === 'current';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        isCurrent ? styles.rowCurrent : null,
        pressed ? styles.rowPressed : null,
      ]}
    >
      <StatusBadge state={step.state} stepNumber={step.stepNumber} />

      <View style={styles.body}>
        <Text
          style={[styles.title, isDone ? styles.titleDone : null]}
          numberOfLines={2}
        >
          {step.title}
        </Text>

        <View style={styles.metaRow}>
          {step.meta ? <Text style={styles.meta}>{step.meta}</Text> : null}
          {step.phaseDots ? (
            <PhaseProgressMini phases={step.phaseDots} done={isDone} />
          ) : null}
        </View>
      </View>

      {showAdopt && !isDone ? (
        <Pressable
          onPress={onAdopt}
          hitSlop={10}
          style={({ pressed }) => [
            styles.adoptBtn,
            pressed ? styles.adoptBtnPressed : null,
          ]}
          accessibilityLabel="Add this step to your timeline"
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
        </Pressable>
      ) : (
        <Ionicons
          name="chevron-forward"
          size={16}
          color={IOS_COLORS.tertiaryLabel}
        />
      )}
    </Pressable>
  );
}

function StatusBadge({
  state,
  stepNumber,
}: {
  state: StepCardH['state'];
  stepNumber: number;
}) {
  if (state === 'done') {
    return (
      <View style={[styles.badge, styles.badgeDone]}>
        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
      </View>
    );
  }
  if (state === 'current') {
    return (
      <View style={[styles.badge, styles.badgeCurrent]}>
        <Text style={styles.badgeCurrentText}>{stepNumber}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.badge, styles.badgeNext]}>
      <Text style={styles.badgeNextText}>{stepNumber}</Text>
    </View>
  );
}

function PhaseProgressMini({
  phases,
  done,
}: {
  phases: [PhaseProgress, PhaseProgress, PhaseProgress];
  done: boolean;
}) {
  return (
    <View style={styles.phaseRow}>
      {phases.map((p, i) => (
        <View key={i} style={styles.phaseCell}>
          <View
            style={[
              styles.phaseDot,
              p === 'empty' ? styles.phaseDotEmpty : null,
              p === 'half' ? styles.phaseDotHalf : null,
              p === 'full' ? styles.phaseDotFull : null,
              p === 'full' && done ? styles.phaseDotDone : null,
            ]}
          />
          <Text style={styles.phaseLabel}>{PHASE_LABELS[i]}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: IOS_SPACING.md,
    paddingTop: IOS_SPACING.sm,
    paddingBottom: IOS_SPACING.xxxl,
    gap: 8,
  },
  emptyWrap: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.md,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.12)',
  },
  rowCurrent: {
    borderColor: '#007AFF',
    borderWidth: 1.5,
    shadowColor: '#007AFF',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  rowPressed: {
    opacity: 0.6,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDone: {
    backgroundColor: IOS_COLORS.systemGreen,
  },
  badgeCurrent: {
    backgroundColor: '#007AFF',
  },
  badgeCurrentText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  badgeNext: {
    backgroundColor: IOS_COLORS.systemGray5,
  },
  badgeNextText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  titleDone: {
    color: IOS_COLORS.secondaryLabel,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: IOS_SPACING.sm,
  },
  meta: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phaseCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  phaseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  phaseDotEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: IOS_COLORS.tertiaryLabel,
  },
  phaseDotHalf: {
    backgroundColor: '#007AFF',
    opacity: 0.55,
  },
  phaseDotFull: {
    backgroundColor: IOS_COLORS.label,
  },
  phaseDotDone: {
    backgroundColor: IOS_COLORS.systemGreen,
  },
  phaseLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: IOS_COLORS.tertiaryLabel,
    letterSpacing: 0.2,
  },
  adoptBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adoptBtnPressed: {
    opacity: 0.7,
  },
  nowDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
    marginVertical: IOS_SPACING.xs,
    paddingHorizontal: 4,
  },
  nowDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#007AFF',
    opacity: 0.4,
  },
  nowDividerText: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    fontWeight: '500',
    color: '#007AFF',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
