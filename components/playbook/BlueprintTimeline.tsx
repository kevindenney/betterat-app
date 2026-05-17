import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/components/ui/AppToast';
import { supabase } from '@/services/supabase';
import { useBlueprintWithAuthor } from '@/hooks/useBlueprint';
import { addToTimeline, saveToDeck, type TimelineAddPreview } from '@/services/AddToTimelineService';
import { AddToTimelineSheet, TimelineStepCard } from '@/components/timelines';
import type { TimelineStepRecord } from '@/types/timeline-steps';

type BlueprintStepTimelineRow = {
  blueprintStepId: string;
  sortOrder: number;
  step: TimelineStepRecord;
  progressStatus: string | null;
};

function toPillState(status: string | null | undefined): 'settled' | 'current' | 'planned' {
  if (status === 'settled' || status === 'completed') return 'settled';
  if (status === 'in_progress' || status === 'started') return 'current';
  return 'planned';
}

function extractPreview(step: TimelineStepRecord, sourceLabel: string): TimelineAddPreview {
  const plan = (step.metadata?.plan ?? {}) as Record<string, unknown>;
  const capabilities = [
    ...(((plan.capability_goals as string[] | undefined) ?? []).filter(Boolean)),
    ...(((plan.competency_labels as string[] | undefined) ?? []).filter(Boolean)),
  ].slice(0, 5);

  return {
    sourceLabel,
    title: step.title,
    body:
      String(plan.what_will_you_do || '').trim() ||
      String(plan.why_is_this_next || '').trim() ||
      step.description ||
      '',
    capabilities,
  };
}

async function loadBlueprintTimeline(
  blueprintId: string,
  userId: string,
): Promise<BlueprintStepTimelineRow[]> {
  const { data: bpSteps, error: bpErr } = await supabase
    .from('blueprint_steps')
    .select('id, step_id, sort_order')
    .eq('blueprint_id', blueprintId)
    .order('sort_order', { ascending: true });
  if (bpErr) throw bpErr;

  const blueprintSteps = (bpSteps ?? []) as { id: string; step_id: string; sort_order: number }[];
  if (blueprintSteps.length === 0) return [];

  const stepIds = blueprintSteps.map((row) => row.step_id);
  const { data: steps, error: stepsErr } = await supabase
    .from('timeline_steps')
    .select('*')
    .in('id', stepIds);
  if (stepsErr) throw stepsErr;

  const { data: progressRows, error: progressErr } = await supabase
    .from('step_user_progress')
    .select('blueprint_step_id, status')
    .eq('user_id', userId)
    .in('blueprint_step_id', blueprintSteps.map((row) => row.id));
  if (progressErr) throw progressErr;

  const stepMap = new Map((steps ?? []).map((step: any) => [step.id, step as TimelineStepRecord]));
  const progressMap = new Map((progressRows ?? []).map((row: any) => [row.blueprint_step_id, row.status as string]));

  return blueprintSteps
    .map((row) => {
      const step = stepMap.get(row.step_id);
      if (!step) return null;
      return {
        blueprintStepId: row.id,
        sortOrder: row.sort_order,
        step,
        progressStatus: progressMap.get(row.id) ?? null,
      } satisfies BlueprintStepTimelineRow;
    })
    .filter(Boolean) as BlueprintStepTimelineRow[];
}

export function BlueprintTimeline({ blueprintId }: { blueprintId: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const { data: blueprint } = useBlueprintWithAuthor(blueprintId);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['phase7-blueprint-timeline', blueprintId, user?.id],
    queryFn: () => loadBlueprintTimeline(blueprintId, user!.id),
    enabled: Boolean(blueprintId && user?.id),
  });
  const [pendingRow, setPendingRow] = React.useState<BlueprintStepTimelineRow | null>(null);
  const [addedIds, setAddedIds] = React.useState<Record<string, 'added' | 'saw-it'>>({});

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Blueprint timeline</Text>
          <Text style={styles.title}>{blueprint?.title ?? 'Blueprint'}</Text>
          <Text style={styles.subtitle}>
            {rows.length} ordered step{rows.length === 1 ? '' : 's'}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push(`/(tabs)/playbook/blueprints/${blueprintId}/co-practitioners` as any)}
          style={styles.linkChip}
        >
          <Text style={styles.linkChipText}>Co-practitioners</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {rows.map((row) => {
          const preview = extractPreview(
            row.step,
            blueprint?.title ? `From ${blueprint.title}` : 'From blueprint',
          );
          return (
            <TimelineStepCard
              key={row.blueprintStepId}
              pillState={toPillState(row.progressStatus)}
              title={row.step.title}
              metaLabel={preview.body || 'No additional notes'}
              metaWhen={`Step ${row.sortOrder + 1}`}
              capabilityChips={preview.capabilities}
              addState={addedIds[row.blueprintStepId] ?? 'add'}
              onAddPress={() => setPendingRow(row)}
            />
          );
        })}
      </ScrollView>

      <AddToTimelineSheet
        visible={Boolean(pendingRow)}
        preview={
          pendingRow
            ? extractPreview(
                pendingRow.step,
                blueprint?.title ? `From ${blueprint.title}` : 'From blueprint',
              )
            : { sourceLabel: '', title: '', body: '', capabilities: [] }
        }
        onDismiss={() => setPendingRow(null)}
        onAdd={async (placement, date) => {
          if (!pendingRow || !user?.id || !pendingRow.step.interest_id) return;
          await addToTimeline({
            userId: user.id,
            interestId: pendingRow.step.interest_id,
            preview: extractPreview(
              pendingRow.step,
              blueprint?.title ? `From ${blueprint.title}` : 'From blueprint',
            ),
            placement,
            sourceType: 'blueprint',
            sourceId: pendingRow.blueprintStepId,
            date,
          });
          setAddedIds((prev) => ({ ...prev, [pendingRow.blueprintStepId]: 'added' }));
          setPendingRow(null);
          toast.show('Added to timeline', 'success');
        }}
        onSaveToDeck={async () => {
          if (!pendingRow || !user?.id || !pendingRow.step.interest_id) return;
          await saveToDeck({
            userId: user.id,
            interestId: pendingRow.step.interest_id,
            preview: extractPreview(
              pendingRow.step,
              blueprint?.title ? `From ${blueprint.title}` : 'From blueprint',
            ),
            sourceType: 'blueprint',
            sourceId: pendingRow.blueprintStepId,
          });
          setAddedIds((prev) => ({ ...prev, [pendingRow.blueprintStepId]: 'saw-it' }));
          setPendingRow(null);
          toast.show('Saved to deck', 'success');
        }}
      />
    </View>
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
    backgroundColor: '#F2F2F7',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#6D5EF7',
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  linkChip: {
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  linkChipText: {
    color: '#2563EB',
    fontWeight: '600',
    fontSize: 13,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
});
