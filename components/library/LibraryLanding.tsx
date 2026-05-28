/**
 * LibraryLanding — Library tab shell.
 *
 * Layout (post-redesign, 2026-05-28):
 *   • Compact white hero band: "Library" title + segmented pill +
 *     per-zone one-liner description.
 *   • Body renders the active zone (All / Plans / Concepts / Resources).
 *   • Floating TabScreenToolbar overlays the top with search + add.
 *
 * Drops the old lede paragraph, supporting copy, action buttons, and
 * the 8-card workshop-category grid that sat between the title and
 * the segmented control — those weren't navigating to anything new
 * (every target was already reachable via the tabs or the toolbar).
 * The descriptive language from those cards now lives as the per-zone
 * one-liner under the segmented pill, where it actually informs the
 * user about the current view.
 */

import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { LocationAnchor } from '@/components/ui/LocationAnchor';
import { TabScreenToolbar } from '@/components/ui/TabScreenToolbar';
import { useUserHomeVenue } from '@/hooks/useUserHomeVenue';
import { IOSSegmentedControl } from '@/components/ui/ios/IOSSegmentedControl';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/navigation/FloatingTabBar';
import { AllZone } from '@/components/library/zones/AllZone';
import { PlansZone } from '@/components/library/zones/PlansZone';
import { PeopleZone } from '@/components/library/zones/PeopleZone';
import { ResourcesZone } from '@/components/library/zones/ResourcesZone';
import { CaptureSheet } from '@/components/library/resources/CaptureSheet';
import { mapCapturePayloadToLibraryItem } from '@/components/library/resources/capturePayloadMap';
import { useCreateLibraryItem } from '@/hooks/useCreateLibraryItem';
import { useLibraryCounts } from '@/hooks/useLibraryCounts';
import { useInterest } from '@/providers/InterestProvider';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import type { LibraryZone } from '@/components/library/SegmentedZoneHeader';

const VALID_ZONES: LibraryZone[] = ['all', 'plans', 'people', 'concepts', 'resources'];
const SEGMENT_ZONES: { value: LibraryZone; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'plans', label: 'Plans' },
  { value: 'concepts', label: 'Concepts' },
  { value: 'resources', label: 'Resources' },
];

// One-liner shown beneath the segmented pill. Re-uses the language
// from the old workshop-category cards (Plans → "Subscribed structures
// you can pull into practice…"), now positioned where it's actually
// useful — describing the current view, not advertising a card.
const ZONE_DESCRIPTION: Record<LibraryZone, string> = {
  all: "Everything you've saved — plans, concepts, resources, and your notes.",
  plans: 'Subscribed structures you can pull into practice when needed.',
  concepts: "Mental models you're forming, refining, or have settled.",
  resources: 'Saved articles, docs, and references.',
  people: 'People shaping your practice.',
};

interface Props {
  /** Renders the Concepts zone body (Phase 6 PlaybookLanding variants). */
  conceptsBody: React.ReactNode;
  /** Renders above AllZone — the Librarian ask-strip + noticed card.
   * Optional so non-Phase-6 builds still work. */
  librarianSlot?: React.ReactNode;
}

export function LibraryLanding({ conceptsBody, librarianSlot }: Props) {
  const insets = useSafeAreaInsets();
  const homeVenue = useUserHomeVenue();
  const params = useLocalSearchParams<{ zone?: string }>();
  const rawZone = Array.isArray(params.zone) ? params.zone[0] : params.zone;
  const zone: LibraryZone =
    rawZone && (VALID_ZONES as string[]).includes(rawZone)
      ? (rawZone as LibraryZone)
      : 'all';

  const { currentInterest } = useInterest();
  const { data: counts } = useLibraryCounts(currentInterest?.id);
  const createLibraryItem = useCreateLibraryItem();
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const [captureOpen, setCaptureOpen] = useState(false);

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

  const segmentedValue: LibraryZone = zone === 'people' ? 'all' : zone;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.body}
        contentContainerStyle={[
          styles.bodyContent,
          {
            paddingTop: toolbarHeight + IOS_SPACING.md,
            paddingBottom: FLOATING_TAB_BAR_HEIGHT + insets.bottom + IOS_SPACING.lg,
          },
        ]}
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Library</Text>
          <IOSSegmentedControl
            segments={segments}
            selectedValue={segmentedValue}
            onValueChange={(v) => handleZoneChange(v as LibraryZone)}
          />
          <Text style={styles.zoneDescription}>
            {ZONE_DESCRIPTION[segmentedValue]}
          </Text>
        </View>

        {zone === 'all' ? (
          <>
            {librarianSlot}
            <AllZone counts={counts} onJumpToZone={handleZoneChange} />
          </>
        ) : zone === 'plans' ? (
          <PlansZone />
        ) : zone === 'people' ? (
          <PeopleZone />
        ) : zone === 'resources' ? (
          <ResourcesZone onOpenCapture={() => setCaptureOpen(true)} />
        ) : (
          conceptsBody
        )}
      </ScrollView>

      <TabScreenToolbar
        subtitleContent={<LocationAnchor region={homeVenue?.region} venue={homeVenue?.venue} />}
        topInset={insets.top}
        actions={[
          {
            icon: 'search-outline',
            sfSymbol: 'magnifyingglass',
            label: 'Search library',
            onPress: () => router.push('/search?context=library' as never),
          },
          {
            icon: 'add-outline',
            sfSymbol: 'plus',
            label: 'Add to library',
            onPress: () => setCaptureOpen(true),
          },
        ]}
        onMeasuredHeight={setToolbarHeight}
        backgroundColor="rgba(242, 242, 247, 0.94)"
      />

      <CaptureSheet
        visible={captureOpen}
        onClose={() => setCaptureOpen(false)}
        onSave={(payload) => {
          const input = mapCapturePayloadToLibraryItem(
            payload,
            currentInterest?.id,
          );
          if (!input) return;
          createLibraryItem.mutate(input, {
            onError: (err) =>
              showAlert(
                'Capture failed',
                err instanceof Error ? err.message : String(err),
              ),
          });
        }}
      />
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
    // paddingBottom set inline so it can incorporate safe-area + tab bar
  },
  // Full-width white hero band — title + segmented tabs + per-zone
  // description. Edge-to-edge with a hairline bottom so chrome (gray)
  // → hero (white) → body (gray) reads as three horizontal bands.
  heroCard: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.15)',
    gap: 10,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: 30,
    color: IOS_COLORS.label,
  },
  zoneDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: IOS_COLORS.secondaryLabel,
  },
});
