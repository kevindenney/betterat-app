/**
 * <LibrarianNoticedCard> — unprompted observation embedded on the
 * Library landing. The librarian's "unasked" mode.
 *
 * Rare (≤ once a week), dismissable, always tied to a specific action —
 * promote / pin / add evidence — and always cites the corpus rows that
 * triggered it. No streaks, no nudges, no engagement tactics.
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

export interface LibrarianObservation {
  id: string;
  /** Sentence(s) the librarian wrote. Phrases meant to be emphasised
   *  should appear in `emphasise`. */
  body: string;
  /** Italic phrases lifted from `body` and highlighted purple. */
  emphasise?: string[];
  /** Cited concept anchor (the concept this observation is about). */
  concept: {
    title: string;
    state: 'forming' | 'forming-with-tension' | 'testing' | 'settled';
  };
  /** Cited reflection / debrief / resource the observation points to. */
  evidence: {
    label: string;
    date: string;
  };
  primaryAction: {
    label: string;
    onPress: () => void;
  };
  secondaryAction?: {
    label: string;
    onPress: () => void;
  };
  onDismiss: () => void;
  onOpenConcept?: () => void;
}

interface Props {
  observation: LibrarianObservation;
}

export function LibrarianNoticedCard({ observation }: Props) {
  const {
    body,
    emphasise = [],
    concept,
    evidence,
    primaryAction,
    secondaryAction,
    onDismiss,
    onOpenConcept,
  } = observation;

  return (
    <View
      style={styles.card}
      accessibilityRole="summary"
      accessibilityLabel={`The librarian noticed: ${body}`}
    >
      <View style={styles.head}>
        <View style={styles.eyebrowRow}>
          <Ionicons name="book" size={12} color={LIBRARIAN_PURPLE_INK} />
          <Text style={styles.eyebrow}>The librarian noticed</Text>
        </View>
        <Pressable
          onPress={onDismiss}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Dismiss observation"
        >
          <Ionicons name="close" size={16} color="rgba(60,60,67,0.6)" />
        </Pressable>
      </View>

      <Text style={styles.body}>
        {renderWithEmphasis(body, emphasise)}
      </Text>

      <Pressable
        onPress={onOpenConcept}
        disabled={!onOpenConcept}
        style={styles.citeBlock}
        accessibilityRole={onOpenConcept ? 'button' : undefined}
        accessibilityLabel={`Open concept ${concept.title}`}
      >
        <View style={styles.citeRow}>
          <Ionicons name="bulb-outline" size={13} color={LIBRARIAN_PURPLE_INK} />
          <Text style={styles.citeTitle} numberOfLines={1}>
            &ldquo;{concept.title}&rdquo;
          </Text>
          <View style={styles.statePill}>
            <Text style={styles.statePillText}>{stateLabel(concept.state)}</Text>
          </View>
        </View>
        <View style={styles.citeRow}>
          <Ionicons
            name="link-outline"
            size={12}
            color="rgba(60,60,67,0.6)"
          />
          <Text style={styles.citeMeta} numberOfLines={1}>
            {evidence.label} · {evidence.date}
          </Text>
        </View>
      </Pressable>

      <View style={styles.actions}>
        <Pressable
          onPress={primaryAction.onPress}
          accessibilityRole="button"
          accessibilityLabel={primaryAction.label}
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && styles.btnPressed,
          ]}
        >
          <Text style={styles.primaryBtnText}>{primaryAction.label}</Text>
        </Pressable>
        {secondaryAction ? (
          <Pressable
            onPress={secondaryAction.onPress}
            accessibilityRole="button"
            accessibilityLabel={secondaryAction.label}
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && styles.btnPressed,
            ]}
          >
            <Text style={styles.secondaryBtnText}>{secondaryAction.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function stateLabel(state: LibrarianObservation['concept']['state']) {
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

function renderWithEmphasis(body: string, emphasise: string[]) {
  if (emphasise.length === 0) return body;
  const escaped = emphasise.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'g');
  const parts = body.split(re);
  return parts.map((part, i) =>
    emphasise.includes(part) ? (
      <Text key={i} style={emphStyle}>
        &ldquo;{part}&rdquo;
      </Text>
    ) : (
      <Text key={i}>{part}</Text>
    ),
  );
}

const emphStyle = {
  fontFamily: LIBRARIAN_SERIF,
  fontStyle: 'italic' as const,
  color: LIBRARIAN_PURPLE_INK,
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LIBRARIAN_PURPLE_TINT_18,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  body: {
    fontSize: 14.5,
    lineHeight: 21,
    color: IOS_COLORS.label,
  },
  citeBlock: {
    backgroundColor: LIBRARIAN_PURPLE_TINT_08,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 4,
  },
  citeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  citeTitle: {
    flex: 1,
    fontSize: 13.5,
    fontFamily: LIBRARIAN_SERIF,
    fontStyle: 'italic',
    color: LIBRARIAN_PURPLE_INK,
  },
  statePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(124,77,255,0.18)',
  },
  statePillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: LIBRARIAN_PURPLE_INK,
  },
  citeMeta: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(60,60,67,0.6)',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtn: {
    flex: 1.5,
    backgroundColor: LIBRARIAN_PURPLE,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.18)',
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: IOS_COLORS.label,
    fontSize: 13,
    fontWeight: '600',
  },
  btnPressed: {
    opacity: 0.7,
  },
});
