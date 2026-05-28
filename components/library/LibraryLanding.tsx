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

import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { LocationAnchor } from '@/components/ui/LocationAnchor';
import { TabScreenToolbar } from '@/components/ui/TabScreenToolbar';
import { useUserHomeVenue } from '@/hooks/useUserHomeVenue';
import { IOSSegmentedControl } from '@/components/ui/ios/IOSSegmentedControl';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/navigation/FloatingTabBar';
import { WORKSHOP_CATEGORIES } from '@/components/betterat/mockProductLoopData';
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

  const interestName = currentInterest?.name ?? 'your interest';

  const handleZoneChange = useCallback((next: LibraryZone) => {
    router.setParams({ zone: next === 'all' ? '' : next });
  }, []);

  const workshopCategories = useMemo(
    () =>
      WORKSHOP_CATEGORIES.map((category) => ({
        ...category,
        onPress: () => {
          switch (category.target) {
            case 'practice':
            case 'saved-steps':
              router.push('/practice/create' as never);
              break;
            case 'plans':
              handleZoneChange('plans');
              break;
            case 'resources':
              handleZoneChange('resources');
              break;
            case 'concepts':
              handleZoneChange('concepts');
              break;
            case 'network':
              handleZoneChange('people');
              break;
            case 'organizations':
              router.push('/(tabs)/discover?category=organizations' as never);
              break;
            case 'blueprints':
              router.push('/(tabs)/library/blueprints' as never);
              break;
            default:
              break;
          }
        },
      })),
    [handleZoneChange],
  );

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
          {
            paddingTop: toolbarHeight + IOS_SPACING.md,
            paddingBottom: FLOATING_TAB_BAR_HEIGHT + insets.bottom + IOS_SPACING.lg,
          },
        ]}
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Library</Text>
          <Text style={styles.lede}>
            Your library for turning plans, resources, concepts, and people into real-world steps.
          </Text>
          <Text style={styles.supportingCopy}>
            Save resources, shape concepts, follow people, and prepare your next step in{' '}
            <Text style={styles.ledeEm}>{interestName}</Text>.
          </Text>
          <View style={styles.heroActions}>
            <Pressable
              onPress={() => router.push('/practice/create' as never)}
              style={[styles.heroButton, styles.heroButtonPrimary]}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
              <Text style={styles.heroButtonPrimaryText}>Add to Practice</Text>
            </Pressable>
            <Pressable
              onPress={() => setCaptureOpen(true)}
              style={[styles.heroButton, styles.heroButtonSecondary]}
            >
              <Ionicons name="add-outline" size={16} color={IOS_COLORS.label} />
              <Text style={styles.heroButtonSecondaryText}>Capture for Library</Text>
            </Pressable>
          </View>
          <View style={styles.categoryGrid}>
            {workshopCategories.map((category) => (
              <Pressable
                key={category.id}
                onPress={category.onPress}
                style={styles.categoryCard}
              >
                <View style={styles.categoryIcon}>
                  <Ionicons name={category.icon as any} size={16} color={IOS_COLORS.systemBlue} />
                </View>
                <Text style={styles.categoryTitle}>{category.title}</Text>
                <Text style={styles.categoryDescription}>{category.description}</Text>
              </Pressable>
            ))}
          </View>
          <IOSSegmentedControl
            segments={segments}
            selectedValue={zone === 'people' ? 'all' : zone}
            onValueChange={(v) => handleZoneChange(v as LibraryZone)}
          />
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

      {/* Canonical pattern: action row (no title) sits as system chrome
          above a unified white "lib-hero" card. The hero card holds the
          Library title + lede + segmented control so the three read as
          one chunk per canonical §2 — not as three independent floating
          elements on the gray background. */}
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
  // Canonical .lib-hero — full-width white hero band containing the
  // Library title, italic lede, and segmented zone tabs. NOT a floating
  // rounded card — extends edge-to-edge with a hairline bottom border,
  // so the chrome above (gray) → hero (white) → body (gray) reads as
  // three horizontal bands per canonical §2.
  heroCard: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60,60,67,0.15)',
    gap: IOS_SPACING.sm,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: 32,
    color: IOS_COLORS.label,
  },
  lede: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_COLORS.label,
  },
  supportingCopy: {
    fontSize: 13,
    lineHeight: 18,
    color: IOS_COLORS.secondaryLabel,
  },
  ledeEm: {
    fontStyle: 'italic',
  },
  heroActions: {
    flexDirection: 'row',
    gap: 10,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  heroButtonPrimary: {
    backgroundColor: IOS_COLORS.systemBlue,
  },
  heroButtonSecondary: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.18)',
  },
  heroButtonPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroButtonSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryCard: {
    width: '48%',
    borderRadius: 16,
    padding: 12,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.15)',
    gap: 6,
  },
  categoryIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.12)',
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  categoryDescription: {
    fontSize: 12,
    lineHeight: 17,
    color: IOS_COLORS.secondaryLabel,
  },
});
