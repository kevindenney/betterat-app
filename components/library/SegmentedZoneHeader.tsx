import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
    <View style={styles.row}>
      {ZONES.map((z) => {
        const active = z.key === zone;
        return (
          <Pressable
            key={z.key}
            onPress={() => onChange(z.key)}
            style={({ pressed }) => [
              styles.chip,
              active ? styles.chipActive : styles.chipIdle,
              pressed && !active ? styles.chipPressed : null,
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                styles.label,
                active ? styles.labelActive : styles.labelIdle,
              ]}
              numberOfLines={1}
            >
              {z.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
  },
  chip: {
    flexShrink: 1,
    minHeight: 32,
    paddingHorizontal: IOS_SPACING.sm + 2,
    paddingVertical: 6,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipIdle: {
    backgroundColor: IOS_COLORS.secondarySystemBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.15)',
  },
  chipActive: {
    backgroundColor: IOS_COLORS.systemBlue,
  },
  chipPressed: {
    opacity: 0.7,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  labelIdle: {
    color: IOS_COLORS.label,
  },
  labelActive: {
    color: '#FFFFFF',
  },
});
