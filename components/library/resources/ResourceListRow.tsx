import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { FORMAT_ICON, FORMAT_TINT } from './formatStyles';
import type { LibraryItemRow } from './types';

interface Props {
  item: LibraryItemRow;
  onPress?: () => void;
  onMore?: () => void;
}

export function ResourceListRow({ item, onPress, onMore }: Props) {
  const tint = FORMAT_TINT[item.format];
  const pins = item.pinCount ?? 0;
  const usageLabel =
    pins > 0 ? `Used in ${pins} step${pins === 1 ? '' : 's'}` : 'Unfiled';
  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.6}
        style={styles.main}
      >
        <View style={[styles.glyph, { backgroundColor: `${tint}1F` }]}>
          <Ionicons name={FORMAT_ICON[item.format]} size={18} color={tint} />
        </View>
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.prov} numberOfLines={1}>
            {item.capturedFrom ? `${item.capturedFrom} · ` : ''}
            {item.capturedAt ?? ''}
          </Text>
        </View>
        <View
          style={[
            styles.pill,
            pins > 0 ? { backgroundColor: `${tint}1A` } : styles.pillMuted,
          ]}
        >
          <Text
            style={[
              styles.pillText,
              { color: pins > 0 ? tint : IOS_COLORS.tertiaryLabel },
            ]}
            numberOfLines={1}
          >
            {usageLabel}
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onMore}
        hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
        style={styles.moreBtn}
      >
        <Ionicons
          name="ellipsis-horizontal"
          size={18}
          color={IOS_COLORS.tertiaryLabel}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: IOS_SPACING.lg,
    backgroundColor: IOS_COLORS.systemBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.18)',
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    minWidth: 0,
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
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    color: IOS_COLORS.tertiaryLabel,
    marginTop: 2,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pillMuted: {
    backgroundColor: 'rgba(60,60,67,0.08)',
  },
  pillText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  moreBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginLeft: 4,
  },
});
