/**
 * <LibrarianLine> — the single collapsed librarian surface.
 *
 * Replaces the old two-surface stack (LibrarianStrip + always-on
 * LibrarianNoticedCard). One purple line:
 *   • No live observation → rotating "Ask the librarian" prompt; the
 *     whole line (and the trailing Ask pill) opens the ask route.
 *   • Live observation     → a concise insight teaser; tapping toggles
 *     the full LibrarianNoticedCard open beneath it (the parent renders
 *     the card), so Promote / Add-evidence are preserved on demand
 *     rather than occupying the feed by default.
 *
 * Register is locked (librarianTokens): purple, italic Georgia serif,
 * book glyph. Never blue, never sparkles.
 *
 * Note: `style` is a static object, NOT a `({pressed}) => …` callback —
 * the callback form silently drops `flexDirection:'row'` on iOS.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import { useVocabulary } from '@/hooks/useVocabulary';
import {
  buildLibrarianExampleQueries,
  LIBRARIAN_PURPLE,
  LIBRARIAN_PURPLE_INK,
  LIBRARIAN_PURPLE_TINT_18,
  LIBRARIAN_SERIF,
} from './librarianTokens';

const ROTATION_MS = 6000;

interface Props {
  /** Concise teaser for a live observation. Null → ask mode. */
  insightText?: string | null;
  /** Phrases inside `insightText` to render emphasised (serif italic). */
  emphasise?: string[];
  /** Whether the full noticed card (rendered by the parent) is open. */
  expanded: boolean;
  /** Toggle the noticed card (only called when there's an insight). */
  onToggleExpand: () => void;
  /** Open the ask route, optionally seeded with the rotating example. */
  onAsk: (seedQuery?: string) => void;
}

export function LibrarianLine({
  insightText,
  emphasise = [],
  expanded,
  onToggleExpand,
  onAsk,
}: Props) {
  const { vocab } = useVocabulary();
  const examples = useMemo(
    () => buildLibrarianExampleQueries(vocab('Coach')),
    [vocab],
  );
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(
      () => setIndex((i) => (i + 1) % examples.length),
      ROTATION_MS,
    );
    return () => clearInterval(t);
  }, [examples.length]);

  const example = examples[index % examples.length];
  const hasInsight = !!insightText;

  return (
    <Pressable
      style={styles.line}
      onPress={() => (hasInsight ? onToggleExpand() : onAsk(example))}
      accessibilityRole="button"
      accessibilityLabel={
        hasInsight ? 'The librarian noticed something' : 'Ask the librarian'
      }
      accessibilityHint={hasInsight ? undefined : `Example: ${example}`}
    >
      <View style={styles.glyph}>
        <Ionicons name="book" size={14} color={LIBRARIAN_PURPLE} />
      </View>

      <Text style={styles.text} numberOfLines={2}>
        <Text style={styles.lead}>Librarian </Text>
        {hasInsight ? (
          renderWithEmphasis(insightText!, emphasise)
        ) : (
          <Text style={styles.example}>· {example}</Text>
        )}
      </Text>

      {hasInsight ? (
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={LIBRARIAN_PURPLE_INK}
        />
      ) : (
        <View style={styles.askPill}>
          <Text style={styles.askPillText}>Ask</Text>
        </View>
      )}
    </Pressable>
  );
}

function renderWithEmphasis(body: string, emphasise: string[]) {
  if (emphasise.length === 0) return <Text style={styles.body}>{body}</Text>;
  const escaped = emphasise.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'g');
  const parts = body.split(re);
  return parts.map((part, i) =>
    emphasise.includes(part) ? (
      <Text key={i} style={styles.emph}>
        &ldquo;{part}&rdquo;
      </Text>
    ) : (
      <Text key={i} style={styles.body}>
        {part}
      </Text>
    ),
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 12,
    borderRadius: 13,
    backgroundColor: 'rgba(124,77,255,0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LIBRARIAN_PURPLE_TINT_18,
  },
  glyph: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: 'rgba(124,77,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  lead: {
    fontWeight: '800',
    color: LIBRARIAN_PURPLE_INK,
    letterSpacing: 0.2,
  },
  body: {
    color: IOS_COLORS.label,
    fontFamily: LIBRARIAN_SERIF,
    fontStyle: 'italic',
  },
  emph: {
    color: LIBRARIAN_PURPLE_INK,
    fontFamily: LIBRARIAN_SERIF,
    fontStyle: 'italic',
    fontWeight: '600',
  },
  example: {
    color: 'rgba(60,60,67,0.55)',
    fontFamily: LIBRARIAN_SERIF,
    fontStyle: 'italic',
  },
  askPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: LIBRARIAN_PURPLE_INK,
  },
  askPillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
