import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import type { PlanSummary } from './types';

interface Props {
  plan: PlanSummary;
}

export function PlanHero({ plan }: Props) {
  const bylineBits = [
    plan.authorName,
    plan.authorRole,
    `${plan.stepCount} steps`,
  ].filter(Boolean);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{plan.title}</Text>
      <View style={styles.byRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{plan.authorInitials}</Text>
        </View>
        <Text style={styles.byline} numberOfLines={1}>
          {bylineBits.join(' · ')}
        </Text>
      </View>
      {plan.meta ? <Text style={styles.meta}>{plan.meta}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: IOS_SPACING.sm,
    paddingBottom: IOS_SPACING.sm,
    gap: 6,
    backgroundColor: IOS_COLORS.systemBackground,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: IOS_COLORS.label,
    letterSpacing: -0.4,
    lineHeight: 27,
  },
  byRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  byline: {
    flex: 1,
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
  },
  meta: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
  },
});
