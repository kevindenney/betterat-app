import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PlaybookConceptLifecycleState } from '@/types/playbook';

export interface ConceptCardProps {
  state: PlaybookConceptLifecycleState;
  title: string;
  whenLabel?: string;
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
    <View style={[styles.card, { borderLeftColor: STATE_COLORS[state] }]}>
      <Pressable
        style={({ pressed }) => [styles.touchable, pressed && styles.touchablePressed]}
        onPress={onPress}
      >
        <View style={styles.head}>
          <View style={[styles.pill, { backgroundColor: `${STATE_COLORS[state]}1A` }]}>
            <View style={[styles.pillDot, { backgroundColor: STATE_COLORS[state] }]} />
            <Text style={[styles.pillText, { color: STATE_COLORS[state] }]}>{state}</Text>
          </View>
          {whenLabel ? <Text style={styles.when}>{whenLabel}</Text> : null}
        </View>
        <Text style={styles.title}>{title}</Text>
        {meta.length > 0 ? (
          <View style={styles.metaRow}>
            {meta.map((item) => (
              <View key={`${item.icon}:${item.label}`} style={styles.metaChip}>
                <Text style={styles.metaText}>{item.label}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.25)',
    borderLeftWidth: 2.5,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  touchable: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 8,
  },
  touchablePressed: {
    opacity: 0.85,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  pillDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  pillText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  when: {
    flex: 1,
    textAlign: 'right',
    fontSize: 10,
    color: 'rgba(60,60,67,0.6)',
  },
  // Per canonical: 14.5px serif italic title, weight 500. Compact —
  // recycled from the bigger insight-style card.
  title: {
    fontSize: 14.5,
    lineHeight: 18,
    color: '#1C1C1E',
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  metaChip: {
    borderRadius: 999,
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  metaText: {
    fontSize: 10,
    color: '#3C3C43',
  },
});
