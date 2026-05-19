import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export function TestedInStrip({
  steps,
  onPressStep,
}: {
  steps: { id: string; title: string; status?: string | null }[];
  onPressStep?: (stepId: string) => void;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.eye}>Tested in</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {steps.length === 0 ? (
          <Text style={styles.empty}>Not linked to a step yet.</Text>
        ) : (
          steps.map((step) => (
            <Pressable key={step.id} style={styles.card} onPress={() => onPressStep?.(step.id)}>
              <Text style={styles.title} numberOfLines={2}>{step.title}</Text>
              <Text style={styles.meta}>{step.status ?? 'linked step'}</Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  eye: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    color: '#3C3C43',
  },
  row: {
    gap: 10,
  },
  card: {
    width: 180,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    padding: 12,
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  meta: {
    fontSize: 12,
    color: 'rgba(60,60,67,0.6)',
  },
  empty: {
    fontSize: 14,
    color: 'rgba(60,60,67,0.6)',
  },
});
