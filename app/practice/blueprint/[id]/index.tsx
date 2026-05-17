/**
 * Surface A · Blueprint Index route.
 *
 * Reads the curated blueprint step list and the viewer's adoption state
 * for each step, then renders the BlueprintIndex view. Tapping Add on an
 * upcoming row adopts that step into the viewer's plan at its native
 * blueprint position (TimelineStepService.adoptStep). The current step is
 * never jumped — adoption preserves the source step's sort order.
 *
 * For the HKDW sample (`hkdw-prepare-for-the-worlds` or the dev sample
 * blueprint id) this falls back to a mock list so reviewers can scrub the
 * canonical without round-tripping the database.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BlueprintIndex, type BlueprintIndexStep } from '@/components/onboarding';
import { useAuth } from '@/providers/AuthProvider';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import {
  getBlueprintSteps,
  getBlueprintWithAuthorById,
} from '@/services/BlueprintService';
import { adoptStep } from '@/services/TimelineStepService';
import { supabase } from '@/services/supabase';

const HKDW_SAMPLE_IDS = new Set([
  'hkdw-prepare-for-the-worlds',
  'sample-blueprint',
]);

interface MockStep {
  number: number;
  title: string;
  meta: string;
  status: 'done' | 'current' | 'upcoming';
}

const HKDW_MOCK: {
  authorName: string;
  authorInitials: string;
  authorRole: string;
  version: string;
  title: string;
  metaLine: string;
  weekLine: string;
  steps: MockStep[];
} = {
  authorName: 'Kevin Denney',
  authorInitials: 'KD',
  authorRole: 'Worlds-qualified Dragon helm',
  version: 'v3.2',
  title: 'Prepare for the Dragon Worlds 2027.',
  metaLine: '12 steps · 6 months · 5 capabilities developed',
  weekLine: 'Week 7 of 24',
  steps: [
    { number: 1, title: 'Goal-setting · your Worlds outcome', meta: 'Week 1 · Done Apr 14', status: 'done' },
    { number: 2, title: 'Crew roster & comms baseline', meta: 'Week 2 · Done Apr 22', status: 'done' },
    { number: 3, title: 'Rig tune · light-air settings', meta: 'Week 3 · Done May 03', status: 'done' },
    { number: 4, title: 'Boat-speed baseline · all points of sail', meta: 'Current step · Week 7 · due May 22', status: 'current' },
    { number: 5, title: 'Starts · light-air, shifty breeze', meta: 'Week 9 · Phyl & Bram are on this', status: 'upcoming' },
    { number: 6, title: 'Heavy-air helm work · 25–30 kt', meta: 'Week 11 · capability: heavy-air helm', status: 'upcoming' },
    { number: 7, title: 'Local conditions · Victoria Harbour', meta: 'Week 13 · on-site practice', status: 'upcoming' },
    { number: 8, title: 'Tactical · mark roundings under pressure', meta: 'Week 15 · fleet-tactics capability', status: 'upcoming' },
    { number: 9, title: 'Layline calls under shifting pressure', meta: 'Week 17 · tactical capability', status: 'upcoming' },
    { number: 10, title: 'Crew comms · downwind sets & gybes', meta: 'Week 19 · crew comms capability', status: 'upcoming' },
    { number: 11, title: 'Race-day routine · the Worlds week', meta: 'Week 22 · debrief structure', status: 'upcoming' },
    { number: 12, title: 'Final tune-up · pre-event hit-list', meta: 'Week 24 · check-in with Kevin', status: 'upcoming' },
  ],
};

interface AdoptedStepRow {
  blueprint_step_id: string;
  status: 'planned' | 'doing' | 'reflecting' | 'settled' | string;
}

export default function BlueprintIndexRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const flagOn = FEATURE_FLAGS.HKDW_REDEEM_FLOW;
  const isSample = Boolean(id && HKDW_SAMPLE_IDS.has(id));
  const realEnabled = Boolean(id && flagOn && !isSample);

  const { data: blueprint, isLoading: bpLoading } = useQuery({
    queryKey: ['phase10-blueprint', id],
    queryFn: () => getBlueprintWithAuthorById(id!),
    enabled: realEnabled,
  });

  const { data: bpSteps, isLoading: stepsLoading } = useQuery({
    queryKey: ['phase10-blueprint-steps', id],
    queryFn: () => getBlueprintSteps(id!),
    enabled: realEnabled,
  });

  const { data: adopted } = useQuery({
    queryKey: ['phase10-adopted-by-user', id, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('step_user_progress')
        .select('blueprint_step_id, status')
        .eq('user_id', user!.id);
      return (data as AdoptedStepRow[]) ?? [];
    },
    enabled: realEnabled && Boolean(user?.id),
  });

  // Mock fast-path: render canonical with mock data.
  const mockSteps = useMemo<BlueprintIndexStep[]>(() => {
    if (!isSample) return [];
    return HKDW_MOCK.steps.map((s, idx) => ({
      id: `mock-${idx}`,
      blueprintStepId: `mock-${idx}`,
      number: s.number,
      title: s.title,
      meta: s.meta,
      status: s.status,
    }));
  }, [isSample]);

  // Real-data path: derive view-model from blueprint + adoption.
  const realSteps = useMemo<BlueprintIndexStep[]>(() => {
    if (isSample) return [];
    if (!bpSteps) return [];
    const adoptedByStepId = new Map(
      (adopted ?? []).map((a) => [a.blueprint_step_id, a.status]),
    );

    return bpSteps.map((s, idx) => {
      const status = adoptedByStepId.get((s as { id: string }).id);
      let bucket: BlueprintIndexStep['status'] = 'upcoming';
      if (status === 'settled') bucket = 'done';
      else if (status === 'doing' || status === 'reflecting' || status === 'planned')
        bucket = 'current';
      // We don't have a discrete "added but not current" state in the schema —
      // anything not the user's current/active step but already in their plan
      // still falls under upcoming for now.
      return {
        id: (s as { id: string }).id,
        blueprintStepId: (s as { id: string }).id,
        number: idx + 1,
        title: (s as { title?: string }).title ?? 'Step',
        meta: undefined,
        status: bucket,
      };
    });
  }, [isSample, bpSteps, adopted]);

  const addMutation = useMutation({
    mutationFn: async (step: BlueprintIndexStep) => {
      if (!user?.id) throw new Error('Sign in to add this step to your plan.');
      if (isSample) {
        // Mock: just delay a tick.
        await new Promise((resolve) => setTimeout(resolve, 350));
        return;
      }
      if (!blueprint?.interest_id) throw new Error('Missing interest on blueprint.');
      await adoptStep(user.id, step.blueprintStepId, blueprint.interest_id, id);
    },
    onMutate: (step) => {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.add(step.blueprintStepId);
        return next;
      });
    },
    onSuccess: async (_, step) => {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(step.blueprintStepId);
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ['phase10-adopted-by-user', id] });
    },
    onError: (err: unknown, step) => {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(step.blueprintStepId);
        return next;
      });
      const msg = err instanceof Error ? err.message : 'Could not add this step.';
      showAlert("Couldn't add step", msg);
    },
  });

  const handleAdd = useCallback(
    (step: BlueprintIndexStep) => {
      addMutation.mutate(step);
    },
    [addMutation],
  );

  const onBack = useCallback(() => router.back(), []);

  if (!flagOn) {
    return (
      <View style={styles.disabled}>
        <Stack.Screen options={{ title: 'Blueprint' }} />
        <Text style={styles.disabledTitle}>This blueprint view isn't live yet.</Text>
        <Text style={styles.disabledBody}>
          Enable EXPO_PUBLIC_FF_HKDW_REDEEM_FLOW in this environment to preview.
        </Text>
      </View>
    );
  }

  if (!id) return null;

  if (!isSample && (bpLoading || stepsLoading)) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator />
      </View>
    );
  }

  if (!isSample && !blueprint) {
    return (
      <View style={styles.disabled}>
        <Stack.Screen options={{ title: 'Blueprint' }} />
        <Text style={styles.disabledTitle}>Blueprint not found.</Text>
      </View>
    );
  }

  const viewSteps = isSample ? mockSteps : realSteps;
  const author = isSample
    ? {
        initials: HKDW_MOCK.authorInitials,
        name: HKDW_MOCK.authorName,
        role: HKDW_MOCK.authorRole,
        version: HKDW_MOCK.version,
      }
    : {
        initials: initialsFrom(blueprint?.author_name ?? '?'),
        name: blueprint?.author_name ?? 'Author',
        role: blueprint?.organization_name ?? undefined,
        version: undefined,
      };

  const title = isSample ? HKDW_MOCK.title : blueprint?.title ?? 'Blueprint';
  const metaLine = isSample
    ? HKDW_MOCK.metaLine
    : `${viewSteps.length} steps · ${blueprint?.author_name ?? 'Author'}`;
  const weekLine = isSample ? HKDW_MOCK.weekLine : undefined;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <BlueprintIndex
        author={author}
        blueprintTitle={title}
        metaLine={metaLine}
        weekLine={weekLine}
        steps={viewSteps}
        backLabel="Practice"
        onBack={onBack}
        onAddStep={handleAdd}
        pendingIds={pendingIds}
      />
    </View>
  );
}

function initialsFrom(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    flex: 1,
    padding: 24,
    gap: 8,
  },
  disabledTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  disabledBody: {
    fontSize: 14,
    color: '#6B7280',
  },
});
