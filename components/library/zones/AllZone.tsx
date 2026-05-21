/**
 * <AllZone> — Library "All" zone landing.
 *
 * Renders four condensed sections top-down per canonical §2/§6:
 *   1. Plans     (paths you're walking)
 *   2. People    (who you're walking near)
 *   3. Concepts  (what you understand)
 *   4. Resources (what you've kept)
 *
 * Each section has a heading row with a colored dot, a title, and a
 * "See all N →" link that flips the segmented header to that zone.
 *
 * For now bodies are slim placeholders pointing at the dedicated zone
 * (Plans / People zones are not yet built; Concepts + Resources have
 * full landings the user can jump to via "See all"). Once the per-zone
 * landings ship, this component will inline the first 2–3 rows of each.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import type { LibraryZone } from '@/components/library/SegmentedZoneHeader';

interface AllZoneProps {
  counts?: Partial<Record<LibraryZone, number>>;
  onJumpToZone: (zone: LibraryZone) => void;
}

interface SectionProps {
  title: string;
  dotColor: string;
  count?: number;
  hint: string;
  onSeeAll: () => void;
}

function Section({ title, dotColor, count, hint, onSeeAll }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={styles.headLeft}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          <Text style={styles.title}>{title}</Text>
        </View>
        <Pressable
          onPress={onSeeAll}
          accessibilityRole="link"
          accessibilityLabel={`See all ${title}`}
          style={styles.seeAllBtn}
        >
          <Text style={styles.seeAllText}>
            {typeof count === 'number' ? `See all ${count}` : 'See all'}
          </Text>
          <Ionicons name="chevron-forward" size={12} color={IOS_COLORS.tertiaryLabel} />
        </Pressable>
      </View>
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

export function AllZone({ counts, onJumpToZone }: AllZoneProps) {
  return (
    <View style={styles.container}>
      <Section
        title="Plans"
        dotColor="#3B82F6"
        count={counts?.plans}
        hint="Coach-bundled paths you're walking. Tap to see your subscriptions."
        onSeeAll={() => onJumpToZone('plans')}
      />
      <Section
        title="People"
        dotColor="#8B5CF6"
        count={counts?.people}
        hint="Sailors and coaches whose timelines you follow."
        onSeeAll={() => onJumpToZone('people')}
      />
      <Section
        title="Concepts"
        dotColor="#A855F7"
        count={counts?.concepts}
        hint="Insights forming into testable beliefs."
        onSeeAll={() => onJumpToZone('concepts')}
      />
      <Section
        title="Resources"
        dotColor="#F59E0B"
        count={counts?.resources}
        hint="Articles, videos, drills you've saved to come back to."
        onSeeAll={() => onJumpToZone('resources')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: IOS_SPACING.sm,
    gap: IOS_SPACING.sm,
  },
  section: {
    marginHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.md,
    paddingHorizontal: IOS_SPACING.md,
    borderRadius: 14,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    gap: 6,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  seeAllText: {
    fontSize: 13,
    color: IOS_COLORS.systemBlue,
    fontWeight: '500',
  },
  hint: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 18,
  },
});
