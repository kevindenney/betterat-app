/**
 * LibraryLanding — Library tab shell.
 *
 * Top chrome matches the standard tab pattern used elsewhere in the app
 * (TabScreenToolbar): interest switcher + search + universal-plus +
 * profile avatar on the right; "Library" large title on the left with
 * the canonical "Your understanding of X — refined." lede.
 *
 * Below the toolbar, an iOS-style segmented pill switches between four
 * zones (All / Plans / Concepts / Resources) per canonical §2. The
 * People zone route still exists for cross-links but is no longer in
 * the segmented strip.
 */

import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { TabScreenToolbar } from '@/components/ui/TabScreenToolbar';
import { IOSSegmentedControl } from '@/components/ui/ios/IOSSegmentedControl';
import { useUniversalPlus } from '@/components/capture';
import { AllZone } from '@/components/library/zones/AllZone';
import { PlansZone } from '@/components/library/zones/PlansZone';
import { PeopleZone } from '@/components/library/zones/PeopleZone';
import { ResourcesZone } from '@/components/library/zones/ResourcesZone';
import { useLibraryCounts } from '@/hooks/useLibraryCounts';
import { useInterest } from '@/providers/InterestProvider';
import type { LibraryZone } from '@/components/library/SegmentedZoneHeader';

const VALID_ZONES: LibraryZone[] = ['all', 'plans', 'people', 'concepts', 'resources'];
const SEGMENT_ZONES: { value: LibraryZone; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'plans', label: 'Plans' },
  { value: 'concepts', label: 'Concepts' },
  { value: 'resources', label: 'Resources' },
];

interface Props {
  /** Renders the Concepts zone body (Phase 6 PlaybookLanding variants). */
  conceptsBody: React.ReactNode;
}

export function LibraryLanding({ conceptsBody }: Props) {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ zone?: string }>();
  const rawZone = Array.isArray(params.zone) ? params.zone[0] : params.zone;
  const zone: LibraryZone =
    rawZone && (VALID_ZONES as string[]).includes(rawZone)
      ? (rawZone as LibraryZone)
      : 'all';

  const { currentInterest } = useInterest();
  const { data: counts } = useLibraryCounts(currentInterest?.id);
  const universalPlus = useUniversalPlus();
  const [toolbarHeight, setToolbarHeight] = useState(0);

  const interestName = currentInterest?.name ?? 'your interest';

  const handleZoneChange = useCallback((next: LibraryZone) => {
    router.setParams({ zone: next === 'all' ? '' : next });
  }, []);

  // Per canonical the count renders inline with the label as a quiet
  // suffix ("Plans 3"), not the coral notification badge IOSSegmentedControl
  // exposes via `badge` (which is reserved for marked-content counts).
  const segments = SEGMENT_ZONES.map((s) => {
    const count = s.value !== 'all' ? counts?.[s.value] : undefined;
    return {
      value: s.value,
      label: s.label,
      count,
    };
  });

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.body}
        contentContainerStyle={[
          styles.bodyContent,
          { paddingTop: toolbarHeight + IOS_SPACING.md },
        ]}
      >
        {zone === 'all' ? (
          <AllZone counts={counts} onJumpToZone={handleZoneChange} />
        ) : zone === 'plans' ? (
          <PlansZone />
        ) : zone === 'people' ? (
          <PeopleZone />
        ) : zone === 'resources' ? (
          <ResourcesZone />
        ) : (
          conceptsBody
        )}
      </ScrollView>

      <TabScreenToolbar
        title="Library"
        largeTitleBelow
        interestSwitcherLeft
        subtitleContent={
          // Canonical italicizes only the interest name, not the whole
          // sentence: "Your understanding of *sail racing* — refined."
          <Text style={styles.lede}>
            Your understanding of <Text style={styles.ledeEm}>{interestName}</Text> — refined.
          </Text>
        }
        topInset={insets.top}
        actions={[
          {
            icon: 'search-outline',
            sfSymbol: 'magnifyingglass',
            label: 'Search library',
            onPress: () => router.push('/search?context=library' as never),
          },
          ...(universalPlus.isAvailable
            ? [
                {
                  icon: 'add-outline',
                  sfSymbol: 'plus',
                  label: 'Add',
                  onPress: () => universalPlus.open(),
                },
              ]
            : []),
        ]}
        onMeasuredHeight={setToolbarHeight}
        backgroundColor="rgba(242, 242, 247, 0.94)"
      >
        <View style={styles.segmentCard}>
          <IOSSegmentedControl
            segments={segments}
            selectedValue={zone === 'people' ? 'all' : zone}
            onValueChange={(v) => handleZoneChange(v as LibraryZone)}
          />
        </View>
      </TabScreenToolbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingBottom: IOS_SPACING.xl,
  },
  lede: {
    fontSize: 13,
    lineHeight: 18,
    color: IOS_COLORS.secondaryLabel,
  },
  ledeEm: {
    fontStyle: 'italic',
  },
  // White container wrapping the segmented zone tabs — gives the
  // "Library + four tabs in a single card" feel from the canonical mock.
  segmentCard: {
    marginHorizontal: IOS_SPACING.lg,
    marginTop: IOS_SPACING.sm,
    marginBottom: IOS_SPACING.md,
    paddingHorizontal: IOS_SPACING.sm,
    paddingVertical: IOS_SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.15)',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
});
