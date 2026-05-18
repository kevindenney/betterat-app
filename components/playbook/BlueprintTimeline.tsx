import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/components/ui/AppToast';
import { supabase } from '@/services/supabase';
import { useBlueprintWithAuthor, useBlueprintSubscribers, useBlueprintSubscription } from '@/hooks/useBlueprint';
import { addToTimeline, saveToDeck, type TimelineAddPreview } from '@/services/AddToTimelineService';
import { AddToTimelineSheet, FilterStrip, TimelineStepCard } from '@/components/timelines';
import type { TimelineStepRecord } from '@/types/timeline-steps';

type BlueprintStepTimelineRow = {
  blueprintStepId: string;
  sortOrder: number;
  step: TimelineStepRecord;
  progressStatus: string | null;
  adoptedStepId: string | null;
};

type BlueprintFilter = 'all' | 'in-progress' | 'settled';

function toPillState(row: BlueprintStepTimelineRow): 'settled' | 'current' | 'planned' {
  if (row.progressStatus === 'settled' || row.progressStatus === 'completed') return 'settled';
  if (row.progressStatus === 'current' || row.progressStatus === 'in_progress' || row.progressStatus === 'started') return 'current';
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
  const blueprintStepIds = blueprintSteps.map((row) => row.id);

  const [stepsRes, progressRes, adoptedRes] = await Promise.all([
    supabase.from('timeline_steps').select('*').in('id', stepIds),
    supabase
      .from('step_user_progress')
      .select('blueprint_step_id, status')
      .eq('user_id', userId)
      .in('blueprint_step_id', blueprintStepIds),
    supabase
      .from('timeline_steps')
      .select('id, source_id')
      .eq('user_id', userId)
      .eq('source_type', 'blueprint')
      .in('source_id', blueprintStepIds),
  ]);

  if (stepsRes.error) throw stepsRes.error;
  if (progressRes.error) throw progressRes.error;
  if (adoptedRes.error) throw adoptedRes.error;

  const stepMap = new Map((stepsRes.data ?? []).map((step: any) => [step.id, step as TimelineStepRecord]));
  const progressMap = new Map((progressRes.data ?? []).map((row: any) => [row.blueprint_step_id, row.status as string]));
  const adoptedMap = new Map((adoptedRes.data ?? []).map((row: any) => [row.source_id, row.id as string]));

  return blueprintSteps
    .map((row) => {
      const step = stepMap.get(row.step_id);
      if (!step) return null;
      return {
        blueprintStepId: row.id,
        sortOrder: row.sort_order,
        step,
        progressStatus: progressMap.get(row.id) ?? null,
        adoptedStepId: adoptedMap.get(row.id) ?? null,
      } satisfies BlueprintStepTimelineRow;
    })
    .filter(Boolean) as BlueprintStepTimelineRow[];
}

export function BlueprintTimeline({ blueprintId }: { blueprintId: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const { data: blueprint } = useBlueprintWithAuthor(blueprintId);
  const { data: subscribers = [] } = useBlueprintSubscribers(blueprintId);
  const { data: subscription } = useBlueprintSubscription(blueprintId);
  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ['phase7-blueprint-timeline', blueprintId, user?.id],
    queryFn: () => loadBlueprintTimeline(blueprintId, user!.id),
    enabled: Boolean(blueprintId && user?.id),
  });
  const [pendingRow, setPendingRow] = React.useState<BlueprintStepTimelineRow | null>(null);
  const [filter, setFilter] = React.useState<BlueprintFilter>('all');

  const counts = React.useMemo(() => {
    const inProgress = rows.filter((row) => {
      const pill = toPillState(row);
      return pill === 'current';
    }).length;
    const settled = rows.filter((row) => toPillState(row) === 'settled').length;
    return { all: rows.length, inProgress, settled };
  }, [rows]);

  const visibleRows = React.useMemo(() => {
    if (filter === 'all') return rows;
    if (filter === 'in-progress') return rows.filter((row) => toPillState(row) === 'current');
    return rows.filter((row) => toPillState(row) === 'settled');
  }, [rows, filter]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  const authorName = blueprint?.author_name ?? 'Author';
  const subscriberCount = subscribers.length;

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.heroTopRow}>
          <Text style={styles.eyebrow}>Blueprint timeline</Text>
          <Pressable
            onPress={() => router.push(`/(tabs)/playbook/blueprints/${blueprintId}/co-practitioners` as any)}
            hitSlop={8}
          >
            <Text style={styles.coPractitionersLink}>Co-practitioners ›</Text>
          </Pressable>
        </View>
        <Text style={styles.title}>{blueprint?.title ?? 'Blueprint'}</Text>
        <View style={styles.heroMetaRow}>
          <Text style={styles.heroMeta}>by {authorName}</Text>
          <View style={styles.metaDot} />
          <Text style={styles.heroMeta}>
            {subscriberCount} subscriber{subscriberCount === 1 ? '' : 's'}
          </Text>
          {subscription && (
            <>
              <View style={styles.metaDot} />
              <View style={styles.subscribedPill}>
                <Text style={styles.subscribedPillText}>Subscribed</Text>
              </View>
            </>
          )}
        </View>
      </View>

      <FilterStrip
        options={[
          { key: 'all', label: `All ${counts.all}` },
          { key: 'in-progress', label: `In progress ${counts.inProgress}` },
          { key: 'settled', label: `Settled ${counts.settled}` },
        ]}
        selectedKey={filter}
        onSelect={(key) => setFilter(key as BlueprintFilter)}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {visibleRows.length === 0 ? (
          <Text style={styles.empty}>
            {filter === 'all'
              ? 'This blueprint has no steps yet.'
              : `No ${filter === 'in-progress' ? 'in-progress' : 'settled'} steps yet.`}
          </Text>
        ) : (
          visibleRows.map((row) => {
            const preview = extractPreview(
              row.step,
              blueprint?.title ? `From ${blueprint.title}` : 'From blueprint',
            );
            return (
              <TimelineStepCard
                key={row.blueprintStepId}
                pillState={toPillState(row)}
                title={row.step.title}
                metaLabel={preview.body || 'No additional notes'}
                metaWhen={`Step ${row.sortOrder + 1}`}
                capabilityChips={preview.capabilities}
                addState={row.adoptedStepId ? 'added' : 'add'}
                onAddPress={() => setPendingRow(row)}
              />
            );
          })
        )}
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
          setPendingRow(null);
          await refetch();
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
  hero: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
    gap: 8,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#6D5EF7',
  },
  coPractitionersLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: '#111827',
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  heroMeta: {
    fontSize: 13,
    color: '#6B7280',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#D1D5DB',
  },
  subscribedPill: {
    backgroundColor: '#E0E7FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  subscribedPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4338CA',
    letterSpacing: 0.3,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  empty: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 32,
  },
});
