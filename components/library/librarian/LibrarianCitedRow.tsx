/**
 * <LibrarianCitedRow> — a single cited corpus row in a librarian answer.
 *
 * Each row carries the actual quote text, dated and sourced, so the
 * synthesis above can be verified line-by-line. The librarian never
 * paraphrases what's inside these rows — they are the raw evidence.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import {
  LIBRARIAN_PURPLE_INK,
  LIBRARIAN_PURPLE_TINT_18,
  LIBRARIAN_SERIF,
} from './librarianTokens';

export type CitedKind = 'concept' | 'reflection' | 'debrief' | 'resource' | 'step';

export interface LibrarianCitation {
  id: string;
  kind: CitedKind;
  /** State badge for concept rows (e.g. FORMING). Ignored for other kinds. */
  state?: 'forming' | 'forming-with-tension' | 'testing' | 'settled';
  /** Right-aligned context label — e.g. "Race 8 · Jan 30" or "started Apr 22". */
  contextLabel: string;
  /** Italic title or claim — concept name or reflection headline. */
  headline: string;
  /** Italic body quote pulled from the corpus row. */
  quote?: string;
  /** Foot label: the source — coaching session, after-race debrief, etc. */
  sourceLabel: string;
  onPress?: () => void;
}

interface Props {
  citation: LibrarianCitation;
}

export function LibrarianCitedRow({ citation }: Props) {
  const {
    kind,
    state,
    contextLabel,
    headline,
    quote,
    sourceLabel,
    onPress,
  } = citation;

  const KindIcon = iconForKind(kind);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${kindLabel(kind)} citation: ${headline}`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.headRow}>
        <View style={styles.kindRow}>
          <Ionicons name={KindIcon} size={12} color={LIBRARIAN_PURPLE_INK} />
          <Text style={styles.kindLabel}>{kindLabel(kind)}</Text>
          {state ? (
            <View style={styles.statePill}>
              <Text style={styles.statePillText}>{stateLabel(state)}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.contextLabel}>{contextLabel}</Text>
      </View>

      <Text style={styles.headline}>&ldquo;{headline}&rdquo;</Text>
      {quote ? (
        <Text style={styles.quote}>&ldquo;{quote}&rdquo;</Text>
      ) : null}
      <Text style={styles.source}>{sourceLabel}</Text>
    </Pressable>
  );
}

function iconForKind(kind: CitedKind) {
  switch (kind) {
    case 'concept':
      return 'bulb-outline' as const;
    case 'reflection':
      return 'chatbubble-ellipses-outline' as const;
    case 'debrief':
      return 'clipboard-outline' as const;
    case 'resource':
      return 'bookmark-outline' as const;
    case 'step':
      return 'flag-outline' as const;
  }
}

function kindLabel(kind: CitedKind) {
  switch (kind) {
    case 'concept':
      return 'CONCEPT';
    case 'reflection':
      return 'REFLECTION';
    case 'debrief':
      return 'DEBRIEF';
    case 'resource':
      return 'RESOURCE';
    case 'step':
      return 'STEP';
  }
}

function stateLabel(state: NonNullable<LibrarianCitation['state']>) {
  switch (state) {
    case 'forming':
      return 'FORMING';
    case 'forming-with-tension':
      return 'FORMING ⚠';
    case 'testing':
      return 'TESTING';
    case 'settled':
      return 'SETTLED';
  }
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.12)',
    gap: 5,
  },
  rowPressed: {
    backgroundColor: 'rgba(120,120,128,0.06)',
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  kindRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  kindLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
    color: LIBRARIAN_PURPLE_INK,
  },
  statePill: {
    marginLeft: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: LIBRARIAN_PURPLE_TINT_18,
  },
  statePillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: LIBRARIAN_PURPLE_INK,
  },
  contextLabel: {
    fontSize: 11,
    color: 'rgba(60,60,67,0.6)',
  },
  headline: {
    fontSize: 14.5,
    lineHeight: 20,
    fontFamily: LIBRARIAN_SERIF,
    fontStyle: 'italic',
    color: IOS_COLORS.label,
  },
  quote: {
    fontSize: 13.5,
    lineHeight: 19,
    fontFamily: LIBRARIAN_SERIF,
    fontStyle: 'italic',
    color: 'rgba(60,60,67,0.85)',
  },
  source: {
    marginTop: 2,
    fontSize: 11.5,
    color: 'rgba(60,60,67,0.6)',
  },
});
