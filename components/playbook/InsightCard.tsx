import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fontFamily } from '@/lib/design-tokens-editorial';

export interface InsightCardProps {
  insight: {
    id: string;
    sourceLabel: string;
    sourceIcon: 'microphone' | 'bulb' | 'bookmark';
    body: string;
  };
  onRefine: () => void;
  onDiscard: () => void;
}

export function InsightCard({ insight, onRefine, onDiscard }: InsightCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.source}>{insight.sourceLabel}</Text>
      <Text style={styles.body}>{insight.body}</Text>
      <View style={styles.actions}>
        <Pressable onPress={onRefine} accessibilityRole="button">
          <Text style={styles.refine}>Refine into concept</Text>
        </Pressable>
        <Pressable onPress={onDiscard} accessibilityRole="button">
          <Text style={styles.discard}>Discard</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D1D1D6',
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  source: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(60,60,67,0.6)',
  },
  body: {
    fontSize: 19,
    lineHeight: 28,
    color: '#1C1C1E',
    fontFamily: fontFamily.serif,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  refine: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  discard: {
    fontSize: 13,
    color: 'rgba(60,60,67,0.6)',
  },
});
