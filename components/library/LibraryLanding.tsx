/**
 * LibraryLanding — Library tab shell.
 *
 * Layout (post-redesign, 2026-05-28):
 *   • Compact white hero band: "Library" title + segmented pill +
 *     per-zone one-liner description.
 *   • Body renders the active zone (Librarian / Plans / Concepts / Resources).
 *   • Floating TabScreenToolbar overlays the top with search + add.
 *
 * Add (`+`) is context-aware by active zone:
 *   • Librarian / Concepts → open ConceptEditor in create mode
 *   • Resources           → open CaptureSheet
 *   • Plans               → route to Discover Plans (where you subscribe)
 *
 * Drops the old lede paragraph, supporting copy, action buttons, and
 * the 8-card workshop-category grid that sat between the title and
 * the segmented control — those weren't navigating to anything new
 * (every target was already reachable via the tabs or the toolbar).
 */

import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { LocationAnchor } from '@/components/ui/LocationAnchor';
import { TabScreenToolbar } from '@/components/ui/TabScreenToolbar';
import { useUserHomeVenue } from '@/hooks/useUserHomeVenue';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/navigation/FloatingTabBar';
import { AllZone } from '@/components/library/zones/AllZone';
import { PlansZone } from '@/components/library/zones/PlansZone';
import { PeopleZone } from '@/components/library/zones/PeopleZone';
import { ResourcesZone } from '@/components/library/zones/ResourcesZone';
import { LibraryNearbyContent } from '@/components/library/LibraryNearbyContent';
import { CaptureSheet } from '@/components/library/resources/CaptureSheet';
import { ConceptEditor } from '@/components/playbook/concepts/ConceptEditor';
import { mapCapturePayloadToLibraryItem } from '@/components/library/resources/capturePayloadMap';
import { useCreateLibraryItem } from '@/hooks/useCreateLibraryItem';
import { useLibraryCounts } from '@/hooks/useLibraryCounts';
import { usePlaybook } from '@/hooks/usePlaybook';
import { useInterest } from '@/providers/InterestProvider';
import { useVocabulary } from '@/hooks/useVocabulary';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import type { LibraryZone } from '@/components/library/SegmentedZoneHeader';

const VALID_ZONES: LibraryZone[] = [
  'all',
  'nearby',
  'plans',
  'people',
  'concepts',
  'resources',
];
// Title shown atop a focused zone view (reached via a feed See-all).
// 'all' is the curated feed itself, so it has no focused title.
const ZONE_TITLE: Record<LibraryZone, string> = {
  all: 'Library',
  nearby: 'Nearby',
  plans: 'Plans',
  concepts: 'Concepts',
  resources: 'Resources',
  people: 'People',
};

// One-liner shown beneath the focused-zone title. Describes the
// current view, not abstract advertising.
const ZONE_DESCRIPTION: Record<LibraryZone, string> = {
  all: 'Cross-cutting insights the librarian noticed across your library.',
  nearby: 'Curriculum and content from organizations and people around you.',
  plans: 'Subscribed Blueprints you can pull into your own Plan.',
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
  const { vocab } = useVocabulary();
  const { data: counts } = useLibraryCounts(currentInterest?.id);
  const { data: playbook } = usePlaybook(currentInterest?.id);
  const createLibraryItem = useCreateLibraryItem();
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [conceptEditorOpen, setConceptEditorOpen] = useState(false);

  const handleZoneChange = useCallback((next: LibraryZone) => {
    router.setParams({ zone: next === 'all' ? '' : next });
  }, []);

  // `+` payload depends on the active zone. Librarian/Concepts both
  // open the concept editor (concepts are the librarian's domain).
  // Resources opens CaptureSheet. Blueprints routes to Discover (where
  // subscribe lives — Library Blueprints is "your subscribed ones",
  // and adding a new one means subscribing to a published Blueprint).
  const handleAdd = useCallback(() => {
    if (zone === 'resources') {
      setCaptureOpen(true);
      return;
    }
    if (zone === 'plans') {
      router.push('/(tabs)/discover?segment=plans' as never);
      return;
    }
    if (zone === 'all' || zone === 'concepts') {
      if (!playbook?.id || !currentInterest?.id) {
        showAlert(
          'Not ready',
          "Concepts need a playbook + active interest to live in. Switch interests or try again in a moment.",
        );
        return;
      }
      setConceptEditorOpen(true);
      return;
    }
    // Fallback for People (currently no add-affordance defined)
    setCaptureOpen(true);
  }, [zone, playbook?.id, currentInterest?.id]);

  const addLabel =
    zone === 'plans'
      ? 'Find a Blueprint to subscribe'
      : zone === 'resources'
        ? 'Capture a resource'
        : zone === 'concepts' || zone === 'all'
          ? 'Capture a concept'
          : 'Add to library';

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
        {zone === 'all' ? (
          <View style={styles.feedHero}>
            <Text style={styles.feedEyebrow}>LIBRARY</Text>
            <Text style={styles.feedTitle}>What's in your library</Text>
            <Text style={styles.feedSubtitle}>
              Your plans, concepts, and saved material — plus the stacks you
              can pull from.
            </Text>
          </View>
        ) : (
          <View style={styles.focusedHeader}>
            <Pressable
              style={styles.backPill}
              onPress={() => handleZoneChange('all')}
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={16} color={IOS_COLORS.systemBlue} />
              <Text style={styles.backPillText}>Library</Text>
            </Pressable>
            <Text style={styles.focusedTitle}>{ZONE_TITLE[zone]}</Text>
            <Text style={styles.zoneDescription}>
              {zone === 'nearby'
                ? `Curriculum and content from organizations and ${vocab('Peers')} around you.`
                : ZONE_DESCRIPTION[zone]}
            </Text>
          </View>
        )}

        {zone === 'all' ? (
          <AllZone
            counts={counts}
            onJumpToZone={handleZoneChange}
            librarianSlot={librarianSlot}
          />
        ) : zone === 'nearby' ? (
          <LibraryNearbyContent
            homeVenueLat={homeVenue?.lat ?? null}
            homeVenueLng={homeVenue?.lng ?? null}
            homeVenueLabel={homeVenue?.venue ?? homeVenue?.region ?? null}
          />
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
            label: addLabel,
            onPress: handleAdd,
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

      {conceptEditorOpen && playbook?.id && currentInterest?.id ? (
        <ConceptEditor
          mode="create"
          playbookId={playbook.id}
          interestId={currentInterest.id}
          onClose={() => setConceptEditorOpen(false)}
          onSaved={() => setConceptEditorOpen(false)}
        />
      ) : null}
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
  // Curated-feed hero — plain text block in the scroll, matching the
  // Discover front door (no segmented control, no white band).
  feedHero: {
    paddingHorizontal: IOS_SPACING.lg,
    gap: 6,
  },
  feedEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: IOS_COLORS.systemBlue,
  },
  feedTitle: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '800',
    color: IOS_COLORS.label,
  },
  feedSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_COLORS.secondaryLabel,
  },
  // Focused-zone header — back pill + title + description, reached
  // when a feed See-all drills into a single zone.
  focusedHeader: {
    paddingHorizontal: IOS_SPACING.lg,
    gap: 6,
  },
  backPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    marginLeft: -4,
    marginBottom: 2,
  },
  backPillText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
  focusedTitle: {
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
