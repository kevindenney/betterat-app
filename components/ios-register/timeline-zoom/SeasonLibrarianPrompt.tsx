/**
 * Season librarian prompt card (L3 · Screen 09 bottom band).
 *
 * Lilac-tinted card with:
 *   - "❋ THE LIBRARIAN NOTICED" eyebrow (overridable for L4 where the
 *     wording is "Worth a reflection?").
 *   - Italic-serif body paragraph (the librarian's observation).
 *   - Optional secondary ghost CTA ("Not now") + primary lilac CTA
 *     ("Open a season check-in" / "Start a reflection").
 *
 * Single-use callbacks per intent so the parent can route to the right
 * surface — the season check-in flow vs. a fresh L1 reflection step are
 * different downstream destinations.
 */

import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import type { SeasonLibrarianPrompt as PromptData } from './types';

const LILAC = '#AF52DE';
const LILAC_SOFT = 'rgba(175, 82, 222, 0.10)';
const LILAC_BORDER = 'rgba(175, 82, 222, 0.28)';

const SERIF_FAMILY = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  web: 'Georgia, "Times New Roman", serif',
  default: 'Georgia',
}) as string;

interface SeasonLibrarianPromptProps {
  prompt: PromptData;
  onPrimary?: () => void;
  onSecondary?: () => void;
}

export function SeasonLibrarianPrompt({
  prompt,
  onPrimary,
  onSecondary,
}: SeasonLibrarianPromptProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>
        ❋ {(prompt.eyebrow ?? 'THE LIBRARIAN NOTICED').toUpperCase()}
      </Text>
      <Text style={styles.body}>{prompt.body}</Text>
      <View style={styles.actions}>
        {prompt.secondaryCta ? (
          <Pressable style={styles.secondaryBtn} onPress={onSecondary}>
            <Text style={styles.secondaryText}>{prompt.secondaryCta.label}</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.primaryBtn} onPress={onPrimary}>
          <Text style={styles.primaryText}>{prompt.primaryCta.label}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    backgroundColor: LILAC_SOFT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LILAC_BORDER,
    borderRadius: 14,
    padding: 14,
  },
  eyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: LILAC,
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_REGISTER.label,
    fontFamily: SERIF_FAMILY,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    justifyContent: 'flex-end',
  },
  secondaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LILAC_BORDER,
  },
  secondaryText: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_REGISTER.labelSecondary,
  },
  primaryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: LILAC,
  },
  primaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
