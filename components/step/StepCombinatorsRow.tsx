/**
 * StepCombinatorsRow — context pill row under the IdentityDeck title.
 *
 * Canonical Screen 01 / Identity Deck 05C+ shows a single cross-interest
 * pill ("⇄ Also relevant for Match racing") below the peer-avatar line
 * — and nothing else. Blueprint provenance and peer count are already
 * carried as text lines inside the IdentityDeck itself ("from your
 * active blueprint X by Y" and "N peers working this step"), so this
 * row deliberately does NOT re-surface them as chips. Duplicating those
 * was the gap-B finding in the v3 alignment pass.
 *
 * What this row renders:
 *   [⇄ Also relevant for <OtherInterest>]   [🔗 N related]
 *
 * - Cross-interest — first AI-generated cross-interest suggestion's
 *   source interest, when the user has more than one interest and
 *   the AI has produced suggestions for this step. Tap → routes to
 *   that interest's timeline.
 * - Related — viewer's own steps that share blueprint or category
 *   with this one (distinct from peers, who are *other* users).
 *
 * The row hides itself when neither slot has data.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { useCrossInterestSuggestions } from '@/hooks/useCrossInterestSuggestions';
import { useInterest } from '@/providers/InterestProvider';
import { getAtlasStepData, isAtlasRaceCourseStep } from '@/lib/atlasRaceStep';
import { useStepPeerReflections } from '@/hooks/useStepPeerReflections';
import { useStepLibraryBefore } from '@/hooks/useStepLibraryBefore';
import { StepCombinatorsSheet } from './StepCombinatorsSheet';
import type { TimelineStepRecord } from '@/types/timeline-steps';
import { showAlertWithButtons } from '@/lib/utils/crossPlatformAlert';

interface StepCombinatorsRowProps {
  step: TimelineStepRecord;
  /**
   * Kept on the prop signature for back-compat with callers that still
   * pass them, but unused now — the IdentityDeck above us renders
   * blueprint provenance as a text line so we don't duplicate it here.
   */
  blueprintTitle?: string | null;
  blueprintAuthorName?: string | null;
  /** Viewer's own timeline steps — used to count related entries. */
  viewerSteps: TimelineStepRecord[];
  /**
   * Called when the "N peers" chip is tapped. Typically routes the
   * parent to the Discuss tab where peer_reflections render in full.
   * When omitted the chip stays informational (no tap target).
   */
  onShowPeers?: () => void;
  /**
   * Called when the "N playbook" chip is tapped. Typically routes the
   * parent to the Plan tab where the step_library_before list lives.
   */
  onShowPlaybook?: () => void;
}

export function StepCombinatorsRow({
  step,
  viewerSteps,
  onShowPeers,
  onShowPlaybook,
}: StepCombinatorsRowProps) {
  const { suggestions } = useCrossInterestSuggestions(
    step.id,
    step.interest_id ?? undefined,
  );
  const { switchInterest } = useInterest();
  const atlasData = getAtlasStepData(step.metadata);
  const suppressCrossInterest =
    isAtlasRaceCourseStep(step.metadata) ||
    Boolean(atlasData?.origin) ||
    atlasData?.interest_slug === 'sail-racing' ||
    step.category === 'sailing';
  const crossInterest = suppressCrossInterest ? null : suggestions[0] ?? null;

  const relatedSteps = useMemo(() => {
    const stepMetadata = (step.metadata ?? {}) as {
      plan?: { capability_goals?: string[]; competency_ids?: string[] };
    };
    const stepGoals = new Set(
      (stepMetadata.plan?.capability_goals ?? [])
        .map((g) => g.trim().toLowerCase())
        .filter(Boolean),
    );
    const stepCompetencies = new Set(stepMetadata.plan?.competency_ids ?? []);

    return viewerSteps
      .filter((s) => s.id !== step.id)
      .map((s) => {
        const reasons: string[] = [];
        if (step.source_blueprint_id != null && s.source_blueprint_id === step.source_blueprint_id) {
          reasons.push('same blueprint');
        }
        if (Boolean(step.category) && s.category === step.category) {
          reasons.push(`same category: ${step.category}`);
        }
        const otherMetadata = (s.metadata ?? {}) as {
          plan?: { capability_goals?: string[]; competency_ids?: string[] };
        };
        const sharedGoal = (otherMetadata.plan?.capability_goals ?? [])
          .map((g) => g.trim())
          .find((g) => stepGoals.has(g.toLowerCase()));
        if (sharedGoal) reasons.push(`shared capability: ${sharedGoal}`);
        const sharedCompetency = (otherMetadata.plan?.competency_ids ?? [])
          .find((id) => stepCompetencies.has(id));
        if (sharedCompetency) reasons.push('shared competency');
        return { step: s, reasons };
      })
      .filter((item) => item.reasons.length > 0);
  }, [viewerSteps, step]);
  const relatedCount = relatedSteps.length;

  // Typed breakdown of "what's like this step?" — the previous bare
  // "N related" count combined three different mental categories into
  // a meaningless number. Split into yours / peers / playbook so the
  // user can predict what they'll find before tapping.
  const peerReflectionStepIds = useMemo(() => [step.id], [step.id]);
  const { data: peerReflectionsMap } = useStepPeerReflections(peerReflectionStepIds);
  const peersCount = peerReflectionsMap?.get(step.id)?.length ?? 0;
  const { data: libraryBefore } = useStepLibraryBefore(step.id);
  const playbookCount = libraryBefore?.length ?? 0;

  const [sheet, setSheet] = useState<null | 'related'>(null);

  const hasCross = Boolean(crossInterest);
  const hasRelated = relatedCount > 0;
  const hasPeers = peersCount > 0;
  const hasPlaybook = playbookCount > 0;

  if (!hasCross && !hasRelated && !hasPeers && !hasPlaybook) return null;

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {hasCross && crossInterest ? (
          <Pressable
            style={styles.crossPill}
            onPress={async () => {
              showAlertWithButtons(
                `Relevant for ${crossInterest.sourceInterestName}`,
                [crossInterest.relevance, crossInterest.suggestion].filter(Boolean).join('\n\n'),
                [
                  {
                    text: `Open ${crossInterest.sourceInterestName}`,
                    onPress: async () => {
                      await switchInterest(crossInterest.sourceInterestSlug);
                      router.replace('/(tabs)/practice' as never);
                    },
                  },
                  { text: 'Cancel', style: 'cancel' },
                ],
              );
            }}
          >
            <Ionicons
              name="swap-horizontal-outline"
              size={12}
              color={IOS_REGISTER.labelSecondary}
            />
            <Text style={styles.pillText} numberOfLines={1}>
              <Text style={styles.pillDim}>Also relevant for </Text>
              <Text style={styles.pillCrossEmphasis}>
                {crossInterest.sourceInterestName}
              </Text>
            </Text>
          </Pressable>
        ) : null}

        {hasPeers ? (
          onShowPeers ? (
            <Pressable style={styles.pill} onPress={onShowPeers}>
              <Ionicons
                name="people-outline"
                size={12}
                color={IOS_REGISTER.labelSecondary}
              />
              <Text style={styles.pillText}>
                <Text style={styles.pillBold}>{peersCount}</Text>
                <Text style={styles.pillDim}> peers</Text>
              </Text>
            </Pressable>
          ) : (
            <View style={styles.pill}>
              <Ionicons
                name="people-outline"
                size={12}
                color={IOS_REGISTER.labelSecondary}
              />
              <Text style={styles.pillText}>
                <Text style={styles.pillBold}>{peersCount}</Text>
                <Text style={styles.pillDim}> peers</Text>
              </Text>
            </View>
          )
        ) : null}

        {hasRelated ? (
          <Pressable style={styles.pill} onPress={() => setSheet('related')}>
            <Ionicons
              name="link-outline"
              size={12}
              color={IOS_REGISTER.labelSecondary}
            />
            <Text style={styles.pillText}>
              <Text style={styles.pillBold}>{relatedCount}</Text>
              <Text style={styles.pillDim}> yours</Text>
            </Text>
          </Pressable>
        ) : null}

        {hasPlaybook ? (
          onShowPlaybook ? (
            <Pressable style={styles.pill} onPress={onShowPlaybook}>
              <Ionicons
                name="bookmark-outline"
                size={12}
                color={IOS_REGISTER.labelSecondary}
              />
              <Text style={styles.pillText}>
                <Text style={styles.pillBold}>{playbookCount}</Text>
                <Text style={styles.pillDim}> playbook</Text>
              </Text>
            </Pressable>
          ) : (
            <View style={styles.pill}>
              <Ionicons
                name="bookmark-outline"
                size={12}
                color={IOS_REGISTER.labelSecondary}
              />
              <Text style={styles.pillText}>
                <Text style={styles.pillBold}>{playbookCount}</Text>
                <Text style={styles.pillDim}> playbook</Text>
              </Text>
            </View>
          )
        ) : null}
      </ScrollView>

      {sheet === 'related' ? (
        <StepCombinatorsSheet
          visible
          mode="related"
          relatedSteps={relatedSteps}
          onDismiss={() => setSheet(null)}
        />
      ) : null}
    </View>
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
  crossPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    // Faint lilac wash + lilac border — canonical Screen 01 treatment
    // that ties the cross-interest pill visually to the lilac peer
    // reflection deck above (both are "synthesis" grammar).
    backgroundColor: 'rgba(175, 82, 222, 0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(175, 82, 222, 0.30)',
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
  pillCrossEmphasis: {
    color: '#7B3FB0',
    fontWeight: '600',
  },
});
