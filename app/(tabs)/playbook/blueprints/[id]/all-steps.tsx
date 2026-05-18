/**
 * Blueprint Index route (canonical §B-A) — playbook depth.
 *
 * Mounts BlueprintIndexScreen with live data for any blueprint:
 *   - blueprints + blueprint_steps     → step list + order
 *   - step_user_progress (for viewer)  → done / current / added / upcoming
 *   - profiles (author)                → byline initials, role, version
 *
 * Tap "+ Add" on an upcoming row → TimelineStepService.adoptStep enqueues
 * the step into the viewer's plan at its native blueprint position; we
 * also write a 'planned' step_user_progress row so the row flips to "In
 * plan" on the next refresh.
 *
 * Behind BLUEPRINT_INDEX_FLEET_V2.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BlueprintIndexScreen,
  type BlueprintIndexAuthor,
  type BlueprintIndexStep,
} from '@/components/blueprint/BlueprintIndexScreen';
import { useAuth } from '@/providers/AuthProvider';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import {
  getBlueprintSteps,
  getBlueprintWithAuthorById,
} from '@/services/BlueprintService';
import { adoptStep } from '@/services/TimelineStepService';
import { supabase } from '@/services/supabase';

interface ViewerProgressRow {
  blueprint_step_id: string;
  status: 'planned' | 'current' | 'settled' | string;
}

export default function BlueprintAllStepsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const flagOn = FEATURE_FLAGS.BLUEPRINT_INDEX_FLEET_V2;
  const enabled = Boolean(id && flagOn);

  const { data: blueprint, isLoading: bpLoading } = useQuery({
    queryKey: ['blueprint-index-blueprint', id],
    queryFn: () => getBlueprintWithAuthorById(id!),
    enabled,
  });

  const { data: bpSteps, isLoading: stepsLoading } = useQuery({
    queryKey: ['blueprint-index-steps', id],
    queryFn: () => getBlueprintSteps(id!),
    enabled,
  });

  const { data: progressRows } = useQuery({
    queryKey: ['blueprint-index-progress', id, user?.id, 'v2'],
    queryFn: async () => {
      // 1. Get this blueprint's curated steps (id = blueprint_steps.id, step_id = timeline_steps.id)
      const { data: bpStepsRows } = await supabase
        .from('blueprint_steps')
        .select('id, step_id')
        .eq('blueprint_id', id!);
      const bpStepList =
        (bpStepsRows as { id: string; step_id: string }[] | null) ?? [];
      if (bpStepList.length === 0) return new Map<string, ViewerProgressRow>();
      const bpStepIds = bpStepList.map((r) => r.id);
      const bpStepIdToTimelineStepId = new Map<string, string>(
        bpStepList.map((r) => [r.id, r.step_id]),
      );

      // 2. Look up this user's progress on any of those bp_steps
      const { data: progress } = await supabase
        .from('step_user_progress')
        .select('blueprint_step_id, status')
        .eq('user_id', user!.id)
        .in('blueprint_step_id', bpStepIds);
      const progressList =
        (progress as { blueprint_step_id: string; status: string }[] | null) ?? [];

      // 3. Index by underlying timeline_step.id so the UI can look up by bpSteps[i].id
      const byStepId = new Map<string, ViewerProgressRow>();
      for (const r of progressList) {
        const timelineStepId = bpStepIdToTimelineStepId.get(r.blueprint_step_id);
        if (!timelineStepId) continue;
        byStepId.set(timelineStepId, {
          blueprint_step_id: r.blueprint_step_id,
          status: r.status,
        });
      }
      return byStepId;
    },
    enabled: enabled && Boolean(user?.id),
  });

  const viewSteps = useMemo<BlueprintIndexStep[]>(() => {
    if (!bpSteps) return [];
    const progress = progressRows ?? new Map<string, ViewerProgressRow>();
    return bpSteps.map((s, idx) => {
      const row = progress.get((s as { id: string }).id);
      let status: BlueprintIndexStep['status'] = 'upcoming';
      if (row?.status === 'settled') status = 'done';
      else if (row?.status === 'current') status = 'current';
      else if (row?.status === 'planned') status = 'added';
      return {
        id: (s as { id: string }).id,
        blueprintStepId: (s as { id: string }).id,
        number: idx + 1,
        title: (s as { title?: string }).title ?? 'Step',
        meta: undefined,
        status,
      };
    });
  }, [bpSteps, progressRows]);

  const addMutation = useMutation({
    mutationFn: async (step: BlueprintIndexStep) => {
      if (!user?.id) throw new Error('Sign in to add this step to your plan.');
      if (!blueprint?.interest_id) throw new Error('Missing interest on blueprint.');
      await adoptStep(user.id, step.blueprintStepId, blueprint.interest_id, id);

      // Mark the user's progress on this blueprint step as "planned" so the
      // BlueprintIndex row flips to "In plan" instead of falling back to
      // "+ Add". adoptStep alone copies the step into timeline_steps but
      // doesn't record subscription progress.
      const { data: bpStepRow } = await supabase
        .from('blueprint_steps')
        .select('id')
        .eq('blueprint_id', id!)
        .eq('step_id', step.blueprintStepId)
        .maybeSingle();
      const blueprintStepRowId = (bpStepRow as { id: string } | null)?.id;
      if (blueprintStepRowId) {
        await supabase
          .from('step_user_progress')
          .upsert(
            {
              user_id: user.id,
              blueprint_step_id: blueprintStepRowId,
              status: 'planned',
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,blueprint_step_id' },
          );
      }
    },
    onMutate: (step) => {
      setPendingIds((prev) => new Set(prev).add(step.blueprintStepId));
    },
    onSuccess: async (_, step) => {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(step.blueprintStepId);
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ['blueprint-index-progress', id] });
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
    (step: BlueprintIndexStep) => addMutation.mutate(step),
    [addMutation],
  );

  const onBack = useCallback(() => router.back(), []);

  if (!flagOn) {
    return (
      <View style={styles.disabled}>
        <Stack.Screen options={{ title: 'Blueprint' }} />
        <Text style={styles.disabledTitle}>This view isn't live yet.</Text>
        <Text style={styles.disabledBody}>
          Enable EXPO_PUBLIC_FF_BLUEPRINT_INDEX_FLEET_V2 in this environment to preview.
        </Text>
      </View>
    );
  }

  if (!id) return null;

  if (bpLoading || stepsLoading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator />
      </View>
    );
  }

  if (!blueprint) {
    return (
      <View style={styles.disabled}>
        <Stack.Screen options={{ title: 'Blueprint' }} />
        <Text style={styles.disabledTitle}>Blueprint not found.</Text>
      </View>
    );
  }

  const author: BlueprintIndexAuthor = {
    initials: initialsFrom(blueprint.author_name ?? '?'),
    name: blueprint.author_name ?? 'Author',
    role: blueprint.organization_name ?? undefined,
    version: undefined,
  };

  const metaLine = `${viewSteps.length} steps${blueprint.author_name ? ` · ${blueprint.author_name}` : ''}`;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <BlueprintIndexScreen
        author={author}
        blueprintTitle={blueprint.title}
        metaLine={metaLine}
        steps={viewSteps}
        backLabel="Playbook"
        onBack={onBack}
        onAddStep={handleAdd}
        pendingIds={pendingIds}
      />
    </View>
  );
}

function initialsFrom(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
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
