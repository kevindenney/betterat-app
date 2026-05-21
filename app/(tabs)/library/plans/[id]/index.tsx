/**
 * Plan detail · /library/plans/[id]
 *
 * Wave 2b: Steps / Subscribers / Resources tabs per canonical §3.
 * Steps tab uses HorizontalTimeline in non-editable mode with adopt CTAs.
 * Subscribers + Resources read mock data for now; DB wiring follows.
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { HorizontalTimeline } from '@/components/timeline/HorizontalTimeline';
import type { StepCardH } from '@/components/timeline/types';
import { PlanHero } from '@/components/library/plans/PlanHero';
import { PlanTabsBar, type PlanTabKey } from '@/components/library/plans/PlanTabsBar';
import { SubscriberRow } from '@/components/library/plans/SubscriberRow';
import { PlanResourceCard } from '@/components/library/plans/PlanResourceCard';
import type {
  PlanResourceRow,
  PlanSummary,
  SubscriberRow as SubscriberRowData,
} from '@/components/library/plans/types';
import { usePlanDetail } from '@/hooks/usePlanDetail';

const HKDW_PLAN: PlanSummary = {
  id: 'hkdw-2027',
  title: '"Hong Kong Dragon Worlds 2027 — prep plan"',
  authorName: 'Kevin Ho',
  authorInitials: 'KH',
  authorRole: 'Coach',
  stepCount: 12,
  subscriberCount: 63,
  resourceCount: 8,
  meta: '63 sailors · 17 from RHKYC · 4 boats from your fleet',
};

const HKDW_STEPS: StepCardH[] = [
  {
    id: 'hkdw-1',
    title: '"Boat & rig audit — pre-season."',
    stepNumber: 1,
    totalSteps: 12,
    state: 'done',
    pillLabel: 'Done',
    meta: 'Mar 18 · 4 captures',
    phaseDots: ['full', 'full', 'full'],
  },
  {
    id: 'hkdw-2',
    title: '"Crew callup & roles."',
    stepNumber: 2,
    totalSteps: 12,
    state: 'done',
    pillLabel: 'Done',
    meta: 'Mar 30 · 2 captures',
    phaseDots: ['full', 'full', 'full'],
  },
  {
    id: 'hkdw-3',
    title: '"Light-air starts — basics."',
    stepNumber: 3,
    totalSteps: 12,
    state: 'done',
    pillLabel: 'Done',
    meta: 'Apr 19 · 1 trophy',
    phaseDots: ['full', 'full', 'full'],
  },
  {
    id: 'hkdw-4',
    title: '"Pre-start lane choice in shifty breeze."',
    stepNumber: 4,
    totalSteps: 12,
    state: 'current',
    pillLabel: 'Now',
    meta: 'Today · Race 4',
    phaseDots: ['full', 'half', 'empty'],
  },
  {
    id: 'hkdw-5',
    title: '"Heavy-air upwind technique — 18+ kn."',
    stepNumber: 5,
    totalSteps: 12,
    state: 'next',
    pillLabel: 'Next',
    meta: 'Week 6',
    phaseDots: ['empty', 'empty', 'empty'],
  },
  {
    id: 'hkdw-6',
    title: '"Mark roundings — 6-boat set."',
    stepNumber: 6,
    totalSteps: 12,
    state: 'next',
    pillLabel: 'Next',
    meta: 'Week 7',
    phaseDots: ['empty', 'empty', 'empty'],
  },
  {
    id: 'hkdw-7',
    title: '"Tactics — top-of-beat fleet management."',
    stepNumber: 7,
    totalSteps: 12,
    state: 'next',
    pillLabel: 'Next',
    meta: 'Week 8',
    phaseDots: ['empty', 'empty', 'empty'],
  },
];

const HKDW_SUBSCRIBERS: SubscriberRowData[] = [
  {
    id: 'pl',
    name: 'Phyl Loong',
    initials: 'PL',
    where: 'RHKYC',
    boat: 'Moonraker',
    currentStepLabel: 'Step 7 · Tactics — fleet-management',
    currentStepNumber: 7,
    totalSteps: 12,
    progressPct: 58,
  },
  {
    id: 'jk',
    name: 'James Kwok',
    initials: 'JK',
    where: 'ABC',
    boat: 'Wind Dancer',
    currentStepLabel: 'Step 5 · Heavy-air upwind',
    currentStepNumber: 5,
    totalSteps: 12,
    progressPct: 42,
  },
  {
    id: 'sc',
    name: 'Sam Cooke',
    initials: 'SC',
    where: 'RHKYC',
    boat: 'Thistle',
    currentStepLabel: 'Step 9 · Mark roundings',
    currentStepNumber: 9,
    totalSteps: 12,
    progressPct: 75,
  },
  {
    id: 'rm',
    name: 'Rohan Mehta',
    initials: 'RM',
    where: 'RHKYC',
    boat: 'Blue Note',
    currentStepLabel: 'Step 4 · Pre-start lanes · with you',
    currentStepNumber: 4,
    totalSteps: 12,
    progressPct: 33,
  },
  {
    id: 'ty',
    name: 'Tina Yip',
    initials: 'TY',
    where: 'HHYC',
    boat: 'Wraith',
    currentStepLabel: 'Step 2 · Crew callup',
    currentStepNumber: 2,
    totalSteps: 12,
    progressPct: 16,
  },
  {
    id: 'eg',
    name: 'Emma Greene',
    initials: 'EG',
    where: 'ABC',
    boat: 'Halcyon',
    currentStepLabel: 'Step 6 · Mark roundings',
    currentStepNumber: 6,
    totalSteps: 12,
    progressPct: 50,
  },
];

const HKDW_RESOURCES: PlanResourceRow[] = [
  {
    id: 'r1',
    kind: 'video',
    title: '"Reading the Victoria Harbor shift cycle"',
    durationMin: 22,
    linkedStepNumber: 4,
  },
  {
    id: 'r2',
    kind: 'article',
    title: 'North Sails · "Dragon mainsail trim — 18+ kn"',
    durationMin: 8,
    linkedStepNumber: 5,
  },
  {
    id: 'r3',
    kind: 'video',
    title: '"Pre-start lane choice — 14-boat fleet drone"',
    durationMin: 11,
    linkedStepNumber: 4,
  },
  {
    id: 'r4',
    kind: 'article',
    title: 'RHKYC · "Tide tables & current charts — Repulse Bay"',
    durationMin: 4,
    linkedStepNumber: 7,
  },
  {
    id: 'r5',
    kind: 'drill',
    title: 'Mark-rounding pressure drill — 6-boat set',
    durationMin: 25,
    linkedStepNumber: 6,
  },
  {
    id: 'r6',
    kind: 'video',
    title: '"Downwind in waves — Dragon fleet footage"',
    durationMin: 17,
    linkedStepNumber: 8,
  },
  {
    id: 'r7',
    kind: 'article',
    title: '"Dragon class rules · Worlds 2027 update"',
    durationMin: 12,
    linkedStepNumber: 1,
  },
  {
    id: 'r8',
    kind: 'drill',
    title: 'Crew handoff drill · windward-leeward set',
    durationMin: 30,
    linkedStepNumber: 2,
  },
];

const VALID_TABS: PlanTabKey[] = ['steps', 'subscribers', 'resources'];

export default function PlanDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; tab?: string }>();
  const paramTab: PlanTabKey =
    params.tab && (VALID_TABS as string[]).includes(params.tab)
      ? (params.tab as PlanTabKey)
      : 'steps';
  const [activeTab, setActiveTab] = useState<PlanTabKey>(paramTab);

  // React to deep-link ?tab= changes when already mounted.
  useEffect(() => {
    if (paramTab !== activeTab) setActiveTab(paramTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramTab]);

  const planId = typeof params.id === 'string' ? params.id : undefined;
  const { data: detail, isLoading } = usePlanDetail(planId);

  // Mock dataset is kept around only for the no-id debug route; real
  // route hits always render the DB-backed plan or a "not found" card.
  const isDemoRoute = !planId;
  const plan: PlanSummary | undefined = detail?.plan ?? (isDemoRoute ? HKDW_PLAN : undefined);
  const steps: StepCardH[] = detail?.steps ?? (isDemoRoute ? HKDW_STEPS : []);
  const subscribers: SubscriberRowData[] =
    detail?.subscribers ?? (isDemoRoute ? HKDW_SUBSCRIBERS : []);
  const resources: PlanResourceRow[] =
    detail?.resources ?? (isDemoRoute ? HKDW_RESOURCES : []);

  // Real route with a resolved id but no DB row → show a not-found card.
  if (!isDemoRoute && !isLoading && !plan) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View
          style={[
            styles.container,
            { paddingTop: insets.top },
          ]}
        >
          <View style={styles.topbar}>
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/library'))}
              hitSlop={8}
              style={styles.backBtn}
            >
              <Ionicons name="chevron-back" size={20} color="#007AFF" />
              <Text style={styles.backText}>Library</Text>
            </Pressable>
          </View>
          <View style={styles.notFoundCard}>
            <Ionicons name="map-outline" size={28} color={IOS_COLORS.tertiaryLabel} />
            <Text style={styles.notFoundTitle}>Plan not found</Text>
            <Text style={styles.notFoundBlurb}>
              This plan may have been removed, or you no longer have access to it.
            </Text>
          </View>
        </View>
      </>
    );
  }

  if (!plan) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View
          style={[
            styles.container,
            { paddingTop: insets.top },
          ]}
        >
          <View style={styles.bodyCentered}>
            <ActivityIndicator color={IOS_COLORS.tertiaryLabel} />
          </View>
        </View>
      </>
    );
  }

  const counts = {
    steps: plan.stepCount,
    subscribers: plan.subscriberCount,
    resources: plan.resourceCount,
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={[
          styles.container,
          { paddingTop: insets.top },
        ]}
      >
        <View style={styles.topbar}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/library'))}
            hitSlop={8}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={20} color="#007AFF" />
            <Text style={styles.backText}>Library</Text>
          </Pressable>
          <View style={styles.topbarRight}>
            <Ionicons name="share-outline" size={20} color="#007AFF" />
            <Ionicons name="ellipsis-horizontal" size={20} color="#007AFF" />
          </View>
        </View>

        <PlanHero plan={plan} />

        <PlanTabsBar active={activeTab} counts={counts} onChange={setActiveTab} />

        {planId && isLoading && !detail ? (
          <View style={styles.bodyCentered}>
            <ActivityIndicator color={IOS_COLORS.tertiaryLabel} />
          </View>
        ) : activeTab === 'steps' ? (
          <ScrollView style={styles.body}>
            <View style={styles.stepsHint}>
              <Text style={styles.stepsHintText}>
                Tap a step to view {plan.authorName ? `${plan.authorName}'s` : "the author's"} plan/do/reflect notes, or + Add to your timeline.
              </Text>
            </View>
            <HorizontalTimeline
              cards={steps}
              showAdopt
              onAdopt={(stepId) => {
                // TODO: wire blueprint-step adopt action; placeholder routes
                // to the source step so the user can read it for now.
                router.push(`/step/${stepId}` as never);
              }}
              onCardPress={(card) => {
                router.push(`/step/${card.id}` as never);
              }}
            />
          </ScrollView>
        ) : activeTab === 'subscribers' ? (
          <ScrollView style={styles.body}>
            {subscribers.length === 0 ? (
              <Text style={styles.emptyText}>
                No other subscribers yet. You'll be in good company once others join.
              </Text>
            ) : (
              subscribers.map((s) => (
                <SubscriberRow
                  key={s.id}
                  row={s}
                  onPress={() => router.push(`/sailor/${s.id}` as never)}
                />
              ))
            )}
          </ScrollView>
        ) : (
          <ScrollView style={styles.body}>
            {resources.length === 0 ? (
              <Text style={styles.emptyText}>
                {plan.authorName} hasn't bundled materials with this plan yet.
              </Text>
            ) : (
              resources.map((r) => (
                <PlanResourceCard
                  key={r.id}
                  row={r}
                  onPress={() => router.push(`/(tabs)/library/items/${r.id}` as never)}
                />
              ))
            )}
          </ScrollView>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    backgroundColor: IOS_COLORS.systemBackground,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  backText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#007AFF',
  },
  topbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.md,
  },
  body: {
    flex: 1,
  },
  bodyCentered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepsHint: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: IOS_SPACING.sm,
    paddingBottom: IOS_SPACING.xs,
    gap: 2,
  },
  stepsHintText: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_COLORS.secondaryLabel,
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.xl,
    textAlign: 'center',
  },
  notFoundCard: {
    margin: IOS_SPACING.md,
    padding: IOS_SPACING.lg,
    borderRadius: 14,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    alignItems: 'center',
    gap: IOS_SPACING.sm,
  },
  notFoundTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  notFoundBlurb: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
  },
});
