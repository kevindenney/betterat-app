/**
 * SuggestionsBar — purple strip surfaced above the section tabs when the
 * suggestion queue has pending items. Clicking opens the SuggestionDrawer
 * via the onPress callback passed from PlaybookHome.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';

interface SuggestionsBarProps {
  pendingCount: number;
  onPress: () => void;
}

export function SuggestionsBar({ pendingCount, onPress }: SuggestionsBarProps) {
  if (pendingCount <= 0) return null;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.bar}
      activeOpacity={0.85}
    >
      <View style={styles.iconBubble}>
        <Ionicons name="sparkles" size={16} color="#fff" />
      </View>
      <Text style={styles.text}>
        {pendingCount} pending suggestion{pendingCount === 1 ? '' : 's'}
      </Text>
      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.8)" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.md,
    backgroundColor: IOS_COLORS.systemPurple,
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.md,
    borderRadius: 12,
  },
  iconBubble: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
