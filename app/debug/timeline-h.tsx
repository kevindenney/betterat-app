/**
 * /debug/timeline-h — Wave 2a smoke route for HorizontalTimeline.
 * Renders three demo instances per fast-path Wave 2a:
 *   - Your own (editable=true)
 *   - Phyl's subscriber timeline (scoped to plan, showAdopt=true)
 *   - James's followee timeline (whole timeline, showAdopt=true)
 */

import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { HorizontalTimeline } from '@/components/timeline/HorizontalTimeline';
import type { StepCardH } from '@/components/timeline/types';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';

const YOUR_STEPS_INITIAL: StepCardH[] = [
  {
    id: 'you-1',
    title: '"Boat & rig audit — pre-season."',
    stepNumber: 1,
    totalSteps: 12,
    state: 'done',
    pillLabel: 'Done',
    meta: 'Settled · Mar 18 · 4 captures',
    phaseDots: ['full', 'full', 'full'],
    stripeColor: '#1E63D6',
    planTag: 'HKDW · STEP 1 / 12',
  },
  {
    id: 'you-2',
    title: '"Crew callup & roles."',
    stepNumber: 2,
    totalSteps: 12,
    state: 'done',
    pillLabel: 'Done',
    meta: 'Settled · Mar 30 · 2 captures',
    phaseDots: ['full', 'full', 'full'],
    stripeColor: '#1E63D6',
    planTag: 'HKDW · STEP 2 / 12',
  },
  {
    id: 'you-3',
    title: '"Light-air starts — basics."',
    stepNumber: 3,
    totalSteps: 12,
    state: 'done',
    pillLabel: 'Done',
    meta: 'Settled · Apr 19 · 1 trophy',
    phaseDots: ['full', 'full', 'full'],
    stripeColor: '#1E63D6',
    planTag: 'HKDW · STEP 3 / 12',
  },
  {
    id: 'you-4',
    title: '"Pre-start lane choice in shifty breeze."',
    stepNumber: 4,
    totalSteps: 12,
    state: 'current',
    pillLabel: 'In Progress',
    meta: 'Today · Race 4 · Plan ✓ · Do…',
    phaseDots: ['full', 'half', 'empty'],
    stripeColor: '#1E63D6',
    planTag: 'HKDW · STEP 4 / 12',
  },
  {
    id: 'you-5',
    title: '"Heavy-air upwind technique — 18+ kn."',
    stepNumber: 5,
    totalSteps: 12,
    state: 'next',
    pillLabel: 'Up Next',
    meta: 'Planned · Week 6',
    phaseDots: ['empty', 'empty', 'empty'],
    stripeColor: '#1E63D6',
    planTag: 'HKDW · STEP 5 / 12',
  },
  {
    id: 'you-6',
    title: '"Mark roundings — 6-boat set."',
    stepNumber: 6,
    totalSteps: 12,
    state: 'next',
    pillLabel: 'Up Next',
    meta: 'Planned · Week 7',
    phaseDots: ['empty', 'empty', 'empty'],
    stripeColor: '#1E63D6',
    planTag: 'HKDW · STEP 6 / 12',
  },
];

const PHYL_STEPS: StepCardH[] = [
  {
    id: 'phyl-1',
    title: '"Boat & rig audit — pre-season."',
    stepNumber: 1,
    totalSteps: 12,
    state: 'done',
    pillLabel: 'Done',
    meta: 'Settled · Mar 18 · 4 captures',
    phaseDots: ['full', 'full', 'full'],
  },
  {
    id: 'phyl-2',
    title: '"Crew callup & roles."',
    stepNumber: 2,
    totalSteps: 12,
    state: 'done',
    pillLabel: 'Done',
    meta: 'Settled · Mar 30 · 2 captures',
    phaseDots: ['full', 'full', 'full'],
  },
  {
    id: 'phyl-3',
    title: '"Light-air starts — basics."',
    stepNumber: 3,
    totalSteps: 12,
    state: 'done',
    pillLabel: 'Done',
    meta: 'Settled · Apr 19 · 1 trophy',
    phaseDots: ['full', 'full', 'full'],
  },
  {
    id: 'phyl-4',
    title: '"Pick the favored end. Bail without losing a length."',
    stepNumber: 4,
    totalSteps: 12,
    state: 'done',
    pillLabel: 'Done',
    meta: 'Settled · Apr 27 · 3 ideas saved by 4 sailors',
    phaseDots: ['full', 'full', 'full'],
  },
  {
    id: 'phyl-5',
    title: '"Heavy-air upwind."',
    stepNumber: 5,
    totalSteps: 12,
    state: 'done',
    pillLabel: 'Done',
    meta: 'Settled · May 3 · 8 captures',
    phaseDots: ['full', 'full', 'full'],
  },
  {
    id: 'phyl-6',
    title: '"Mark roundings under pressure."',
    stepNumber: 6,
    totalSteps: 12,
    state: 'done',
    pillLabel: 'Done',
    meta: 'Settled · May 10 · 5 captures',
    phaseDots: ['full', 'full', 'full'],
  },
  {
    id: 'phyl-7',
    title: '"Tactics — top-of-beat fleet management."',
    stepNumber: 7,
    totalSteps: 12,
    state: 'current',
    pillLabel: 'In Progress',
    meta: 'In progress · Plan ✓ · Do…',
    phaseDots: ['full', 'half', 'empty'],
  },
];

const JAMES_STEPS: StepCardH[] = [
  {
    id: 'james-1',
    title: '"Mark roundings under pressure."',
    stepNumber: 6,
    totalSteps: 12,
    state: 'done',
    pillLabel: 'Done',
    meta: 'Settled · May 10 · 5 captures',
    phaseDots: ['full', 'full', 'full'],
    stripeColor: '#9B9B9B',
    planTag: 'HAYAMA · 6 / 12',
  },
  {
    id: 'james-2',
    title: '"Light-air starts in tide reversal."',
    stepNumber: 2,
    totalSteps: 9,
    state: 'done',
    pillLabel: 'Done',
    meta: 'Settled · 2 days ago · 4 ideas saved',
    phaseDots: ['full', 'full', 'full'],
    stripeColor: '#E0A000',
    planTag: 'LIGHT-AIR · 2 / 9',
  },
  {
    id: 'james-3',
    title: '"Read the tide-line, not just the wind-line."',
    stepNumber: 3,
    totalSteps: 9,
    state: 'current',
    pillLabel: 'Now',
    meta: 'Most recent · 1 hour ago',
    phaseDots: ['full', 'half', 'empty'],
    stripeColor: '#E0A000',
    planTag: 'LIGHT-AIR · 3 / 9',
  },
];

export default function TimelineHDebugScreen() {
  const insets = useSafeAreaInsets();
  const [yourSteps, setYourSteps] = useState(YOUR_STEPS_INITIAL);

  const handleReorder = (id: string, direction: 'left' | 'right') => {
    setYourSteps((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx === -1) return prev;
      const target = direction === 'left' ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: IOS_COLORS.systemGroupedBackground }}
        contentContainerStyle={{
          paddingTop: insets.top + IOS_SPACING.md,
          paddingBottom: insets.bottom + IOS_SPACING.xl,
        }}
      >
        <View style={styles.header}>
          <Text style={styles.kicker}>WAVE 2A · /debug/timeline-h</Text>
          <Text style={styles.title}>Horizontal step-card timeline</Text>
          <Text style={styles.sub}>
            Three demo instances. NOW divider auto-centers; long-press an
            editable card to test Move L / R.
          </Text>
        </View>

        <Text style={styles.section}>Your timeline · editable</Text>
        <HorizontalTimeline
          cards={yourSteps}
          editable
          onCardPress={() => {}}
          onReorder={handleReorder}
        />

        <Text style={styles.section}>Phyl's timeline · scoped to plan</Text>
        <HorizontalTimeline
          cards={PHYL_STEPS}
          showAdopt
          onAdopt={() => {}}
        />

        <Text style={styles.section}>James's whole timeline · followee</Text>
        <HorizontalTimeline
          cards={JAMES_STEPS}
          showAdopt
          onAdopt={() => {}}
        />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingBottom: IOS_SPACING.md,
    gap: 4,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: IOS_COLORS.tertiaryLabel,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: IOS_COLORS.label,
    letterSpacing: -0.4,
  },
  sub: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 19,
  },
  section: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: IOS_SPACING.lg,
    paddingBottom: IOS_SPACING.xs,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
  },
});
