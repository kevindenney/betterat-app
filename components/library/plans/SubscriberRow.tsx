import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import type { SubscriberRow as SubscriberRowData } from './types';

interface Props {
  row: SubscriberRowData;
  onPress?: () => void;
}

const TINTS = ['#34C759', '#AF52DE', '#FF9500', '#FF2D55', '#5AC8FA', '#1E63D6'];

export function SubscriberRow({ row, onPress }: Props) {
  const avTint = row.avatarTint ?? TINTS[row.id.charCodeAt(0) % TINTS.length];
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      style={styles.card}
    >
      <View style={[styles.avatar, { backgroundColor: avTint }]}>
        <Text style={styles.avatarText}>{row.initials}</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.whoLine}>
          <Text style={styles.who}>{row.name}</Text>
          {row.where ? (
            <Text style={styles.where}>
              {row.where}
              {row.boat ? (
                <Text style={styles.boat}> · {row.boat}</Text>
              ) : null}
            </Text>
          ) : null}
        </View>
        <Text style={styles.what} numberOfLines={1}>
          On <Text style={styles.em}>{row.currentStepLabel}</Text>
        </Text>
      </View>
      <View style={styles.rightSide}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressBar,
              { width: `${Math.min(100, Math.max(0, row.progressPct))}%` },
            ]}
          />
        </View>
        <Text style={styles.stepTag}>
          <Text style={styles.em}>{row.currentStepNumber}</Text>
          <Text style={styles.dim}> / {row.totalSteps}</Text>
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOS_COLORS.systemBackground,
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.md,
    gap: IOS_SPACING.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.18)',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  whoLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    flexWrap: 'wrap',
  },
  who: {
    fontSize: 15,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  where: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
  },
  boat: {
    fontStyle: 'italic',
  },
  what: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  em: {
    color: IOS_COLORS.label,
    fontWeight: '600',
  },
  dim: {
    color: IOS_COLORS.tertiaryLabel,
  },
  rightSide: {
    alignItems: 'flex-end',
    gap: 4,
    minWidth: 60,
  },
  progressTrack: {
    width: 56,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(60,60,67,0.12)',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#34C759',
    borderRadius: 999,
  },
  stepTag: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
});
