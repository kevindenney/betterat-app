import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PlaybookConceptLifecycleState } from '@/types/playbook';

export interface ConceptCardProps {
  state: PlaybookConceptLifecycleState;
  title: string;
  whenLabel: string;
  meta: { icon: string; label: string }[];
  onPress: () => void;
}

const STATE_COLORS: Record<PlaybookConceptLifecycleState, string> = {
  seed: '#AEAEB2',
  forming: '#D99000',
  testing: '#7C4DFF',
  settled: '#34C759',
};

export function ConceptCard({ state, title, whenLabel, meta, onPress }: ConceptCardProps) {
  return (
    <Pressable style={[styles.card, { borderLeftColor: STATE_COLORS[state] }]} onPress={onPress}>
      <View style={styles.head}>
        <View style={[styles.pill, { backgroundColor: `${STATE_COLORS[state]}1A` }]}>
          <Text style={[styles.pillText, { color: STATE_COLORS[state] }]}>{state}</Text>
        </View>
        <Text style={styles.when}>{whenLabel}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.metaRow}>
        {meta.map((item) => (
          <View key={`${item.icon}:${item.label}`} style={styles.metaChip}>
            <Text style={styles.metaText}>{item.label}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.25)',
    borderLeftWidth: 2.5,
    padding: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  when: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12,
    color: 'rgba(60,60,67,0.6)',
  },
  title: {
    fontSize: 23,
    lineHeight: 31,
    color: '#1C1C1E',
    fontFamily: 'Georgia',
    fontStyle: 'italic',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaChip: {
    borderRadius: 999,
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metaText: {
    fontSize: 11,
    color: '#3C3C43',
  },
});
