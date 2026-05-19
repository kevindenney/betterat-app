import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { FORMAT_ICON, FORMAT_TINT } from './formatStyles';
import type { LibraryItemRow } from './types';

interface Props {
  item: LibraryItemRow;
  onPress?: () => void;
}

export function RecentItemRow({ item, onPress }: Props) {
  const tint = FORMAT_TINT[item.format];
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      style={styles.row}
    >
      <View style={[styles.glyph, { backgroundColor: `${tint}1F` }]}>
        <Ionicons name={FORMAT_ICON[item.format]} size={18} color={tint} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.prov} numberOfLines={1}>
          {item.capturedFrom ? `${item.capturedFrom} · ` : ''}
          {item.capturedAt ? `${item.capturedAt}` : ''}
          {item.topicTag ? ` · ${item.topicTag}` : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={IOS_COLORS.tertiaryLabel} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: 10,
    backgroundColor: IOS_COLORS.systemBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.18)',
  },
  glyph: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 13.5,
    fontWeight: '600',
    color: IOS_COLORS.label,
    lineHeight: 17,
  },
  prov: {
    fontSize: 11,
    color: IOS_COLORS.tertiaryLabel,
    marginTop: 2,
  },
});
