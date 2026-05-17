import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type PillState = 'settled' | 'current' | 'planned';
type AddState = 'add' | 'added' | 'fork' | 'forked' | 'saw-it';

export interface TimelineStepCardProps {
  pillState: PillState;
  title: string;
  metaLabel: string;
  metaWhen: string;
  capabilityChips?: string[];
  addState: AddState;
  onAddPress: () => void;
}

const PILL = {
  settled: { bg: '#E8F7EC', fg: '#2F7A4A', label: 'Settled' },
  current: { bg: '#EAF2FF', fg: '#2563EB', label: 'Current' },
  planned: { bg: '#F3F4F6', fg: '#6B7280', label: 'Planned' },
} as const;

const CTA = {
  add: 'Add',
  added: 'Added',
  fork: 'Fork',
  forked: 'Forked',
  'saw-it': 'Viewed',
} as const;

export function TimelineStepCard({
  pillState,
  title,
  metaLabel,
  metaWhen,
  capabilityChips = [],
  addState,
  onAddPress,
}: TimelineStepCardProps) {
  const pill = PILL[pillState];
  const disabled = addState === 'added' || addState === 'forked' || addState === 'saw-it';

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={[styles.pill, { backgroundColor: pill.bg }]}>
          <Text style={[styles.pillText, { color: pill.fg }]}>{pill.label}</Text>
        </View>
        <Text style={styles.meta}>{metaWhen}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.sub}>{metaLabel}</Text>
      {capabilityChips.length > 0 && (
        <View style={styles.chips}>
          {capabilityChips.slice(0, 4).map((chip) => (
            <View key={chip} style={styles.chip}>
              <Text style={styles.chipText}>{chip}</Text>
            </View>
          ))}
        </View>
      )}
      <Pressable
        style={[styles.cta, disabled && styles.ctaDisabled]}
        onPress={onAddPress}
        disabled={disabled}
      >
        <Text style={[styles.ctaText, disabled && styles.ctaTextDisabled]}>{CTA[addState]}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  meta: {
    fontSize: 12,
    color: '#6B7280',
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    color: '#111827',
    fontFamily: 'Georgia',
    fontStyle: 'italic',
  },
  sub: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4B5563',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 11,
    color: '#6B7280',
  },
  cta: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
  },
  ctaDisabled: {
    backgroundColor: '#F3F4F6',
  },
  ctaText: {
    color: '#2563EB',
    fontWeight: '600',
  },
  ctaTextDisabled: {
    color: '#9CA3AF',
  },
});
