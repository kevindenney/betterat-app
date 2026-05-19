import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';

export type LibraryZone = 'all' | 'plans' | 'people' | 'concepts' | 'resources';

const ZONES: { key: LibraryZone; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'plans', label: 'Plans' },
  { key: 'people', label: 'People' },
  { key: 'concepts', label: 'Concepts' },
  { key: 'resources', label: 'Resources' },
];

interface Props {
  zone: LibraryZone;
  onChange: (zone: LibraryZone) => void;
}

export function SegmentedZoneHeader({ zone, onChange }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {ZONES.map((z) => {
        const active = z.key === zone;
        return (
          <Pressable
            key={z.key}
            onPress={() => onChange(z.key)}
            style={({ pressed }) => [
              styles.chip,
              active && styles.chipActive,
              pressed && !active && styles.chipPressed,
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{z.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    gap: IOS_SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.1)',
  },
  chipActive: {
    backgroundColor: IOS_COLORS.systemBlue,
    borderColor: IOS_COLORS.systemBlue,
  },
  chipPressed: {
    opacity: 0.7,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  labelActive: {
    color: '#fff',
  },
});
