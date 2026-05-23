/**
 * <LibrarianStrip> — top-of-Library "Ask the librarian" affordance.
 *
 * One of two librarian surfaces (the other is <LibrarianNoticedCard>).
 * Visually a tappable nav cell (book glyph, two-line copy, mic + chevron)
 * rather than a search field — early QA flagged the original input-style
 * pill as ambiguous between text entry and a button. The chevron-right
 * locks the read: tap → open the answer surface.
 *
 * Mic glyph is a discrete sub-target hinting voice; for now both glyphs
 * route to the same answer screen — real voice capture and a typed-query
 * sheet land when the librarian is wired to a corpus reader.
 */

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import {
  LIBRARIAN_EXAMPLE_QUERIES,
  LIBRARIAN_PURPLE,
  LIBRARIAN_PURPLE_INK,
  LIBRARIAN_PURPLE_TINT_18,
  LIBRARIAN_SERIF,
} from './librarianTokens';

const ROTATION_MS = 6000;

interface Props {
  onAsk: (seedQuery?: string) => void;
}

export function LibrarianStrip({ onAsk }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(
      () => setIndex((i) => (i + 1) % LIBRARIAN_EXAMPLE_QUERIES.length),
      ROTATION_MS,
    );
    return () => clearInterval(t);
  }, []);

  const example = LIBRARIAN_EXAMPLE_QUERIES[index];

  return (
    <Pressable
      onPress={() => onAsk(example)}
      accessibilityRole="button"
      accessibilityLabel="Ask the librarian"
      accessibilityHint={`Example: ${example}`}
      style={({ pressed }) => [styles.strip, pressed && styles.stripPressed]}
    >
      <View style={styles.glyphSlot}>
        <Ionicons name="book" size={16} color={LIBRARIAN_PURPLE} />
      </View>

      <View style={styles.copy}>
        <Text style={styles.title}>Ask the librarian</Text>
        <Text numberOfLines={1} style={styles.example}>
          Try &ldquo;{example}&rdquo;
        </Text>
      </View>

      <Pressable
        onPress={() => onAsk()}
        accessibilityRole="button"
        accessibilityLabel="Ask the librarian by voice"
        hitSlop={8}
        style={({ pressed }) => [
          styles.micBtn,
          pressed && styles.micBtnPressed,
        ]}
      >
        <Ionicons name="mic" size={16} color={LIBRARIAN_PURPLE_INK} />
      </Pressable>

      <Ionicons
        name="chevron-forward"
        size={16}
        color="rgba(60,60,67,0.4)"
        style={styles.chevron}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 10,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LIBRARIAN_PURPLE_TINT_18,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  stripPressed: {
    backgroundColor: 'rgba(124,77,255,0.06)',
  },
  glyphSlot: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(124,77,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontSize: 14.5,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  example: {
    fontSize: 12.5,
    lineHeight: 17,
    color: 'rgba(60,60,67,0.55)',
    fontFamily: LIBRARIAN_SERIF,
    fontStyle: 'italic',
  },
  micBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(124,77,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnPressed: {
    backgroundColor: 'rgba(124,77,255,0.20)',
  },
  chevron: {
    marginLeft: 2,
  },
});
