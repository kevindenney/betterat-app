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
import { StepCombinatorsSheet } from './StepCombinatorsSheet';
import type { TimelineStepRecord } from '@/types/timeline-steps';

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
}

export function StepCombinatorsRow({
  step,
  viewerSteps,
}: StepCombinatorsRowProps) {
  const { suggestions } = useCrossInterestSuggestions(
    step.id,
    step.interest_id ?? undefined,
  );
  const crossInterest = suggestions[0] ?? null;

  const relatedSteps = useMemo(() => {
    return viewerSteps.filter(
      (s) =>
        s.id !== step.id &&
        ((step.source_blueprint_id != null &&
          s.source_blueprint_id === step.source_blueprint_id) ||
          (Boolean(step.category) && s.category === step.category)),
    );
  }, [viewerSteps, step]);
  const relatedCount = relatedSteps.length;

  const [sheet, setSheet] = useState<null | 'related'>(null);

  const hasCross = Boolean(crossInterest);
  const hasRelated = relatedCount > 0;

  if (!hasCross && !hasRelated) return null;

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
            onPress={() => {
              router.push(
                `/(tabs)/practice?interest=${crossInterest.sourceInterestSlug}` as never,
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

        {hasRelated ? (
          <Pressable style={styles.pill} onPress={() => setSheet('related')}>
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
