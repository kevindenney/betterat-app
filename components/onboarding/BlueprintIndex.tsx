/**
 * Surface A · Blueprint Index — full 12-step list with Add buttons.
 *
 * Hero: byline + italic-serif quoted title + meta + progress bar.
 * Filter chips: All / In my plan / Upcoming / Done.
 * Rows: done (green check), current (blue ring + Now pill, no Add), upcoming (gray + Add).
 *
 * Tapping Add calls `onAddStep(stepId)` which the route wires to
 * BlueprintService.addStepToPlan({ blueprintStepId, position: 'native' }).
 * The mutation queues the step into the user's Plan at its native
 * blueprint position — it doesn't jump the current step.
 */

import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronLeft, Flag, Plus, Share2 } from 'lucide-react-native';

export type BlueprintIndexStepStatus = 'done' | 'current' | 'upcoming' | 'added';

export interface BlueprintIndexStep {
  id: string;
  blueprintStepId: string;
  number: number;
  title: string;
  meta?: string;
  status: BlueprintIndexStepStatus;
}

export interface BlueprintIndexAuthor {
  initials: string;
  name: string;
  role?: string;
  version?: string;
}

export interface BlueprintIndexProps {
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
  ink: '#1C1C1E',
  label: '#1C1C1E',
  label2: '#3C3C43',
  label3: '#7C7C82',
  label4: '#C7C7CC',
  line: '#E5E5EA',
  blue: '#007AFF',
  blueDeep: '#0040DD',
  blueStrong: '#A8C8FF',
  blueTint: '#E6F0FF',
  green: '#34C759',
  greenDeep: '#0A6B2A',
  greenSoft: '#B7E8C2',
  greenTint: '#E8F8EC',
  gray6: '#F2F2F7',
  serif: Platform.select({ ios: 'Iowan Old Style', default: 'Georgia' }) as string,
};

export function BlueprintIndex({
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
}: BlueprintIndexProps) {
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

  return (
    <View style={styles.screen}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable style={styles.back} onPress={onBack} hitSlop={8} disabled={!onBack}>
          <ChevronLeft size={18} color={C.blue} />
          <Text style={styles.backText}>{backLabel}</Text>
        </Pressable>
        <Text style={styles.topTtl}>Blueprint</Text>
        <Pressable hitSlop={8} onPress={onShare} disabled={!onShare} style={styles.topRight}>
          <Share2 size={18} color={C.label2} />
        </Pressable>
      </View>

      {/* Hero */}
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

      {/* Filter chips */}
      <View style={styles.filter}>
        <FilterChip
          label="All"
          n={counts.total}
          on={filter === 'all'}
          onPress={() => setFilter('all')}
        />
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

      {/* List */}
      <ScrollView style={styles.listScroll} contentContainerStyle={styles.list}>
        {visible.map((step) => (
          <StepRow
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

function StepRow({
  step,
  pending,
  onAdd,
}: {
  step: BlueprintIndexStep;
  pending: boolean;
  onAdd: () => void;
}) {
  const rowStyle =
    step.status === 'done'
      ? styles.rowDone
      : step.status === 'current'
        ? styles.rowCurrent
        : step.status === 'added'
          ? styles.rowAdded
          : styles.row;

  const numStyle =
    step.status === 'done'
      ? styles.numDone
      : step.status === 'current'
        ? styles.numCurrent
        : step.status === 'added'
          ? styles.numAdded
          : styles.num;

  return (
    <View style={rowStyle}>
      <View style={numStyle}>
        {step.status === 'done' ? (
          <Check size={13} color="#FFFFFF" />
        ) : (
          <Text
            style={[
              styles.numText,
              (step.status === 'current' || step.status === 'added') && styles.numTextLight,
            ]}
          >
            {step.number}
          </Text>
        )}
      </View>
      <View style={styles.rowMid}>
        <Text style={styles.rowTtl}>{step.title}</Text>
        {step.meta ? <Text style={styles.rowMeta}>{step.meta}</Text> : null}
      </View>
      {step.status === 'done' ? (
        <View style={[styles.pillSt, styles.pillStDone]}>
          <Check size={9} color={C.greenDeep} />
          <Text style={styles.pillStTextDone}>Done</Text>
        </View>
      ) : step.status === 'current' ? (
        <View style={[styles.pillSt, styles.pillStNow]}>
          <Flag size={9} color={C.blueDeep} />
          <Text style={styles.pillStTextNow}>Now</Text>
        </View>
      ) : step.status === 'added' ? (
        <View style={[styles.pillSt, styles.pillStAdded]}>
          <Check size={9} color={C.blueDeep} />
          <Text style={styles.pillStTextNow}>In plan</Text>
        </View>
      ) : (
        <Pressable
          style={[styles.addBtn, pending && styles.addBtnBusy]}
          onPress={onAdd}
          disabled={pending}
          accessibilityRole="button"
        >
          <Plus size={12} color="#FFFFFF" />
          <Text style={styles.addBtnText}>{pending ? 'Adding…' : 'Add'}</Text>
        </Pressable>
      )}
    </View>
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
    fontFamily: C.serif,
    fontStyle: 'italic',
    fontSize: 18,
    fontWeight: '500',
    color: C.label,
    letterSpacing: -0.3,
    lineHeight: 22,
    marginBottom: 6,
  },
  metaLine: {
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
  row: {
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowDone: {
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowCurrent: {
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowAdded: {
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  num: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.gray6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numDone: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.green,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numCurrent: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.blue,
    borderWidth: 3,
    borderColor: C.blueTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numAdded: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.blueTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.blueStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: {
    color: C.label2,
    fontSize: 12,
    fontWeight: '700',
  },
  numTextLight: {
    color: '#FFFFFF',
  },
  rowMid: {
    flex: 1,
  },
  rowTtl: {
    fontSize: 13,
    fontWeight: '600',
    color: C.label,
    letterSpacing: -0.1,
    lineHeight: 16,
  },
  rowMeta: {
    fontSize: 10.5,
    color: C.label3,
    letterSpacing: -0.05,
    marginTop: 2,
  },
  addBtn: {
    backgroundColor: C.blue,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  addBtnBusy: {
    opacity: 0.7,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: -0.05,
  },
  pillSt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 7,
    paddingRight: 9,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillStDone: {
    backgroundColor: C.greenTint,
    borderColor: C.greenSoft,
  },
  pillStNow: {
    backgroundColor: C.blueTint,
    borderColor: C.blueStrong,
  },
  pillStAdded: {
    backgroundColor: C.blueTint,
    borderColor: C.blueStrong,
  },
  pillStTextDone: {
    fontSize: 10,
    fontWeight: '700',
    color: C.greenDeep,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  pillStTextNow: {
    fontSize: 10,
    fontWeight: '700',
    color: C.blueDeep,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
