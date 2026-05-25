/**
 * <IdentityDeck> — v3 step-cover identity block.
 *
 * "The identity deck is the surface that carries who's with you. Title,
 * blueprint, peers, state, cross-interest — all above the phase tabs."
 *   — docs/redesign/v3 · screen 01
 *
 * Renders inside <StepCard>'s `titleBlock` slot when STEP_IDENTITY_DECK_V3
 * is on. The state pill at the top of <StepCard>'s state head stays for
 * v1 (we keep the existing chrome continuity); the deck's stateBadge below
 * is a secondary affordance carrying the more-readable phase grammar.
 */

import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import {
  GRAY_5,
  IOS_CORAL,
  IOS_GREEN,
  IOS_GREEN_TINT,
  IOS_CORAL_TINT,
  LABEL,
  LABEL_2,
  LABEL_3,
} from '@/lib/design-tokens-step-loop-ios';

const SERIF_FAMILY = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  web: 'Georgia, "Times New Roman", serif',
  default: 'Georgia',
}) as string;

export type IdentityDeckStateVariant = 'live' | 'planned' | 'complete';

export interface IdentityDeckProps {
  /** Required step title rendered large and serif. */
  title: string;
  /** Eyebrow above the title — e.g. "SUB-STEP 3 OF 5" or "STEP 4 OF 12". */
  counter?: string;
  /** Phase grammar pill rendered top-right of the deck. */
  stateLabel?: string;
  stateVariant?: IdentityDeckStateVariant;
  /** Blueprint provenance: "from your active blueprint <title> by <author>". */
  blueprintTitle?: string | null;
  blueprintAuthorName?: string | null;
  /** Number of peers also working this step. Null/zero hides the row. */
  peersCount?: number | null;
  /** Singular label for one peer (e.g. "sailor", "cohort member"). */
  peersLabel?: string;
  /**
   * Optional avatar stack rendered to the left of the peer count line.
   * Caller passes up to ~6 entries; we display the first 4 + "+N" for
   * overflow. Matches canonical Screen 07 "MK EW JD CL +3 · 7 sailors
   * working this step" pattern.
   */
  peerAvatars?: { id: string; initials: string; color: string }[];
  /** Pre-rendered cross-interest chip slot (e.g. StepCombinatorsRow output). */
  crossInterestSlot?: React.ReactNode;
  testID?: string;
}

const stateColors: Record<IdentityDeckStateVariant, { bg: string; fg: string; dot: string }> = {
  live: { bg: IOS_CORAL_TINT, fg: IOS_CORAL, dot: IOS_CORAL },
  planned: { bg: '#F2F2F7', fg: LABEL_2, dot: '#C7C7CC' },
  complete: { bg: IOS_GREEN_TINT, fg: '#1F7A3A', dot: IOS_GREEN },
};

export function IdentityDeck({
  title,
  counter,
  stateLabel,
  stateVariant = 'planned',
  blueprintTitle,
  blueprintAuthorName,
  peersCount,
  peersLabel = 'people',
  peerAvatars,
  crossInterestSlot,
  testID,
}: IdentityDeckProps) {
  const showState = Boolean(stateLabel);
  const stateColor = stateColors[stateVariant];
  const showPeers = peersCount != null && peersCount > 0;
  const showBlueprint = Boolean(blueprintTitle);

  return (
    <View style={styles.root} testID={testID}>
      {(counter || showState) && (
        <View style={styles.topRow}>
          {counter ? <Text style={styles.counter}>{counter}</Text> : <View />}
          {showState ? (
            <View style={[styles.statePill, { backgroundColor: stateColor.bg }]}>
              <View style={[styles.stateDot, { backgroundColor: stateColor.dot }]} />
              <Text style={[styles.stateText, { color: stateColor.fg }]}>{stateLabel}</Text>
            </View>
          ) : null}
        </View>
      )}

      <Text style={styles.title}>{title}</Text>

      {showBlueprint ? (
        <Text style={styles.blueprintLine}>
          from your active blueprint{' '}
          <Text style={styles.blueprintTitle}>{blueprintTitle}</Text>
          {blueprintAuthorName ? (
            <>
              {' '}by <Text style={styles.blueprintAuthor}>{blueprintAuthorName}</Text>
            </>
          ) : null}
        </Text>
      ) : null}

      {showPeers ? (
        <View style={styles.peersRow}>
          {peerAvatars && peerAvatars.length > 0 ? (
            <View style={styles.avatarStack}>
              {peerAvatars.slice(0, 4).map((a, idx) => (
                <View
                  key={a.id}
                  style={[
                    styles.avatarChip,
                    { backgroundColor: a.color },
                    idx > 0 && styles.avatarChipOverlap,
                  ]}
                >
                  <Text style={styles.avatarChipText}>{a.initials}</Text>
                </View>
              ))}
              {peerAvatars.length > 4 ? (
                <View
                  style={[
                    styles.avatarChip,
                    styles.avatarChipOverlap,
                    styles.avatarChipOverflow,
                  ]}
                >
                  <Text style={styles.avatarChipOverflowText}>
                    +{peerAvatars.length - 4}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
          <Text style={styles.peersText}>
            <Text style={styles.peersCount}>{peersCount} </Text>
            {peersCount === 1 ? peersLabel : pluralize(peersLabel)} working this step
          </Text>
        </View>
      ) : null}

      {crossInterestSlot ? (
        <View style={styles.crossInterestSlot}>{crossInterestSlot}</View>
      ) : null}
    </View>
  );
}

function pluralize(word: string): string {
  if (!word) return word;
  if (word.endsWith('s')) return word;
  return `${word}s`;
}

const styles = StyleSheet.create({
  root: {
    paddingTop: 2,
    paddingBottom: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  counter: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: LABEL_3,
    textTransform: 'uppercase',
  },
  statePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  stateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stateText: {
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: -0.05,
  },
  title: {
    fontFamily: SERIF_FAMILY,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '400',
    letterSpacing: -0.4,
    color: LABEL,
  },
  blueprintLine: {
    fontSize: 13.5,
    color: LABEL_3,
    marginTop: 8,
    lineHeight: 18,
  },
  blueprintTitle: {
    fontStyle: 'italic',
    color: LABEL_2,
  },
  blueprintAuthor: {
    color: '#007AFF',
  },
  peersRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GRAY_5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarChip: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  avatarChipOverlap: {
    marginLeft: -6,
  },
  avatarChipText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  avatarChipOverflow: {
    backgroundColor: GRAY_5,
  },
  avatarChipOverflowText: {
    color: LABEL_2,
    fontSize: 9.5,
    fontWeight: '700',
  },
  peersText: {
    fontSize: 13,
    color: LABEL_2,
  },
  peersCount: {
    fontWeight: '700',
    color: LABEL,
  },
  crossInterestSlot: {
    marginTop: 8,
  },
});
