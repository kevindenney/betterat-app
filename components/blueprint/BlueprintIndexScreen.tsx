/**
 * BlueprintIndexScreen — canonical Blueprint Index (§B-A).
 *
 * Hero: author byline + italic-serif quoted title + meta + progress bar.
 * Filter chips: All / In my plan / Upcoming / Done.
 * List: BlueprintStepRow per step, grouped by status, with + Add on upcoming.
 *
 * Data-prop shaped — routes own the data layer; this component just renders.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Share2 } from 'lucide-react-native';
import {
  BlueprintStepRow,
  type BlueprintIndexStep,
} from '@/components/blueprint/BlueprintStepRow';
import { fontFamily } from '@/lib/design-tokens-editorial';

export type { BlueprintIndexStep } from '@/components/blueprint/BlueprintStepRow';

export interface BlueprintIndexAuthor {
  initials: string;
  name: string;
  role?: string;
  version?: string;
}

export interface BlueprintIndexScreenProps {
  author: BlueprintIndexAuthor;
  /** "Prepare for the Dragon Worlds 2027." — quoted italic-serif title. */
  blueprintTitle: string;
  /** "12 steps · 6 months · 5 capabilities developed" */
  metaLine: string;
  /** "Week 7 of 24" */
  weekLine?: string;
  steps: BlueprintIndexStep[];
  /** "Practice" — left back-button copy. */
  backLabel?: string;
  onBack?: () => void;
  onShare?: () => void;
  onAddStep: (step: BlueprintIndexStep) => void;
  /** Items expected to be added optimistically while a mutation is in flight. */
  pendingIds?: Set<string>;
}

type Filter = 'all' | 'in-plan' | 'upcoming' | 'done';

const C = {
  page: '#F2F2F7',
  card: '#FFFFFF',
  label: '#1C1C1E',
  label2: '#3C3C43',
  label3: '#7C7C82',
  line: '#E5E5EA',
  gray6: '#F2F2F7',
  blue: '#007AFF',
};

export function BlueprintIndexScreen({
  author,
  blueprintTitle,
  metaLine,
  weekLine,
  steps,
  backLabel = 'Practice',
  onBack,
  onShare,
  onAddStep,
  pendingIds,
}: BlueprintIndexScreenProps) {
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(() => {
    const done = steps.filter((s) => s.status === 'done').length;
    const current = steps.filter((s) => s.status === 'current').length;
    const upcoming = steps.filter((s) => s.status === 'upcoming').length;
    const added = steps.filter((s) => s.status === 'added').length;
    return {
      done,
      current,
      upcoming,
      inPlan: done + current + added,
      total: steps.length,
    };
  }, [steps]);

  const progressPct =
    counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;

  const visible = useMemo(() => {
    if (filter === 'all') return steps;
    if (filter === 'in-plan') {
      return steps.filter(
        (s) => s.status === 'done' || s.status === 'current' || s.status === 'added',
      );
    }
    if (filter === 'upcoming') return steps.filter((s) => s.status === 'upcoming');
    if (filter === 'done') return steps.filter((s) => s.status === 'done');
    return steps;
  }, [steps, filter]);

  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.back} onPress={onBack} hitSlop={8} disabled={!onBack}>
          <ChevronLeft size={18} color={C.blue} />
          <Text style={styles.backText}>{backLabel}</Text>
        </Pressable>
        <Text style={styles.topTtl}>Blueprint</Text>
        <Pressable hitSlop={8} onPress={onShare} disabled={!onShare} style={styles.topRight}>
          <Share2 size={18} color={C.label2} />
        </Pressable>
      </View>

      <View style={styles.hero}>
        <View style={styles.byRow}>
          <View style={styles.byAv}>
            <Text style={styles.byAvText}>{author.initials}</Text>
          </View>
          <View style={styles.byLine}>
            <Text style={styles.who}>{author.name}</Text>
            {author.role || author.version ? (
              <Text style={styles.sub}>
                {author.role ? <Text style={styles.subStrong}>{author.role}</Text> : null}
                {author.role && author.version ? ' · ' : ''}
                {author.version ?? ''}
              </Text>
            ) : null}
          </View>
        </View>
        <Text style={styles.title}>“{blueprintTitle}”</Text>
        <Text style={styles.metaLine}>{metaLine}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressBar, { width: `${progressPct}%` }]} />
        </View>
        <View style={styles.progressMeta}>
          <Text style={styles.progressMetaText}>
            <Text style={styles.progressMetaStrong}>{counts.done}</Text> completed ·{' '}
            <Text style={styles.progressMetaStrong}>{counts.current}</Text> current ·{' '}
            <Text style={styles.progressMetaStrong}>{counts.upcoming}</Text> upcoming
          </Text>
          {weekLine ? (
            <Text style={[styles.progressMetaText, styles.progressMetaStrong]}>{weekLine}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.filter}>
        <FilterChip label="All" n={counts.total} on={filter === 'all'} onPress={() => setFilter('all')} />
        <FilterChip
          label="In my plan"
          n={counts.inPlan}
          on={filter === 'in-plan'}
          onPress={() => setFilter('in-plan')}
        />
        <FilterChip
          label="Upcoming"
          n={counts.upcoming}
          on={filter === 'upcoming'}
          onPress={() => setFilter('upcoming')}
        />
        <FilterChip
          label="Done"
          n={counts.done}
          on={filter === 'done'}
          onPress={() => setFilter('done')}
        />
      </View>

      <ScrollView style={styles.listScroll} contentContainerStyle={styles.list}>
        {visible.map((step) => (
          <BlueprintStepRow
            key={step.id}
            step={step}
            pending={pendingIds?.has(step.blueprintStepId) ?? false}
            onAdd={() => onAddStep(step)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function FilterChip({
  label,
  n,
  on,
  onPress,
}: {
  label: string;
  n: number;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.chip, on && styles.chipOn]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
      <Text style={[styles.chipCount, on && styles.chipCountOn]}>{n}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.page,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    width: 100,
  },
  backText: {
    color: C.blue,
    fontSize: 15,
    letterSpacing: -0.1,
  },
  topTtl: {
    fontSize: 16,
    fontWeight: '600',
    color: C.label,
    letterSpacing: -0.25,
  },
  topRight: {
    width: 100,
    alignItems: 'flex-end',
  },
  hero: {
    backgroundColor: C.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  byRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 10,
  },
  byAv: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#4E6A85',
    alignItems: 'center',
    justifyContent: 'center',
  },
  byAvText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  byLine: {
    flex: 1,
  },
  who: {
    fontSize: 12,
    fontWeight: '600',
    color: C.label,
    letterSpacing: -0.1,
  },
  sub: {
    fontSize: 10.5,
    color: C.label3,
    marginTop: 1,
  },
  subStrong: {
    color: C.label2,
    fontWeight: '500',
  },
  title: {
    fontFamily: fontFamily.serif,
    fontStyle: 'italic',
    fontSize: 18,
    fontWeight: '500',
    color: C.label,
    letterSpacing: -0.3,
    lineHeight: 22,
    marginBottom: 6,
  },
  metaLine: {
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    fontSize: 11,
    color: C.label3,
    letterSpacing: -0.05,
  },
  progressTrack: {
    marginTop: 10,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.line,
    overflow: 'hidden',
  },
  progressBar: {
    height: 6,
    backgroundColor: C.blue,
    borderRadius: 3,
  },
  progressMeta: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressMetaText: {
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    fontSize: 10,
    color: C.label3,
    letterSpacing: -0.05,
  },
  progressMetaStrong: {
    color: C.label2,
    fontWeight: '600',
  },
  filter: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 11,
    backgroundColor: C.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: C.gray6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chipOn: {
    backgroundColor: C.blue,
    borderColor: C.blue,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '500',
    color: C.label2,
    letterSpacing: -0.05,
  },
  chipTextOn: {
    color: '#FFFFFF',
  },
  chipCount: {
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    fontSize: 11,
    color: C.label3,
  },
  chipCountOn: {
    color: 'rgba(255,255,255,0.78)',
  },
  listScroll: {
    flex: 1,
  },
  list: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 8,
  },
});
