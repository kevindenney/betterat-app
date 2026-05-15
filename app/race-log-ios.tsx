/**
 * Race Log — iOS register preview
 *
 * Chronological multi-season archive surface, the deeper counterpart to
 * Race Prep cards iOS. Where the cards view shows one season's five steps
 * as a horizontal arc, this is the multi-year archive: every race the user
 * has sailed, grouped by season, scrolled vertically. Same iOS register
 * vocabulary, different temporal scale.
 *
 * Architectural commitments (from the design's side rail):
 *   - Apple Mail thread-list density (~66pt rows), not Books library
 *   - Same four-state grammar (debriefed / in progress / current / planned)
 *     as Race Prep cards iOS — same pill, same colors, same dot
 *   - NO earned-exception treatment on the current entry. This is
 *     navigation, not a decision surface. The Current pill carries state.
 *
 * Wire-up status:
 *   Placeholder for this commit (build-the-component-only):
 *     - Sample data drawn directly from the Claude Design handoff
 *     - Real season/timeline data wiring lands when the Reflect cutover
 *       commit pairs this with Profile iOS in app/(tabs)/reflect.tsx
 *
 * Open at /race-log-ios.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import {
  RaceLogScreen,
  type RaceLogFilterChip,
  type RaceLogSeason,
} from '@/components/ios-register';

interface Props {
  /**
   * When embedded inside the Reflect tab (after cutover), the preview
   * banner and close-X hide, the inner RaceLogScreen suppresses its own
   * "Race Log" title + sub-tab segmented control (the Reflect parent owns
   * both), and the parent screen owns the chrome.
   */
  embedded?: boolean;
  /** Top inset forwarded to the inner ScrollView (e.g. toolbar height). */
  topInset?: number;
  /** Forwarded to the inner ScrollView (e.g. for scroll-driven toolbar hide). */
  onScroll?: React.ComponentProps<typeof ScrollView>['onScroll'];
}

// Sample data drawn from the design handoff's Winter 2025–2026 + Spring 2025
// fixtures. Real timeline data wires in the follow-up Reflect cutover commit.
const SAMPLE_SEASONS: RaceLogSeason[] = [
  {
    id: 'spring-2025',
    name: 'Spring 2025',
    summary: '8 races · all debriefed',
    defaultCollapsed: true,
    entries: [],
  },
  {
    id: 'winter-2025-2026',
    name: 'Winter 2025–2026',
    summary: '5 races · 3 debriefed',
    entries: [
      {
        id: 'win-01',
        num: '01',
        name: 'Christmas Cup',
        dateLabel: 'Dec 14',
        conditionsLabel: 'Steady N · 14 kn',
        status: 'debriefed',
        trailing: { captures: 18 },
        conceptDots: [{}, {}],
      },
      {
        id: 'win-02',
        num: '02',
        name: 'Boxing Day Trophy',
        dateLabel: 'Dec 26',
        conditionsLabel: 'Light & shifty',
        status: 'debriefed',
        trailing: { captures: 9 },
        conceptDots: [{}],
      },
      {
        id: 'win-03',
        num: '03',
        name: 'Lipton Trophy',
        dateLabel: 'Jan 18',
        conditionsLabel: 'Building NE',
        status: 'in_progress',
        trailing: { captures: 12, pending: 'debrief pending' },
        conceptDots: [{}, {}],
      },
      {
        id: 'win-04',
        num: '04',
        name: 'Spring Opener',
        dateLabel: 'Saturday',
        conditionsLabel: '18–22 kn NE',
        status: 'current',
        trailing: { plan: 'plan in draft · 3 beats' },
        conceptDots: [{}, {}],
      },
      {
        id: 'win-05',
        num: '05',
        name: 'Around Lamma',
        dateLabel: 'Feb 22',
        conditionsLabel: 'Forecast pending',
        status: 'planned',
        trailing: { notStarted: true },
        conceptDots: [{ muted: true }],
      },
    ],
  },
];

const SAMPLE_FILTER_CHIPS: RaceLogFilterChip[] = [
  { id: 'all', label: 'All', active: true },
  { id: 'this-year', label: 'This year' },
  { id: 'class-scope', label: 'Dragon · Hong Kong' },
  { id: 'season-picker', label: 'Season', picker: true, icon: 'calendar' },
];

export function RaceLogIosPreview({
  embedded = false,
  topInset,
  onScroll,
}: Props = {}) {
  return (
    <SafeAreaView
      style={styles.page}
      edges={embedded ? ['bottom'] : ['top', 'bottom']}
    >
      {!embedded && <Stack.Screen options={{ headerShown: false }} />}

      {!embedded && (
        <View style={styles.topChrome}>
          <View style={styles.leftPad} />
          <Pressable
            style={styles.glyphBtn}
            hitSlop={8}
            onPress={() => (router.canGoBack() ? router.back() : null)}
            accessibilityLabel="Close iOS preview"
          >
            <Ionicons
              name="close"
              size={22}
              color={IOS_REGISTER.accentUserAction}
            />
          </Pressable>
        </View>
      )}

      {!embedded && <PreviewBanner />}

      <RaceLogScreen
        showChrome={!embedded}
        activeSubTab="race-log"
        filterChips={SAMPLE_FILTER_CHIPS}
        seasons={SAMPLE_SEASONS}
        feedFootHint="Autumn 2024, Summer 2024, Spring 2024 — continues below"
        topInset={topInset}
        onScroll={onScroll}
        onEntryPress={(entry) => {
          // Tap-through to the iOS-register Race Prep detail surface.
          // Sample ids don't resolve to real steps yet; safe-guard with
          // canGoBack so we don't push into a 404 in preview.
          router.push(`/race/ios/${entry.id}` as never);
        }}
      />
    </SafeAreaView>
  );
}

function PreviewBanner() {
  return (
    <View style={styles.banner}>
      <Ionicons
        name="information-circle"
        size={14}
        color={IOS_REGISTER.labelSecondary}
      />
      <Text style={styles.bannerText}>
        Preview: sample seasons drawn from the design handoff. Real timeline
        and season grouping wire in when the Reflect cutover pairs Race Log
        with Profile iOS.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  topChrome: {
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftPad: { width: 22 },
  glyphBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bannerText: {
    flex: 1,
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    lineHeight: 17,
    letterSpacing: -0.05,
  },
});

// Default export for Expo Router (route file). Named export above is for
// the embedded render path that the Reflect cutover commit will wire into
// app/(tabs)/reflect.tsx.
export default RaceLogIosPreview;
