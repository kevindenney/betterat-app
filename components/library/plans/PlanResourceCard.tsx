import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import type { PlanResourceRow } from './types';

interface Props {
  row: PlanResourceRow;
  onPress?: () => void;
}

const KIND_ICON: Record<PlanResourceRow['kind'], keyof typeof Ionicons.glyphMap> = {
  video: 'play-circle',
  article: 'document-text-outline',
  drill: 'flag-outline',
  book: 'book-outline',
  audio: 'mic-outline',
  link: 'link-outline',
  pdf: 'document-outline',
};

const KIND_TINT: Record<PlanResourceRow['kind'], string> = {
  video: '#FF3B30',
  article: '#1E63D6',
  drill: '#34C759',
  book: '#AF52DE',
  audio: '#FF9500',
  link: '#5AC8FA',
  pdf: '#FF2D55',
};

export function PlanResourceCard({ row, onPress }: Props) {
  const tint = KIND_TINT[row.kind];
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      style={styles.card}
    >
      <View style={[styles.icon, { backgroundColor: `${tint}22` }]}>
        <Ionicons name={KIND_ICON[row.kind]} size={20} color={tint} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {row.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {row.durationMin ? (
            <Text style={styles.em}>{row.durationMin} min</Text>
          ) : row.pageCount ? (
            <Text style={styles.em}>{row.pageCount} pages</Text>
          ) : null}
          {row.linkedStepNumber
            ? `${row.durationMin || row.pageCount ? ' · ' : ''}linked to Step ${row.linkedStepNumber}`
            : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={IOS_COLORS.tertiaryLabel} />
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
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
    lineHeight: 18,
  },
  meta: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  em: {
    color: IOS_COLORS.label,
    fontWeight: '600',
  },
});
