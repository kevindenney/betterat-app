import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import { FORMAT_ICON, FORMAT_LABEL, FORMAT_TINT } from './formatStyles';
import type { LibraryItemRow } from './types';

interface Props {
  item: LibraryItemRow;
  onPress?: () => void;
}

const CARD_WIDTH = 156;

export function LibraryItemCard({ item, onPress }: Props) {
  const tint = FORMAT_TINT[item.format];
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.card}
    >
      <View style={[styles.spine, { backgroundColor: tint }]} />
      <View style={styles.topBar}>
        <View style={[styles.fmtChip, { backgroundColor: `${tint}1F` }]}>
          <Ionicons name={FORMAT_ICON[item.format]} size={10} color={tint} />
          <Text style={[styles.fmtChipText, { color: tint }]}>
            {FORMAT_LABEL[item.format]}
          </Text>
        </View>
        {item.active ? (
          <View style={[styles.liveDot, { backgroundColor: tint }]} />
        ) : null}
      </View>
      <Text style={styles.source} numberOfLines={1}>
        {item.source}
      </Text>
      <Text style={styles.title} numberOfLines={3}>
        {item.title}
      </Text>
      <View style={styles.foot}>
        {item.meta ? (
          <Text style={styles.footText} numberOfLines={1}>
            {item.meta}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 14,
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(60,60,67,0.18)',
    gap: 6,
    overflow: 'hidden',
  },
  spine: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 3,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 16,
  },
  fmtChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  fmtChipText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  source: {
    fontSize: 10,
    fontWeight: '700',
    color: IOS_COLORS.tertiaryLabel,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.label,
    lineHeight: 17,
    letterSpacing: -0.1,
  },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  footText: {
    fontSize: 11,
    color: IOS_COLORS.tertiaryLabel,
  },
});
