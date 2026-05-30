import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';

export type LibraryZone =
  | 'all'
  | 'today'
  | 'plans'
  | 'people'
  | 'concepts'
  | 'resources'
  // "Stacks" zones — reached from the curated feed's See-all links.
  // These fold what used to be separate Discover segments into Library.
  | 'follow'
  | 'orgs'
  | 'interests';

// Canonical §2 keeps the segmented strip to four pills (no People).
// The People zone route still exists — it's reachable from Profile and
// from cross-links — it just isn't part of the Library landing tab strip.
const ZONES: { key: LibraryZone; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'plans', label: 'Plans' },
  { key: 'concepts', label: 'Concepts' },
  { key: 'resources', label: 'Resources' },
];

interface Props {
  zone: LibraryZone;
  onChange: (zone: LibraryZone) => void;
  /** Optional per-zone counts shown as a small number in each pill. */
  counts?: Partial<Record<LibraryZone, number>>;
}

export function SegmentedZoneHeader({ zone, onChange, counts }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {ZONES.map((z) => {
        const active = z.key === zone;
        const count = counts?.[z.key];
        const showCount = z.key !== 'all' && typeof count === 'number';
        return (
          <TouchableOpacity
            key={z.key}
            onPress={() => onChange(z.key)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
          >
            <Text
              numberOfLines={1}
              style={[styles.label, active ? styles.labelActive : styles.labelInactive]}
            >
              {z.label}
            </Text>
            {showCount ? (
              <Text style={[styles.count, active ? styles.countActive : styles.countInactive]}>
                {count}
              </Text>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
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
  chip: {
    minHeight: 32,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  chipActive: {
    backgroundColor: '#007AFF',
    borderWidth: 0,
  },
  chipInactive: {
    backgroundColor: '#F2F2F7',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.18)',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  labelActive: {
    color: '#FFFFFF',
  },
  labelInactive: {
    color: IOS_COLORS.label,
  },
  count: {
    fontSize: 11,
    fontWeight: '700',
  },
  countActive: {
    color: 'rgba(255,255,255,0.85)',
  },
  countInactive: {
    color: IOS_COLORS.tertiaryLabel,
  },
});
