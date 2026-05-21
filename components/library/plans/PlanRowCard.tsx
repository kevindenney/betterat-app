/**
 * <PlanRowCard> — Library Plans zone card.
 *
 * Per canonical §2: author chip (avatar + "From X · N steps"), bold plan
 * title, progress bar with "X of Y · status", a footer with subscriber
 * count and resources count, and a status pill (Active / Done / Paused).
 * Whole card is pressable — taps into /library/plans/[blueprintId].
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import type { SubscribedPlanRow } from '@/hooks/useSubscribedPlansForLibrary';

interface Props {
  plan: SubscribedPlanRow;
  onPress: () => void;
}

// Canonical §2: ACTIVE pill is light-blue (in-progress), DONE is green
// (a completed achievement reads as a win), PAUSED is muted gray.
// Labels render uppercase like the canonical eyebrow.
const STATUS_PILL: Record<
  SubscribedPlanRow['status'],
  { label: string; bg: string; fg: string }
> = {
  active: { label: 'ACTIVE', bg: 'rgba(0,122,255,0.12)', fg: '#0046A8' },
  done: { label: 'DONE', bg: 'rgba(52,199,89,0.14)', fg: '#10803F' },
  paused: { label: 'PAUSED', bg: 'rgba(142,142,147,0.18)', fg: '#5C5C61' },
};

export function PlanRowCard({ plan, onPress }: Props) {
  const pill = STATUS_PILL[plan.status];
  const progressPct = plan.stepCount > 0 ? Math.min(100, (plan.doneCount / plan.stepCount) * 100) : 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${plan.title}`}
    >
      <View style={styles.head}>
        <View style={styles.authorAvatar}>
          <Text style={styles.authorAvatarText}>{plan.authorInitials}</Text>
        </View>
        <Text style={styles.authorLine} numberOfLines={1}>
          From <Text style={styles.authorName}>{plan.authorName}</Text> ·{' '}
          {plan.stepCount > 0 ? `${plan.stepCount} steps` : 'no steps yet'}
        </Text>
        <View style={[styles.pill, { backgroundColor: pill.bg }]}>
          <View style={[styles.pillDot, { backgroundColor: pill.fg }]} />
          <Text style={[styles.pillText, { color: pill.fg }]}>{pill.label}</Text>
        </View>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {plan.title}
      </Text>

      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>
        <Text style={styles.progressMeta}>
          <Text style={styles.progressMetaEm}>
            {plan.doneCount} of {plan.stepCount || '—'}
          </Text>
          {plan.status === 'done' ? ' · done' : ''}
        </Text>
      </View>

      <View style={styles.foot}>
        <View style={styles.footItem}>
          <Ionicons name="people-outline" size={13} color={IOS_COLORS.secondaryLabel} />
          <Text style={styles.footText}>
            <Text style={styles.footEm}>{plan.subscriberCount}</Text>{' '}
            {plan.subscriberCount === 1 ? 'sailor' : 'sailors'}
          </Text>
        </View>
        {plan.resourceCount > 0 ? (
          <View style={styles.footItem}>
            <Ionicons name="library-outline" size={13} color={IOS_COLORS.secondaryLabel} />
            <Text style={styles.footText}>
              <Text style={styles.footEm}>{plan.resourceCount}</Text> resources
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.md,
    paddingHorizontal: IOS_SPACING.md,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.25)',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
    gap: 10,
  },
  cardPressed: {
    opacity: 0.85,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorAvatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },
  authorLine: {
    flex: 1,
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
  },
  authorName: {
    color: IOS_COLORS.label,
    fontWeight: '600',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: IOS_COLORS.label,
    lineHeight: 21,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(60,60,67,0.12)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: IOS_COLORS.systemBlue,
  },
  progressMeta: {
    fontSize: 11,
    color: IOS_COLORS.secondaryLabel,
  },
  progressMetaEm: {
    color: IOS_COLORS.label,
    fontWeight: '600',
  },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footText: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
  },
  footEm: {
    color: IOS_COLORS.label,
    fontWeight: '600',
  },
});
