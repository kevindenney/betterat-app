/**
 * StatRow — responsive container for the "N-up stat/KPI strip" pattern.
 *
 * Family-2 of the phone-parity reflow (PHONE_PARITY_PLAN.md). On desktop /
 * iPad it lays its children out as an equal-width single row (unchanged). On
 * phone (compact, < STUDIO_COMPACT_BREAKPOINT) four cards can't fit across,
 * so labels like "ACTIVE SUBSCRIBERS" wrap mid-word. Here we wrap to a grid:
 * `compactColumns` cells per row (default 2; pass 1 for wide cards).
 *
 * It only restyles layout — children keep their own card chrome. Each child
 * is wrapped in a sizing cell so existing `flex: 1` card styles stay valid.
 */

import React, { Children } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { STUDIO_COMPACT_BREAKPOINT } from '@/components/studio/StudioShell';

export function StatRow({
  children,
  gap = 12,
  compactColumns = 2,
  compactScroll = false,
  style,
}: {
  children: React.ReactNode;
  gap?: number;
  compactColumns?: 1 | 2;
  /**
   * On phone, lay the cards out as a single horizontal-scroll strip of
   * fixed-width chips instead of a wrapped grid. Best when there are 3+ stats
   * that are individually low-priority (e.g. a mostly-empty KPI dashboard) —
   * it reclaims the vertical fold for the content below.
   */
  compactScroll?: boolean;
  style?: ViewStyle | ViewStyle[];
}) {
  const { width } = useWindowDimensions();
  const compact = FEATURE_FLAGS.ADMIN_PHONE_PARITY && width < STUDIO_COMPACT_BREAKPOINT;
  const items = Children.toArray(children);

  if (compact && compactScroll) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={style as ViewStyle}
        contentContainerStyle={[styles.scrollContent, { gap }]}
      >
        {items.map((child, i) => (
          <View key={i} style={styles.cellChip}>
            {child}
          </View>
        ))}
      </ScrollView>
    );
  }

  const cellStyle: ViewStyle = compact
    ? compactColumns === 1
      ? styles.cellFull
      : styles.cellHalf
    : styles.cellFlex;

  return (
    <View style={[styles.row, { gap }, compact && styles.wrap, style]}>
      {items.map((child, i) => (
        <View key={i} style={cellStyle}>
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  wrap: { flexWrap: 'wrap' },
  scrollContent: { flexDirection: 'row', paddingRight: 4 },
  // Each cell is itself a row so a child card's `flex: 1` resolves against
  // the cell's WIDTH (its original contract) instead of collapsing its height.
  // ≥600pt — equal-width single row (original behavior).
  cellFlex: { flex: 1, minWidth: 0, flexDirection: 'row' },
  // <600pt, 2-up — two per row, last odd item grows to fill.
  cellHalf: { flexBasis: '47%', flexGrow: 1, minWidth: 0, flexDirection: 'row' },
  // <600pt, 1-up — full width stack.
  cellFull: { flexBasis: '100%', minWidth: 0, flexDirection: 'row' },
  // <600pt, horizontal strip — fixed-width chip the card's `flex: 1` fills.
  cellChip: { width: 150, flexDirection: 'row' },
});
