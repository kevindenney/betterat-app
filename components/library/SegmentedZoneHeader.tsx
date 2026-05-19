import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
          <TouchableOpacity
            key={z.key}
            onPress={() => onChange(z.key)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{
              minHeight: 32,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? '#007AFF' : '#F2F2F7',
              borderWidth: active ? 0 : StyleSheet.hairlineWidth,
              borderColor: 'rgba(60,60,67,0.18)',
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: active ? '#FFFFFF' : IOS_COLORS.label,
              }}
            >
              {z.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    gap: 6,
  },
});
