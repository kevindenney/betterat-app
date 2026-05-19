/**
 * /debug/step-v2 — Wave 2c smoke route for the rebuilt 4-phase step shell.
 * Renders the "Pre-start lane choice in shifty breeze" sample step
 * per canonical §9A.
 */

import React, { useState } from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { StepShell } from '@/components/step/v2/StepShell';
import type { StepPhaseTab, StepV2, SubStep } from '@/components/step/v2/types';

const VALID_TABS: StepPhaseTab[] = ['plan', 'do', 'reflect', 'discuss'];

const INITIAL_SUB_STEPS: SubStep[] = [
  {
    id: 'ss1',
    kind: 'plain',
    text: 'Sight the committee boat from the pin at 3-minute to read line bias.',
    done: true,
  },
  {
    id: 'ss2',
    kind: 'plain',
    text: 'Note last 3 shifts on the upwind leg (timing + amplitude).',
    done: true,
  },
  {
    id: 'ss3',
    kind: 'concept',
    text: 'Apply this concept — pick the end that has the next shift, not the end with the wind now.',
    done: false,
    conceptTitle: 'Trust the shift, not just the side',
    conceptSource: 'From your Concepts · Testing for 5 days',
    conceptState: 'testing',
  },
  {
    id: 'ss4',
    kind: 'resource',
    text: 'Re-read before the warm-up:',
    done: false,
    resourceTitle: 'North Sails · "Dragon mainsail trim 18+ kn" · Ch 7',
    resourceSource: 'From HKDW plan resources',
    resourceFormat: 'book',
  },
  {
    id: 'ss5',
    kind: 'plain',
    text: 'If pin favored, hold a high lane for 90s after the gun.',
    done: false,
  },
  {
    id: 'ss6',
    kind: 'plain',
    text: "If pin not favored, bail to clear air. Height costs less than speed in shifty light.",
    done: false,
  },
  {
    id: 'ss7',
    kind: 'resource',
    text: 'Watch the night before:',
    done: false,
    resourceTitle: '"Pre-start lane choice — 14-boat fleet drone"',
    resourceSource: 'From HKDW plan resources · 11 min',
    resourceFormat: 'video',
  },
];

const STEP: StepV2 = {
  id: 'demo-step-4',
  title: '"Pre-start lane choice in shifty breeze."',
  stepNumber: 4,
  totalSteps: 12,
  state: 'current',
  stateLabel: 'In progress',
  contextLine: 'today · Race 4',
  planChip: {
    label: 'HKDW',
    color: '#1E63D6',
    subtitle: 'Step 4 of 12 · Kevin\'s Worlds 2027 plan',
  },
  what:
    "Pick the favored end 3 minutes before the start. If pin is >5° favored, commit. Otherwise bail to clear air without losing a length to leeward.",
  why:
    'Most Dragon starts are lost in the 60 seconds after the gun, not before. Discipline to bail is bigger than picking the right end.',
  subSteps: INITIAL_SUB_STEPS,
  withCollaborators: [
    { id: 'bm', initials: 'BM', tint: '#34C759', name: 'Bram', role: 'helm' },
    { id: 'st', initials: 'ST', tint: '#AF52DE', name: 'Steve', role: 'foredeck' },
    { id: 'jl', initials: 'JL', tint: '#5AC8FA', name: 'Jules', role: 'middle' },
  ],
  where:
    'Victoria Harbour · RHKYC Spring Series · Race 4 · 14-boat Dragon fleet · 18–22 kn NE building',
  capabilities: [
    { id: 'c1', label: 'Pre-start lane discipline' },
    { id: 'c2', label: 'Shifty-light tactics' },
    { id: 'c3', label: 'Bailout judgement' },
  ],
  suggestions: [
    {
      id: 'sg1',
      kind: 'followee',
      fromInitials: 'PL',
      fromTint: '#34C759',
      fromName: 'Phyl Loong',
      fromContext: 'same plan, Step 7',
      title: 'Add "3-minute committee-boat sight" as your first sub-step',
      fromLine: 'From her Step 4 · would slot into How',
    },
    {
      id: 'sg2',
      kind: 'mentor',
      fromInitials: 'SC',
      fromTint: '#FF9500',
      fromName: 'Sam Cooke',
      fromContext: 'Decision-making · Coaching',
      title: "Try a 'Calm-before-the-gun' breathing drill before warm-up",
      fromLine: 'From your Coaching interest · cross-interest tip',
    },
    {
      id: 'sg3',
      kind: 'followee',
      fromInitials: 'EG',
      fromTint: '#AF52DE',
      fromName: 'Emma Greene',
      fromContext: 'ABC, no shared plan',
      title: "Tag this with 'Inside-overlap rule' too",
      fromLine: 'From her Step 6 · would add a capability chip',
    },
  ],
  discussCount: 3,
  hasSharedAccess: true,
};

const INITIAL_BEFORE_SHIFT = [
  {
    id: 'bs1',
    format: 'pdf' as const,
    title: 'AACN Practice Alert · severe sepsis',
    meta: 'PDF · 8 pages · read Mon',
    read: true,
  },
  {
    id: 'bs2',
    format: 'video' as const,
    title: "Bates' cardiovascular exam, bedside",
    meta: 'Video · 12 min · focus · auscultation order',
    read: false,
  },
  {
    id: 'bs3',
    format: 'link' as const,
    title: 'Early goal-directed therapy · NEJM excerpt',
    meta: 'Link · 5 min · Patricia recommended',
    read: false,
  },
];

export default function StepV2DebugScreen() {
  const params = useLocalSearchParams<{
    tab?: string;
    adopt?: string;
    beforeShift?: string;
  }>();
  const paramTab: StepPhaseTab =
    params.tab && (VALID_TABS as string[]).includes(params.tab)
      ? (params.tab as StepPhaseTab)
      : 'plan';
  const showAdoptFooter = params.adopt === '1';
  const showBeforeShift = params.beforeShift === '1';
  const [tab, setTab] = useState<StepPhaseTab>(paramTab);
  const [subSteps, setSubSteps] = useState(INITIAL_SUB_STEPS);
  const [beforeShiftItems, setBeforeShiftItems] = useState(INITIAL_BEFORE_SHIFT);

  // Sync from deep-link
  React.useEffect(() => {
    if (paramTab !== tab) setTab(paramTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramTab]);

  const handleToggle = (id: string) => {
    setSubSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, done: !s.done } : s))
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StepShell
        step={{ ...STEP, subSteps }}
        tab={tab}
        onTabChange={setTab}
        onToggleSubStep={handleToggle}
        backLabel="Practice"
        adopt={
          showAdoptFooter
            ? {
                provenance:
                  "Forked from Phyl Loong's Step 4 in Kevin's Worlds 2027 plan",
                onAddToTimeline: () => {},
                onSaveAsConceptSeed: () => {},
              }
            : undefined
        }
        beforeShift={
          showBeforeShift
            ? {
                items: beforeShiftItems,
                totalEstimate: '~25 min total',
                onToggle: (id) =>
                  setBeforeShiftItems((prev) =>
                    prev.map((b) =>
                      b.id === id ? { ...b, read: !b.read } : b
                    )
                  ),
              }
            : undefined
        }
      />
    </>
  );
}
