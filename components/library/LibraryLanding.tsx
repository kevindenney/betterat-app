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
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { LocationAnchor } from '@/components/ui/LocationAnchor';
import { HomeVenuePickerSheet } from '@/components/discover/HomeVenuePickerSheet';
import { TabScreenToolbar } from '@/components/ui/TabScreenToolbar';
import { useUserHomeVenue, isSailingInterest } from '@/hooks/useUserHomeVenue';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/navigation/FloatingTabBar';
import { AllZone } from '@/components/library/zones/AllZone';
import { PlansZone } from '@/components/library/zones/PlansZone';
import { PeopleZone } from '@/components/library/zones/PeopleZone';
import { ResourcesZone } from '@/components/library/zones/ResourcesZone';
import { GroupsZone } from '@/components/library/zones/GroupsZone';
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
import { useToast } from '@/components/ui/AppToast';
import { hapticSuccess } from '@/lib/haptics';
import { StepAddSheet } from '@/components/ios-register/timeline-zoom/StepAddSheet';
import type { LibraryZone } from '@/components/library/SegmentedZoneHeader';

const VALID_ZONES: LibraryZone[] = [
  'all',
  'today',
  'plans',
  'people',
  'concepts',
  'resources',
  'groups',
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
  groups: 'Groups',
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
  groups: 'Fleets, clubs, and cohorts you belong to.',
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
  const toast = useToast();
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const [addChooserOpen, setAddChooserOpen] = useState(false);
  const [stepAddOpen, setStepAddOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [conceptEditorOpen, setConceptEditorOpen] = useState(false);
  const isSailRacing = (currentInterest?.slug ?? '').toLowerCase() === 'sail-racing';
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

  const openConceptEditor = useCallback(() => {
    if (!playbook?.id || !currentInterest?.id) {
      showAlert(
        'Not ready',
        "Concepts need a playbook + active interest to live in. Switch interests or try again in a moment.",
      );
      return;
    }
    setConceptEditorOpen(true);
  }, [playbook?.id, currentInterest?.id]);

  const handleAdd = useCallback(() => {
    setAddChooserOpen(true);
  }, []);

  const addLabel = 'Add to library';

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
            showContextChrome={false}
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
          ) : zone === 'groups' ? (
            <GroupsZone />
          ) : (
            conceptsBody
          )}
        </ScrollView>
      )}

      <TabScreenToolbar
        subtitleContent={
          isSailingInterest(currentInterest?.slug) ? (
            <LocationAnchor
              region={homeVenue?.region}
              venue={homeVenue?.venue}
              onPress={() => setLocationPickerOpen(true)}
            />
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

      <HomeVenuePickerSheet
        visible={locationPickerOpen}
        onDismiss={() => setLocationPickerOpen(false)}
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
            onSuccess: () => {
              hapticSuccess();
              toast.show(
                "Saved — your Librarian will surface this when it's relevant.",
                'success',
              );
            },
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

      <StepAddSheet
        visible={stepAddOpen}
        onClose={() => setStepAddOpen(false)}
        showRaceSelector={isSailRacing}
      />

      <LibraryAddChooser
        visible={addChooserOpen}
        accent={currentInterest?.accent_color ?? IOS_COLORS.systemBlue}
        onClose={() => setAddChooserOpen(false)}
        onNewStep={() => {
          setAddChooserOpen(false);
          setStepAddOpen(true);
        }}
        onNewConcept={() => {
          setAddChooserOpen(false);
          openConceptEditor();
        }}
        onCaptureResource={() => {
          setAddChooserOpen(false);
          setCaptureOpen(true);
        }}
        onFindPlan={() => {
          setAddChooserOpen(false);
          handleZoneChange('follow');
        }}
      />
    </View>
  );
}

function LibraryAddChooser({
  visible,
  accent,
  onClose,
  onNewStep,
  onNewConcept,
  onCaptureResource,
  onFindPlan,
}: {
  visible: boolean;
  accent: string;
  onClose: () => void;
  onNewStep: () => void;
  onNewConcept: () => void;
  onCaptureResource: () => void;
  onFindPlan: () => void;
}) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.addChooserBackdrop} onPress={onClose}>
        <Pressable style={styles.addChooser} onPress={(e) => e.stopPropagation?.()}>
          <View style={styles.addChooserHandle} />
          <View style={styles.addChooserHead}>
            <Text style={styles.addChooserTitle}>Add to Library</Text>
            <Pressable
              style={styles.addChooserClose}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close add menu"
            >
              <Ionicons name="close" size={18} color={IOS_COLORS.systemGray} />
            </Pressable>
          </View>
          <View style={styles.addChooserRows}>
            <AddChoiceRow
              icon="add-circle"
              title="New step"
              subtitle="Plan something to do next."
              accent={accent}
              onPress={onNewStep}
            />
            <AddChoiceRow
              icon="book"
              title="New concept"
              subtitle="Capture a pattern, rule, or thing to remember."
              accent={accent}
              onPress={onNewConcept}
            />
            <AddChoiceRow
              icon="document-attach"
              title="Capture resource"
              subtitle="Save an article, video, note, or file."
              accent={accent}
              onPress={onCaptureResource}
            />
            <AddChoiceRow
              icon="map"
              title="Find a plan"
              subtitle="Follow a published blueprint."
              accent={accent}
              onPress={onFindPlan}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function AddChoiceRow({
  icon,
  title,
  subtitle,
  accent,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
  accent: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={styles.addChoiceRow}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.addChoiceIcon, { backgroundColor: withAlpha(accent, 0.12) }]}>
        <Ionicons name={icon} size={20} color={accent} />
      </View>
      <View style={styles.addChoiceText}>
        <Text style={styles.addChoiceTitle}>{title}</Text>
        <Text style={styles.addChoiceSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={IOS_COLORS.systemGray2} />
    </Pressable>
  );
}

function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
    fontFamily: fontFamily.mono,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: IOS_COLORS.secondaryLabel,
  },
  feedTitle: {
    fontFamily: fontFamily.serif,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '500',
    letterSpacing: -0.4,
    color: IOS_COLORS.label,
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
    fontFamily: fontFamily.serif,
    fontSize: 28,
    fontWeight: '500',
    letterSpacing: -0.4,
    lineHeight: 33,
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
  addChooserBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
    justifyContent: 'flex-end',
  },
  addChooser: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 22,
    backgroundColor: IOS_COLORS.systemBackground,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  addChooserHandle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: IOS_COLORS.systemGray4,
    marginTop: 9,
  },
  addChooserHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  addChooserTitle: {
    fontFamily: fontFamily.serif,
    fontSize: 20,
    fontWeight: '500',
    letterSpacing: -0.3,
    color: IOS_COLORS.label,
  },
  addChooserClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_COLORS.systemGray6,
  },
  addChooserRows: {
    paddingVertical: 6,
  },
  addChoiceRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  addChoiceIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addChoiceText: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    minWidth: 0,
  },
  addChoiceTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: IOS_COLORS.label,
  },
  addChoiceSubtitle: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 17,
    color: IOS_COLORS.secondaryLabel,
  },
});
