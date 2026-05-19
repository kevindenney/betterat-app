import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '@/lib/design-tokens-ios';

interface Props {
  count: number;
  title: string;
  sub: string;
  onPress: () => void;
}

export function InboxStrip({ count, title, sub, onPress }: Props) {
  if (count <= 0) return null;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.strip}
    >
      <View style={styles.icnWrap}>
        <Ionicons name="mail-outline" size={18} color="#5C2DAA" />
        <View style={styles.pip}>
          <Text style={styles.pipText}>{count}</Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.nm} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.sub} numberOfLines={2}>
          {sub}
        </Text>
      </View>
      <View style={styles.openRow}>
        <Text style={styles.openText}>Open</Text>
        <Ionicons name="chevron-forward" size={14} color="#5C2DAA" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginVertical: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(175,82,222,0.10)',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(175,82,222,0.35)',
  },
  icnWrap: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(175,82,222,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pip: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: '#FF3B30',
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  nm: {
    fontSize: 13.5,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  sub: {
    fontSize: 11.5,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 1,
    lineHeight: 15,
  },
  openRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  openText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5C2DAA',
  },
});
