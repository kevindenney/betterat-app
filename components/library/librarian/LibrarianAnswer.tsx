/**
 * <LibrarianAnswer> — full-screen view for an asked librarian question.
 *
 * Reads top-down:
 *   1. The question, in the librarian's italic-serif voice
 *   2. "The librarian's reading of your corpus" — synthesis card
 *   3. "What the librarian read" — the actual cited rows
 *   4. Footer offer to turn the synthesis into a forming concept
 *
 * Every claim in the synthesis is backed by a row below. If the corpus
 * is empty for a question, the librarian says so — never invents.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import {
  LIBRARIAN_PURPLE,
  LIBRARIAN_PURPLE_INK,
  LIBRARIAN_PURPLE_TINT_08,
  LIBRARIAN_PURPLE_TINT_18,
  LIBRARIAN_SERIF,
} from './librarianTokens';
import {
  LibrarianCitedRow,
  type LibrarianCitation,
} from './LibrarianCitedRow';

export interface LibrarianAnswerData {
  question: string;
  /** Words within `question` to highlight purple-italic. */
  questionEmphasise?: string[];
  /** Body paragraphs of the synthesis. Each gets italic-serif treatment. */
  synthesis: string[];
  /** Italic phrases inside synthesis that should be purple-highlighted. */
  synthesisEmphasise?: string[];
  /** Footnote shown under the synthesis (e.g. "drafted from 3 reflections · 1 concept · 1 saved resource · synthesized just now"). */
  draftedFrom: string;
  /** Cited corpus rows below the synthesis, in display order. */
  citations: LibrarianCitation[];
  /** When supplied, footer offers to mint a forming concept from the synthesis. */
  onPromoteToConcept?: () => void;
}

interface Props {
  answer: LibrarianAnswerData;
}

export function LibrarianAnswer({ answer }: Props) {
  const {
    question,
    questionEmphasise = [],
    synthesis,
    synthesisEmphasise = [],
    draftedFrom,
    citations,
    onPromoteToConcept,
  } = answer;

  return (
    <View style={styles.wrap}>
      <View style={styles.questionBlock}>
        <View style={styles.eyebrowRow}>
          <Ionicons name="book" size={12} color={LIBRARIAN_PURPLE_INK} />
          <Text style={styles.eyebrow}>You asked the librarian</Text>
        </View>
        <Text style={styles.question}>
          &ldquo;{renderWithEmphasis(question, questionEmphasise)}&rdquo;
        </Text>
      </View>

      <View style={styles.synthesisCard}>
        <View style={styles.synthEyebrowRow}>
          <View style={styles.synthDot} />
          <Text style={styles.synthEyebrow}>
            The librarian&apos;s reading of your corpus
          </Text>
        </View>
        {synthesis.map((paragraph, idx) => (
          <Text key={idx} style={styles.synthesisBody}>
            {renderWithEmphasis(paragraph, synthesisEmphasise)}
          </Text>
        ))}
        <Text style={styles.draftedFrom}>{draftedFrom}</Text>
      </View>

      <View style={styles.readBlock}>
        <View style={styles.readEyebrowRow}>
          <Ionicons
            name="bookmark"
            size={12}
            color="rgba(60,60,67,0.6)"
          />
          <Text style={styles.readEyebrow}>What the librarian read</Text>
        </View>
        {citations.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nothing in the corpus yet.</Text>
            <Text style={styles.emptyBody}>
              The librarian can only read what you&apos;ve captured. Try a different
              question, or save something to come back to.
            </Text>
          </View>
        ) : (
          <View style={styles.citeList}>
            {citations.map((c) => (
              <LibrarianCitedRow key={c.id} citation={c} />
            ))}
          </View>
        )}
      </View>

      {onPromoteToConcept && citations.length > 0 ? (
        <Pressable
          onPress={onPromoteToConcept}
          accessibilityRole="button"
          accessibilityLabel="Turn synthesis into a forming concept"
          style={({ pressed }) => [
            styles.promoteBtn,
            pressed && styles.btnPressed,
          ]}
        >
          <Ionicons name="bulb-outline" size={16} color="#FFFFFF" />
          <Text style={styles.promoteBtnText}>
            Turn this into a forming concept
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function renderWithEmphasis(body: string, emphasise: string[]) {
  if (emphasise.length === 0) return body;
  const escaped = emphasise.map((s) =>
    s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  );
  const re = new RegExp(`(${escaped.join('|')})`, 'g');
  const parts = body.split(re);
  return parts.map((part, i) =>
    emphasise.includes(part) ? (
      <Text key={i} style={emphStyle}>
        {part}
      </Text>
    ) : (
      <Text key={i}>{part}</Text>
    ),
  );
}

const emphStyle = {
  color: LIBRARIAN_PURPLE_INK,
};

const styles = StyleSheet.create({
  wrap: {
    gap: 18,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  questionBlock: {
    gap: 8,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: LIBRARIAN_PURPLE_INK,
  },
  question: {
    fontSize: 22,
    lineHeight: 30,
    fontFamily: LIBRARIAN_SERIF,
    fontStyle: 'italic',
    color: IOS_COLORS.label,
  },
  synthesisCard: {
    backgroundColor: LIBRARIAN_PURPLE_TINT_08,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LIBRARIAN_PURPLE_TINT_18,
    padding: 16,
    gap: 10,
  },
  synthEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  synthDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: LIBRARIAN_PURPLE,
  },
  synthEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: LIBRARIAN_PURPLE_INK,
  },
  synthesisBody: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: LIBRARIAN_SERIF,
    fontStyle: 'italic',
    color: IOS_COLORS.label,
  },
  draftedFrom: {
    marginTop: 4,
    fontSize: 11.5,
    color: 'rgba(60,60,67,0.6)',
    fontStyle: 'italic',
  },
  readBlock: {
    gap: 8,
  },
  readEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  readEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: 'rgba(60,60,67,0.6)',
  },
  citeList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.15)',
    overflow: 'hidden',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.15)',
    padding: 16,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(60,60,67,0.65)',
  },
  promoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: LIBRARIAN_PURPLE,
    paddingVertical: 14,
    borderRadius: 14,
  },
  promoteBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  btnPressed: {
    opacity: 0.7,
  },
});
