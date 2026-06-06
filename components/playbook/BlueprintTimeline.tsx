import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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

/** Lighten (amount > 0) or darken (amount < 0) a hex colour for the hero gradient. */
function shade(hex: string, amount: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return hex;
  const to = amount < 0 ? 0 : 255;
  const t = Math.abs(amount);
  const ch = (c: number) => Math.round(c + (to - c) * t);
  const r = ch(parseInt(m[1], 16));
  const g = ch(parseInt(m[2], 16));
  const b = ch(parseInt(m[3], 16));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Resolve the hero accent: the author's stored colour, else a stable hash tone. */
function accentFor(color: string | null | undefined, seed: string): string {
  if (color && /^#?[a-f\d]{6}$/i.test(color.trim())) {
    return color.trim().startsWith('#') ? color.trim() : `#${color.trim()}`;
  }
  const palette = ['#28406B', '#8B5A3C', '#B8855A', '#6E8B5A', '#7A5A8B'];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

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
    const adopted = rows.filter((row) => row.adoptedStepId != null).length;
    return { all: rows.length, inProgress, settled, adopted };
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
  // Prefer the denormalized count (authoritative, ranks the catalog) — the
  // subscribers list is RLS-gated so a non-owner viewer sees zero rows.
  const subscriberCount = blueprint?.subscriber_count ?? subscribers.length;
  const adoptionPct =
    counts.all > 0 ? Math.min(100, Math.round((counts.adopted / counts.all) * 100)) : 0;

  // Tint the hero from the author's stored avatar colour (their blueprints all
  // read one tone); fall back to a stable hash if it's unset.
  const accent = accentFor(blueprint?.author_avatar_color, blueprint?.author_name ?? blueprintId);

  // Plan → Do → Review → Discuss band — lit from this viewer's own progress.
  // Plan is always live (the journey ahead); the rest fill in as steps move.
  const phaseBand: { label: string; on: boolean }[] = [
    { label: 'Plan', on: true },
    { label: 'Do', on: counts.inProgress > 0 || counts.settled > 0 },
    { label: 'Review', on: counts.settled > 0 },
    { label: 'Discuss', on: counts.all > 0 && counts.settled === counts.all },
  ];

  return (
    <View style={styles.screen}>
      <View style={styles.heroWrap}>
        <LinearGradient
          colors={[accent, shade(accent, -0.4)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTopRow}>
            <Text style={styles.eyebrow}>Blueprint</Text>
            <Pressable
              onPress={() => router.push(`/(tabs)/library/blueprints/${blueprintId}/co-practitioners` as any)}
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
              <View style={styles.subscribedPill}>
                <Text style={styles.subscribedPillText}>Subscribed</Text>
              </View>
            )}
          </View>

          <View style={styles.arc}>
            {phaseBand.map((ph) => (
              <View key={ph.label} style={[styles.phasePill, ph.on && styles.phasePillOn]}>
                <Text style={[styles.phasePillText, ph.on && styles.phasePillTextOn]}>
                  {ph.label}
                </Text>
              </View>
            ))}
          </View>

          {subscription && counts.all > 0 ? (
            <View style={styles.adoptionWrap}>
              <View style={styles.adoptionTextRow}>
                <Text style={styles.adoptionLabel}>In your Plan</Text>
                <Text style={styles.adoptionCount}>
                  {counts.adopted} of {counts.all}
                </Text>
              </View>
              <View style={styles.adoptionTrack}>
                <View
                  style={[styles.adoptionFill, { width: `${adoptionPct}%` }]}
                />
              </View>
            </View>
          ) : null}
        </LinearGradient>
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
          if (!pendingRow || !user?.id) return;
          if (!pendingRow.step.interest_id) {
            toast.show("This step isn't linked to an interest yet — can't add it.", 'error');
            return;
          }
          try {
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
          } catch (err) {
            console.warn('[BlueprintTimeline] add to timeline failed', err);
            toast.show('Could not add to timeline. Please try again.', 'error');
          }
        }}
        onSaveToDeck={async () => {
          if (!pendingRow || !user?.id) return;
          if (!pendingRow.step.interest_id) {
            toast.show("This step isn't linked to an interest yet — can't add it.", 'error');
            return;
          }
          try {
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
          } catch (err) {
            console.warn('[BlueprintTimeline] save to deck failed', err);
            toast.show('Could not save to deck. Please try again.', 'error');
          }
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
  heroWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  hero: {
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 10,
    overflow: 'hidden',
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
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.78)',
  },
  coPractitionersLink: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#FFFFFF',
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  heroMeta: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  subscribedPill: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  subscribedPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  arc: { flexDirection: 'row', gap: 7, marginTop: 6 },
  phasePill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  phasePillOn: {
    backgroundColor: 'rgba(255,255,255,0.26)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  phasePillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.7)',
  },
  phasePillTextOn: { color: '#FFFFFF' },
  adoptionWrap: {
    marginTop: 4,
    gap: 6,
  },
  adoptionTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  adoptionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  adoptionCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  adoptionTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  adoptionFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
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
