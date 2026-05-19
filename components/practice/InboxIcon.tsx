import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '@/lib/design-tokens-ios';

interface Props {
  count: number;
  onPress: () => void;
  size?: number;
}

export function InboxIcon({ count, onPress, size = 24 }: Props) {
  return (
    <TouchableOpacity onPress={onPress} hitSlop={8} style={styles.wrap}>
      <Ionicons name="mail-outline" size={size} color={IOS_COLORS.label} />
      {count > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: '#FF3B30',
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0,
  },
});
