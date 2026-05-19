import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function ConceptSynthesis({
  body,
  draftedAtLabel,
}: {
  body: string;
  draftedAtLabel?: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.eye}>Synthesis</Text>
      <Text style={styles.body}>{body}</Text>
      {draftedAtLabel ? <Text style={styles.meta}>Synthesized from your quotes · drafted {draftedAtLabel}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    padding: 14,
    gap: 10,
  },
  eye: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    color: '#7C4DFF',
  },
  body: {
    fontSize: 17,
    lineHeight: 26,
    color: '#1C1C1E',
    fontFamily: 'Georgia',
  },
  meta: {
    fontSize: 12,
    color: 'rgba(60,60,67,0.6)',
  },
});
