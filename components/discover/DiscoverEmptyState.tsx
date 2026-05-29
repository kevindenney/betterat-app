/**
 * DiscoverEmptyState — the honest "you're early" state for Discover surfaces.
 *
 * Used when a surface has no real data for the current interest, instead of
 * falling through to another interest's seeded content (the sailing-vernacular
 * leak: a Running register showing "17 races" peers). Speaks the truth — the
 * register is just early — rather than borrowing a different craft's vocab.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';

interface DiscoverEmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
}

export function DiscoverEmptyState({
  icon = 'sparkles-outline',
  title,
  body,
  ctaLabel,
  onCtaPress,
}: DiscoverEmptyStateProps) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={36} color={IOS_REGISTER.labelTertiary} />
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {ctaLabel && onCtaPress ? (
        <Pressable style={styles.cta} onPress={onCtaPress} hitSlop={8}>
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 44,
    paddingHorizontal: 32,
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: IOS_REGISTER.label,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_REGISTER.labelSecondary,
    textAlign: 'center',
  },
  cta: {
    marginTop: 6,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: IOS_COLORS.systemBlue,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
