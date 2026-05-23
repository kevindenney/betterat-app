/**
 * StepCombinatorsRow — Section H / Frames 21–23.
 *
 * Horizontal context row that sits above the Plan/Do/Reflect/Discuss
 * PhaseTabs in the L1 step view. Surfaces three relationships the
 * step has with the wider context:
 *
 *   [● From <Blueprint> · <Author>]  [👥 N peers]  [🔗 N related]
 *
 * - From — only renders when the step came from a subscribed
 *   blueprint. Tap → push to the blueprint detail.
 * - Peers — count of other subscribers on the same blueprint
 *   (uses useStepFellowSubscribers). Tap → toast for now; a
 *   peer-list sheet is a follow-up.
 * - Related — count of the viewer's OWN steps that share blueprint
 *   or category with this one. Tap → toast for now; routing to a
 *   filtered L4 view is a follow-up.
 *
 * The row hides itself entirely when none of the three slots has
 * data — keeps quiet on solo manual steps.
 */

import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { useStepFellowSubscribers } from '@/hooks/useStepFellowSubscribers';
import type { TimelineStepRecord } from '@/types/timeline-steps';

interface StepCombinatorsRowProps {
  step: TimelineStepRecord;
  blueprintTitle?: string | null;
  blueprintAuthorName?: string | null;
  /** Viewer's own timeline steps — used to count related entries. */
  viewerSteps: TimelineStepRecord[];
}

export function StepCombinatorsRow({
  step,
  blueprintTitle,
  blueprintAuthorName,
  viewerSteps,
}: StepCombinatorsRowProps) {
  const { data: peers } = useStepFellowSubscribers({
    blueprintId: step.source_blueprint_id ?? null,
  });
  const peerCount = peers?.totalPeers ?? 0;

  const relatedCount = useMemo(() => {
    return viewerSteps.filter(
      (s) =>
        s.id !== step.id &&
        ((step.source_blueprint_id != null &&
          s.source_blueprint_id === step.source_blueprint_id) ||
          (Boolean(step.category) && s.category === step.category)),
    ).length;
  }, [viewerSteps, step]);

  const hasFrom = Boolean(blueprintTitle);
  const hasPeers = peerCount > 0;
  const hasRelated = relatedCount > 0;

  if (!hasFrom && !hasPeers && !hasRelated) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {hasFrom ? (
        <Pressable
          style={styles.pill}
          onPress={() => {
            if (step.source_blueprint_id) {
              router.push(`/blueprint/${step.source_blueprint_id}` as never);
            }
          }}
        >
          <Ionicons
            name="git-network-outline"
            size={12}
            color={IOS_REGISTER.labelSecondary}
          />
          <Text style={styles.pillText} numberOfLines={1}>
            <Text style={styles.pillBold}>{blueprintTitle}</Text>
            {blueprintAuthorName ? (
              <Text style={styles.pillDim}>{`  ·  ${blueprintAuthorName}`}</Text>
            ) : null}
          </Text>
        </Pressable>
      ) : null}

      {hasPeers ? (
        <Pressable
          style={styles.pill}
          onPress={() =>
            showAlert(
              `${peerCount} ${peerCount === 1 ? 'peer is' : 'peers are'} on this blueprint`,
              'The peer list sheet ships in a follow-up. For now you can see the breakdown in the step-complete celebration.',
            )
          }
        >
          <Ionicons
            name="people-outline"
            size={12}
            color={IOS_REGISTER.labelSecondary}
          />
          <Text style={styles.pillText}>
            <Text style={styles.pillBold}>{peerCount}</Text>
            <Text style={styles.pillDim}>{peerCount === 1 ? ' peer' : ' peers'}</Text>
          </Text>
        </Pressable>
      ) : null}

      {hasRelated ? (
        <Pressable
          style={styles.pill}
          onPress={() =>
            showAlert(
              `${relatedCount} related ${relatedCount === 1 ? 'step' : 'steps'} in your timeline`,
              step.source_blueprint_id
                ? 'Other steps from the same blueprint, or sharing this step’s category. Filtering at L4 is a follow-up.'
                : 'Other steps in your timeline sharing this step’s category. Filtering at L4 is a follow-up.',
            )
          }
        >
          <Ionicons
            name="link-outline"
            size={12}
            color={IOS_REGISTER.labelSecondary}
          />
          <Text style={styles.pillText}>
            <Text style={styles.pillBold}>{relatedCount}</Text>
            <Text style={styles.pillDim}>
              {relatedCount === 1 ? ' related' : ' related'}
            </Text>
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
    gap: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: IOS_REGISTER.fillPill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    maxWidth: 280,
  },
  pillText: {
    fontSize: 12,
    letterSpacing: -0.1,
  },
  pillBold: {
    color: IOS_REGISTER.label,
    fontWeight: '600',
  },
  pillDim: {
    color: IOS_REGISTER.labelSecondary,
    fontWeight: '400',
  },
});
