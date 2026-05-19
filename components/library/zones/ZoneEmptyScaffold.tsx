import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  blurb: string;
}

export function ZoneEmptyScaffold({ icon, title, blurb }: Props) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={28} color={IOS_COLORS.tertiaryLabel} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.blurb}>{blurb}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: IOS_SPACING.lg,
    padding: IOS_SPACING.lg,
    borderRadius: 16,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    alignItems: 'center',
    gap: IOS_SPACING.sm,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  blurb: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
  },
});
