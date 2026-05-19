import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { FORMAT_TINT } from './formatStyles';
import type { CollectionCard } from './types';

interface Props {
  collections: CollectionCard[];
  onPress?: (id: string) => void;
}

export function CollectionsRow({ collections, onPress }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.track}
    >
      {collections.map((c) => (
        <TouchableOpacity
          key={c.id}
          activeOpacity={0.7}
          onPress={() => onPress?.(c.id)}
          style={styles.card}
        >
          <Text style={styles.ct}>{c.itemCount}</Text>
          <Text style={styles.name} numberOfLines={2}>
            {c.name}
          </Text>
          <View style={styles.strip}>
            {c.formatStrip.map((f, i) => (
              <View
                key={`${c.id}-${f}-${i}`}
                style={[styles.stripCell, { backgroundColor: FORMAT_TINT[f] }]}
              />
            ))}
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  track: {
    paddingHorizontal: IOS_SPACING.lg,
    gap: 10,
  },
  card: {
    width: 148,
    height: 96,
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 14,
    padding: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(60,60,67,0.18)',
    justifyContent: 'space-between',
  },
  ct: {
    fontSize: 22,
    fontWeight: '800',
    color: IOS_COLORS.label,
    letterSpacing: -0.5,
  },
  name: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.label,
    lineHeight: 15,
  },
  strip: {
    flexDirection: 'row',
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
    gap: 1,
  },
  stripCell: {
    flex: 1,
    height: '100%',
  },
});
