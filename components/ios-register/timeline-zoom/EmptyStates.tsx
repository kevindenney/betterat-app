/**
 * Shared empty-state cards for the L1 / L2 / L3 surfaces.
 *
 * Rendered when the user's current interest has no steps in the relevant
 * scope (no focused step at L1, no current-week steps at L2, no current-
 * season weeks at L3). Each card carries a verb eyebrow matching the
 * surrounding zoom level, an honest copy line, and an "Add a step" CTA
 * that opens the universal `+` composer via useUniversalPlus().
 *
 * L4 is intentionally not covered — its analysis aggregates across the
 * entire practice history and always has at least the seasons[] payload
 * to draw, so its empty state is the existing "all four bricks empty"
 * lane rendering, not a missing-content card.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_REGISTER, IOS_SPACING } from '@/lib/design-tokens-ios';
import { useUniversalPlus } from '@/components/capture/UniversalPlusProvider';

interface ZoomEmptyStateProps {
  level: 1 | 2 | 3;
  interestLabel: string;
}

const COPY: Record<1 | 2 | 3, { verb: string; title: string; body: string }> = {
  1: {
    verb: 'ZOOM · ONE STEP · DOING',
    title: 'No step in focus yet',
    body: 'Add your first step in this interest to start practicing.',
  },
  2: {
    verb: 'ZOOM · THIS WEEK · PLANNING',
    title: 'No steps this week',
    body: 'Add a step or pick a day to plan toward.',
  },
  3: {
    verb: 'ZOOM · THIS SEASON · REFLECTING',
    title: 'This rotation is just starting',
    body: 'Add a step to begin the season arc. The capability river will fill in as you practice.',
  },
};

export function ZoomEmptyState({ level, interestLabel }: ZoomEmptyStateProps) {
  const universalPlus = useUniversalPlus();
  const copy = COPY[level];

  return (
    <View style={styles.host}>
      <Text style={styles.verb}>{copy.verb}</Text>

      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="leaf-outline" size={26} color={IOS_REGISTER.labelTertiary} />
        </View>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.body}>{copy.body}</Text>
        <Text style={styles.interestRow}>
          Interest: <Text style={styles.interestRowEm}>{interestLabel}</Text>
        </Text>

        {universalPlus.isAvailable ? (
          <Pressable style={styles.cta} onPress={universalPlus.open}>
            <Ionicons name="add" size={16} color="#FFFFFF" />
            <Text style={styles.ctaText}>Add a step</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: 20,
  },
  verb: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelSecondary,
    marginBottom: 24,
  },
  card: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: IOS_REGISTER.fillPill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 14,
    color: IOS_REGISTER.labelSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 12,
  },
  interestRow: {
    fontSize: 12,
    color: IOS_REGISTER.labelTertiary,
    marginBottom: 16,
  },
  interestRowEm: {
    color: IOS_REGISTER.label,
    fontWeight: '500',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: IOS_REGISTER.accentUserAction,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
