import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function CapabilityChips({ labels }: { labels: string[] }) {
  if (labels.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.eye}>Capabilities this develops</Text>
      <View style={styles.row}>
        {labels.map((label) => (
          <View key={label} style={styles.chip}>
            <Text style={styles.chipText}>{label}</Text>
          </View>
        ))}
      </View>
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
  },
  chipText: {
    fontSize: 12,
    color: '#6F42FF',
    fontWeight: '600',
  },
});
