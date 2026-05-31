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
import { useUserHomeVenue, isSailingInterest } from '@/hooks/useUserHomeVenue';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/navigation/FloatingTabBar';
import { AllZone } from '@/components/library/zones/AllZone';
import { PlansZone } from '@/components/library/zones/PlansZone';
import { PeopleZone } from '@/components/library/zones/PeopleZone';
import { ResourcesZone } from '@/components/library/zones/ResourcesZone';
import { DiscoverPlansContent } from '@/components/discover/DiscoverPlansContent';
import { DiscoverOrgsContent } from '@/components/discover/DiscoverOrgsContent';
import { DiscoverInterestsContent } from '@/components/discover/DiscoverInterestsContent';
import { DiscoverTodayContent } from '@/components/discover/DiscoverTodayContent';
import { CaptureSheet } from '@/components/library/resources/CaptureSheet';
import { ConceptEditor } from '@/components/playbook/concepts/ConceptEditor';
import { mapCapturePayloadToLibraryItem } from '@/components/library/resources/capturePayloadMap';
import { useCreateLibraryItem } from '@/hooks/useCreateLibraryItem';
import { useLibraryCounts } from '@/hooks/useLibraryCounts';
import { usePlaybook } from '@/hooks/usePlaybook';
import { useInterest } from '@/providers/InterestProvider';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import type { LibraryZone } from '@/components/library/SegmentedZoneHeader';

const VALID_ZONES: LibraryZone[] = [
  'all',
  'today',
  'plans',
  'people',
  'concepts',
  'resources',
  'follow',
  'orgs',
  'interests',
];
// Zones that render full-bleed (they own their own ScrollView) instead
// of inside LibraryLanding's shared ScrollView. These are the Discover
// "stacks" content components folded into Library — nesting a same-axis
// ScrollView inside ours clips their content, so they sit on top with a
// floating back pill (mirrors the discover.tsx focused-segment pattern).
const FULL_BLEED_ZONES: LibraryZone[] = ['today', 'follow', 'orgs', 'interests'];
// Title shown atop a focused zone view (reached via a feed See-all).
// 'all' is the curated feed itself, so it has no focused title.
const ZONE_TITLE: Record<LibraryZone, string> = {
  all: 'Library',
  today: 'This week',
  plans: 'Plans',
  concepts: 'Concepts',
  resources: 'Resources',
  people: 'People',
  follow: 'Plans to follow',
  orgs: 'Orgs',
  interests: 'Interests',
};

// One-liner shown beneath the focused-zone title. Describes the
// current view, not abstract advertising.
const ZONE_DESCRIPTION: Record<LibraryZone, string> = {
  all: 'Cross-cutting insights the librarian noticed across your library.',
  today: "What's worth your attention this week across your crafts.",
  plans: 'Subscribed Blueprints you can pull into your own Plan.',
  concepts: "Mental models you're forming, refining, or have settled.",
  resources: 'Saved articles, docs, and references.',
  people: 'People shaping your practice.',
  follow: 'Published Plans you can follow and pull into your own.',
  orgs: 'Clubs, schools, and programs you can join.',
  interests: 'Adjacent crafts you could add.',
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
  const { data: playbook } = usePlaybook(currentInterest?.id);
  const createLibraryItem = useCreateLibraryItem();
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [conceptEditorOpen, setConceptEditorOpen] = useState(false);
  // Sticky "added" set for the Interests stack so its Add chips stay
  // marked while the user is in the focused zone (mirrors discover.tsx).
  const [addedInterestSlugs, setAddedInterestSlugs] = useState<Set<string>>(new Set());
  const onAddInterest = useCallback((slug: string) => {
    setAddedInterestSlugs((prev) => {
      const next = new Set(prev);
      next.add(slug);
      return next;
    });
  }, []);

  const handleZoneChange = useCallback((next: LibraryZone) => {
    router.setParams({ zone: next === 'all' ? '' : next });
  }, []);

  const isFullBleed = (FULL_BLEED_ZONES as string[]).includes(zone);

  // `+` payload depends on the active zone. Librarian/Concepts both
  // open the concept editor (concepts are the librarian's domain).
  // Resources opens CaptureSheet. Plans jumps to the "Plans to follow"
  // stack (Library's subscribe surface — Library Plans is "your
  // subscribed ones", and adding one means following a published Plan).
  const handleAdd = useCallback(() => {
    if (zone === 'resources') {
      setCaptureOpen(true);
      return;
    }
    if (zone === 'plans') {
      handleZoneChange('follow');
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
  }, [zone, playbook?.id, currentInterest?.id, handleZoneChange]);

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
      {isFullBleed ? (
        zone === 'today' ? (
          <DiscoverTodayContent toolbarOffset={toolbarHeight + 48} />
        ) : zone === 'follow' ? (
          <DiscoverPlansContent toolbarOffset={toolbarHeight + 48} />
        ) : zone === 'orgs' ? (
          <DiscoverOrgsContent toolbarOffset={toolbarHeight + 48} />
        ) : (
          <DiscoverInterestsContent
            toolbarOffset={toolbarHeight + 48}
            addedInterestSlugs={addedInterestSlugs}
            onAddInterest={onAddInterest}
          />
        )
      ) : (
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
            <Text style={styles.zoneDescription}>{ZONE_DESCRIPTION[zone]}</Text>
          </View>
        )}

        {zone === 'all' ? (
          <AllZone
            counts={counts}
            onJumpToZone={handleZoneChange}
            librarianSlot={librarianSlot}
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
      )}

      <TabScreenToolbar
        subtitleContent={
          isSailingInterest(currentInterest?.slug) ? (
            <LocationAnchor region={homeVenue?.region} venue={homeVenue?.venue} />
          ) : undefined
        }
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

      {/* Full-bleed stack zones own their scroll, so the back-to-feed
          affordance floats below the toolbar instead of scrolling with
          a header (mirrors the discover.tsx focused-segment pattern). */}
      {isFullBleed ? (
        <View
          style={[styles.floatingBackHeader, { top: toolbarHeight + 4 }]}
          pointerEvents="box-none"
        >
          <Pressable
            style={styles.floatingBackPill}
            onPress={() => handleZoneChange('all')}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={16} color={IOS_COLORS.systemBlue} />
            <Text style={styles.backPillText}>Library</Text>
          </Pressable>
        </View>
      ) : null}

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
  // Floating back pill for full-bleed stack zones (follow/orgs/interests)
  // whose content owns its own scroll view.
  floatingBackHeader: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'flex-start',
    paddingHorizontal: 16,
  },
  floatingBackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(242, 242, 247, 0.94)',
  },
});
