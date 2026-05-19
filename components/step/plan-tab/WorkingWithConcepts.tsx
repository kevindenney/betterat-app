import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export interface WorkingWithConceptsProps {
  concepts: { id: string; title: string }[];
  onPressConcept?: (conceptId: string) => void;
}

export function WorkingWithConcepts({
  concepts,
  onPressConcept,
}: WorkingWithConceptsProps) {
  if (concepts.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.eye}>Working with</Text>
      <View style={styles.row}>
        {concepts.map((concept) => (
          <Pressable key={concept.id} style={styles.chip} onPress={() => onPressConcept?.(concept.id)}>
            <Text style={styles.chipText} numberOfLines={1}>{concept.title}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  eye: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    color: '#7C4DFF',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    backgroundColor: 'rgba(124,77,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 220,
  },
  chipText: {
    fontSize: 12,
    color: '#6F42FF',
    fontWeight: '600',
  },
});
