import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import type { PlanSummary } from './types';

interface Props {
  plan: PlanSummary;
}

export function PlanHero({ plan }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.byRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{plan.authorInitials}</Text>
        </View>
        <View style={styles.byLine}>
          <Text style={styles.who}>{plan.authorName}</Text>
          <Text style={styles.sub}>
            {plan.authorRole ? (
              <Text style={styles.em}>{plan.authorRole}</Text>
            ) : null}
            {plan.authorRole ? ' · ' : ''}
            {plan.stepCount}-step plan
          </Text>
        </View>
      </View>
      <Text style={styles.title}>{plan.title}</Text>
      {plan.meta ? <Text style={styles.meta}>{plan.meta}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: IOS_SPACING.md,
    paddingBottom: IOS_SPACING.md,
    gap: IOS_SPACING.sm,
    backgroundColor: IOS_COLORS.systemBackground,
  },
  byRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  byLine: {
    flex: 1,
  },
  who: {
    fontSize: 15,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  sub: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 1,
  },
  em: {
    color: IOS_COLORS.label,
    fontWeight: '600',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: IOS_COLORS.label,
    letterSpacing: -0.4,
    lineHeight: 27,
  },
  meta: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
  },
});
