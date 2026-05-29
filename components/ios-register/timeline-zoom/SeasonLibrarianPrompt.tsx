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
const LILAC_SOFT = 'rgba(175, 82, 222, 0.18)';
const LILAC_BORDER = 'rgba(175, 82, 222, 0.34)';

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
  /**
   * Compact variant — single-line eyebrow + one short body line + a
   * single primary CTA, no secondary. Used for early-season views
   * (e.g. week 1-2) where there isn't much yet to reflect on and the
   * full lilac card would dominate the screen.
   */
  variant?: 'full' | 'compact';
}

export function SeasonLibrarianPrompt({
  prompt,
  onPrimary,
  onSecondary,
  variant = 'full',
}: SeasonLibrarianPromptProps) {
  if (variant === 'compact') {
    return (
      <Pressable style={styles.compactCard} onPress={onPrimary}>
        <Text style={styles.compactEyebrow}>❋ {(prompt.eyebrow ?? 'THE LIBRARIAN').toUpperCase()}</Text>
        <Text style={styles.compactBody} numberOfLines={2}>
          {prompt.body}
        </Text>
        <Text style={styles.compactCtaLine}>{prompt.primaryCta.label} →</Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>
        ❋ {(prompt.eyebrow ?? 'THE LIBRARIAN NOTICED').toUpperCase()}
      </Text>
      <Text style={styles.body}>{prompt.body}</Text>
      {prompt.emphasisLine ? (
        <Text style={styles.emphasisLine}>{prompt.emphasisLine}</Text>
      ) : null}
      {prompt.supportingLine ? (
        <Text style={styles.supportingLine}>{prompt.supportingLine}</Text>
      ) : null}
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
    marginTop: 12,
    marginBottom: 10,
    backgroundColor: LILAC_SOFT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LILAC_BORDER,
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 8,
    shadowColor: '#7B3FB0',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: LILAC,
    marginBottom: 4,
  },
  body: {
    fontSize: 12.5,
    lineHeight: 17,
    color: IOS_REGISTER.label,
    fontFamily: SERIF_FAMILY,
    fontStyle: 'italic',
  },
  emphasisLine: {
    marginTop: 3,
    fontSize: 13.5,
    lineHeight: 18,
    color: IOS_REGISTER.accentUserAction,
    fontFamily: SERIF_FAMILY,
    fontStyle: 'italic',
  },
  supportingLine: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16,
    color: IOS_REGISTER.label,
  },
  actions: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 7,
    justifyContent: 'flex-end',
  },
  secondaryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LILAC_BORDER,
  },
  secondaryText: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_REGISTER.labelSecondary,
  },
  primaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: LILAC,
  },
  primaryText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  compactCard: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    backgroundColor: LILAC_SOFT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LILAC_BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  compactEyebrow: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.55,
    color: LILAC,
    marginBottom: 3,
  },
  compactBody: {
    fontSize: 12,
    lineHeight: 16,
    color: IOS_REGISTER.label,
    fontFamily: SERIF_FAMILY,
    fontStyle: 'italic',
  },
  compactCtaLine: {
    marginTop: 5,
    fontSize: 11.5,
    fontWeight: '600',
    color: LILAC,
  },
});
