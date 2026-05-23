/**
 * <LibrarianStrip> — top-of-Library "Ask the librarian" pill.
 *
 * One of two librarian surfaces (the other is <LibrarianNoticedCard>).
 * Sits as a single quiet strip above the bench: a book-glyph icon, the
 * "Ask the librarian" affordance, and a rotating italic example of the
 * kind of question this is built to answer. Tap → answer route.
 *
 * Mic glyph on the right hints voice; for now both glyphs route to the
 * same answer surface — voice capture lands when the librarian is wired
 * to the corpus.
 */

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import {
  LIBRARIAN_EXAMPLE_QUERIES,
  LIBRARIAN_PURPLE,
  LIBRARIAN_PURPLE_TINT_08,
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
        <Ionicons name="book-outline" size={18} color={LIBRARIAN_PURPLE} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>Ask the librarian</Text>
        <Text numberOfLines={1} style={styles.example}>
          &ldquo;{example}&rdquo;
        </Text>
      </View>
      <Pressable
        onPress={() => onAsk()}
        accessibilityRole="button"
        accessibilityLabel="Ask the librarian by voice"
        hitSlop={10}
        style={styles.micBtn}
      >
        <Ionicons name="mic-outline" size={18} color={LIBRARIAN_PURPLE} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: LIBRARIAN_PURPLE_TINT_08,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LIBRARIAN_PURPLE_TINT_18,
  },
  stripPressed: {
    opacity: 0.7,
  },
  glyphSlot: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  example: {
    fontSize: 12.5,
    lineHeight: 17,
    color: 'rgba(60,60,67,0.65)',
    fontFamily: LIBRARIAN_SERIF,
    fontStyle: 'italic',
  },
  micBtn: {
    padding: 4,
  },
});
