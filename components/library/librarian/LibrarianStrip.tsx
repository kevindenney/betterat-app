/**
 * <LibrarianStrip> — top-of-Library "Ask the librarian" CTA.
 *
 * One of two librarian surfaces (the other is <LibrarianNoticedCard>).
 * A single button: small book chip, "Ask the librarian" + rotating
 * italic example, trailing "Ask" pill. Whole strip is one tap target —
 * earlier passes split it into book + text + mic + chevron and the user
 * couldn't tell what to tap, so this consolidates to one obvious CTA.
 *
 * Voice capture and a typed-query sheet land when the librarian is
 * wired to a real corpus reader; the existing route just opens the
 * canonical answer.
 *
 * Note: `style` is a static array, NOT a `({pressed}) => …` callback —
 * the callback form silently drops `flexDirection:'row'` on iOS, which
 * was collapsing children into a vertical stack on the previous pass.
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
      style={styles.strip}
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

      <View style={styles.askPill}>
        <Text style={styles.askPillText}>Ask</Text>
        <Ionicons name="chevron-forward" size={13} color="#FFFFFF" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 8,
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
  askPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: 12,
    paddingRight: 8,
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
