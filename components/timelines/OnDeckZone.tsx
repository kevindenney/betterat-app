import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface OnDeckZoneProps {
  items: { id: string; title: string; provenance: string; addedAt: string }[];
  onPlace: (id: string) => void;
  onDiscard: (id: string) => void;
}

export function OnDeckZone({ items, onPlace, onDiscard }: OnDeckZoneProps) {
  if (items.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>On deck</Text>
      {items.map((item) => (
        <View key={item.id} style={styles.row}>
          <View style={styles.copy}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Text style={styles.meta}>{item.provenance} · {item.addedAt}</Text>
          </View>
          <Pressable style={styles.placeBtn} onPress={() => onPlace(item.id)}>
            <Text style={styles.placeText}>Place→</Text>
          </Pressable>
          <Pressable style={styles.discardBtn} onPress={() => onDiscard(item.id)}>
            <Text style={styles.discardText}>×</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 18,
    backgroundColor: '#FFF7ED',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#F5C58A',
    padding: 14,
    gap: 10,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#B45309',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  copy: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7C2D12',
  },
  meta: {
    fontSize: 12,
    color: '#9A3412',
  },
  placeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FED7AA',
  },
  placeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9A3412',
  },
  discardBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discardText: {
    fontSize: 18,
    lineHeight: 18,
    color: '#B45309',
  },
});
