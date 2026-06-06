/**
 * WatchFilterRow — a horizontal-scroll, single-select chip row used as the
 * secondary filter under each Watch lens (People / Nearby / Groups).
 *
 * Chips come in two flavours that render in one scrollable row:
 *   - category chips (text only, e.g. "All", "Following", "From blueprints")
 *   - entity chips (a small avatar + label, e.g. a person or a group)
 * A hairline divider is drawn before the first entity chip so the two
 * groups read as distinct without a second row.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';

export interface WatchFilterChip {
  id: string;
  label: string;
  /** When set, renders a small avatar before the label. */
  avatar?: { text: string; color: string };
}

interface WatchFilterRowProps {
  /** Text-only chips (rendered first). */
  categories: WatchFilterChip[];
  /** Avatar chips (rendered after a divider). Optional. */
  entities?: WatchFilterChip[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function WatchFilterRow({
  categories,
  entities = [],
  selectedId,
  onSelect,
}: WatchFilterRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      {categories.map((chip) => (
        <FilterChip
          key={chip.id}
          chip={chip}
          active={chip.id === selectedId}
          onPress={() => onSelect(chip.id)}
        />
      ))}
      {entities.length > 0 ? <View style={styles.divider} /> : null}
      {entities.map((chip) => (
        <FilterChip
          key={chip.id}
          chip={chip}
          active={chip.id === selectedId}
          onPress={() => onSelect(chip.id)}
        />
      ))}
    </ScrollView>
  );
}

function FilterChip({
  chip,
  active,
  onPress,
}: {
  chip: WatchFilterChip;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, chip.avatar && styles.chipWithAvatar, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      {chip.avatar ? (
        <View style={[styles.chipAvatar, { backgroundColor: chip.avatar.color }]}>
          <Text style={styles.chipAvatarText}>{chip.avatar.text}</Text>
        </View>
      ) : null}
      <Text
        style={[styles.chipText, active && styles.chipTextActive]}
        numberOfLines={1}
      >
        {chip.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: {
    marginBottom: IOS_SPACING.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: IOS_SPACING.lg,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 4,
    backgroundColor: 'rgba(60,60,67,0.18)',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.10)',
  },
  chipWithAvatar: {
    paddingLeft: 6,
  },
  chipActive: {
    backgroundColor: '#DCEAFE',
    borderColor: 'transparent',
  },
  chipAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chipAvatarText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  chipTextActive: {
    color: IOS_COLORS.systemBlue,
  },
});

export default WatchFilterRow;
