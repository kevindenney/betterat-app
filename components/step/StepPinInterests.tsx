/**
 * StepPinInterests — Toggle to pin a step onto other interest timelines.
 * Pinned steps appear as private references on the target interest's timeline.
 */

import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { STEP_COLORS } from '@/lib/step-theme';
import { IOS_SPACING } from '@/lib/design-tokens-ios';
import { useInterest } from '@/providers/InterestProvider';
import { useStepPinInterestIds, usePinStep, useUnpinStep } from '@/hooks/useTimelineSteps';

interface StepPinInterestsProps {
  stepId: string;
  stepInterestId: string;
  /** Open the interest list immediately when hosted inside a sheet/menu. */
  initialExpanded?: boolean;
}

export function StepPinInterests({ stepId, stepInterestId, initialExpanded = false }: StepPinInterestsProps) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const { userInterests } = useInterest();
  const { data: pinnedIds, isLoading } = useStepPinInterestIds(stepId);
  const pinMutation = usePinStep();
  const unpinMutation = useUnpinStep();

  // Filter out the step's own interest — can only pin to OTHER interests
  const otherInterests = userInterests.filter((i) => i.id !== stepInterestId);

  if (otherInterests.length === 0) return null;

  const pinnedSet = new Set(pinnedIds ?? []);

  const handleToggle = (interestId: string) => {
    if (pinnedSet.has(interestId)) {
      unpinMutation.mutate({ stepId, interestId });
    } else {
      pinMutation.mutate({ stepId, interestId });
    }
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.toggleRow} onPress={() => setExpanded((p) => !p)}>
        <Ionicons name="pin-outline" size={14} color={STEP_COLORS.secondaryLabel} />
        <Text style={styles.label}>
          Pin to other interests
          {pinnedSet.size > 0 && ` (${pinnedSet.size})`}
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={STEP_COLORS.tertiaryLabel}
        />
      </Pressable>
      {expanded && (
        <View style={styles.list}>
          {isLoading ? (
            <ActivityIndicator size="small" color={STEP_COLORS.accent} />
          ) : (
            otherInterests.map((interest) => {
              const isPinned = pinnedSet.has(interest.id);
              const isBusy =
                (pinMutation.isPending && pinMutation.variables?.interestId === interest.id) ||
                (unpinMutation.isPending && unpinMutation.variables?.interestId === interest.id);
              return (
                <Pressable
                  key={interest.id}
                  style={styles.interestRow}
                  onPress={() => handleToggle(interest.id)}
                  disabled={isBusy}
                >
                  <View style={[styles.dot, { backgroundColor: interest.accent_color }]} />
                  <Text style={styles.interestName}>{interest.name}</Text>
                  {isBusy ? (
                    <ActivityIndicator size="small" color={STEP_COLORS.accent} style={styles.checkIcon} />
                  ) : (
                    <Ionicons
                      name={isPinned ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={isPinned ? STEP_COLORS.accent : STEP_COLORS.tertiaryLabel}
                      style={styles.checkIcon}
                    />
                  )}
                </Pressable>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: IOS_SPACING.xs,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: STEP_COLORS.secondaryLabel,
    flex: 1,
  },
  list: {
    marginTop: IOS_SPACING.xs,
    gap: 2,
  },
  interestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  interestName: {
    fontSize: 14,
    fontWeight: '500',
    color: STEP_COLORS.label,
    flex: 1,
  },
  checkIcon: {
    marginLeft: 'auto',
  },
});
