/**
 * <LibraryHero> — canonical Library landing hero.
 *
 * Per canonical §2/§6: an h1 "Library" + a lede line "Your understanding
 * of <interest> — refined." Replaces the bleed-through "Playbook" heading
 * that the old PlaybookLanding component still carries when rendered as
 * the Concepts zone body.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';

interface LibraryHeroProps {
  /** Interest name to inline into the lede. Falls back to "your practice". */
  interestName?: string | null;
}

export function LibraryHero({ interestName }: LibraryHeroProps) {
  const subject = interestName?.trim() || 'your practice';
  return (
    <View style={styles.hero}>
      <Text style={styles.title}>Library</Text>
      <Text style={styles.lede}>
        Your understanding of <Text style={styles.ledeEm}>{subject}</Text> — refined.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: IOS_SPACING.md,
    paddingBottom: IOS_SPACING.sm,
    gap: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: IOS_COLORS.label,
    letterSpacing: -0.4,
  },
  lede: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
  },
  ledeEm: {
    fontStyle: 'italic',
    color: IOS_COLORS.label,
  },
});
