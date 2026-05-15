import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';

interface PlanOptionalAddOnsProps {
  children?: React.ReactNode;
}

export function PlanOptionalAddOns({ children }: PlanOptionalAddOnsProps) {
  const [expanded, setExpanded] = useState(false);

  if (!children) return null;

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.header} onPress={() => setExpanded((prev) => !prev)}>
        <Text style={styles.title}>More options</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={IOS_COLORS.secondaryLabel} />
      </Pressable>
      {expanded && <View style={styles.body}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: IOS_COLORS.systemGray5,
    backgroundColor: 'rgba(255,255,255,0.72)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: IOS_SPACING.md,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  body: {
    paddingHorizontal: IOS_SPACING.md,
    paddingBottom: IOS_SPACING.md,
    gap: IOS_SPACING.sm,
  },
});
