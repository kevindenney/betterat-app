/**
 * ConceptCard — grid card for ConceptList. Shows title, origin badge, and a
 * "Pull latest available" hint on forked rows whose upstream has been updated
 * more recently than this fork.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import type { PlaybookConceptRecord, ConceptOrigin } from '@/types/playbook';

interface ConceptCardProps {
  concept: PlaybookConceptRecord;
  hasUpdate?: boolean;
}

const ORIGIN_LABEL: Record<ConceptOrigin, string> = {
  platform_baseline: 'Platform',
  pathway_baseline: 'Pathway',
  personal: 'Personal',
  forked: 'Forked',
};

const ORIGIN_COLOR: Record<ConceptOrigin, string> = {
  platform_baseline: IOS_COLORS.systemIndigo,
  pathway_baseline: IOS_COLORS.systemTeal,
  personal: IOS_COLORS.systemBlue,
  forked: IOS_COLORS.systemOrange,
};

function snippet(body: string): string {
  const trimmed = body.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= 140) return trimmed;
  return trimmed.slice(0, 137) + '…';
}

export function ConceptCard({ concept, hasUpdate }: ConceptCardProps) {
  return (
    <Pressable
      onPress={() => router.push(`/library/concepts/${concept.slug}` as any)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.badge,
            { backgroundColor: `${ORIGIN_COLOR[concept.origin]}1A` },
          ]}
        >
          <Text style={[styles.badgeText, { color: ORIGIN_COLOR[concept.origin] }]}>
            {ORIGIN_LABEL[concept.origin]}
          </Text>
        </View>
        {hasUpdate ? (
          <View style={styles.updatePill}>
            <Ionicons name="cloud-download-outline" size={11} color={IOS_COLORS.systemOrange} />
            <Text style={styles.updateText}>Pull latest</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {concept.title}
      </Text>
      {concept.body_md ? (
        <Text style={styles.snippet} numberOfLines={3}>
          {snippet(concept.body_md)}
        </Text>
      ) : (
        <Text style={styles.empty}>No body yet.</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 14,
    padding: IOS_SPACING.lg,
    gap: IOS_SPACING.sm,
    minHeight: 160,
  },
  pressed: {
    opacity: 0.6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  updatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 149, 0, 0.12)',
  },
  updateText: {
    fontSize: 10,
    fontWeight: '700',
    color: IOS_COLORS.systemOrange,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  snippet: {
    fontSize: 13,
    lineHeight: 18,
    color: IOS_COLORS.secondaryLabel,
  },
  empty: {
    fontSize: 12,
    fontStyle: 'italic',
    color: IOS_COLORS.tertiaryLabel,
  },
});
