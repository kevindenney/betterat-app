/**
 * LinearWorkColumn — THE WORK as a single vertical sequence (replaces the
 * boustrophedon SnakeTimeline for L3 season zoom).
 *
 * The model (see project_step_timeline_sequence_not_calendar): a user-curated
 * queue punctuated by a few calendared anchors. This surface renders that
 * literally, top-to-bottom, with asymmetric density around NOW:
 *
 *   · Done sits behind NOW as a quiet, collapsible ledger — glanceable
 *     history, not competing for attention.
 *   · NOW is a full-width divider.
 *   · The runway ahead gets room. The single NEXT step is the hero
 *     (biggest, ringed); planned steps below it a notch smaller.
 *   · An ANCHOR is simply any step ahead of NOW that carries a real date
 *     (`whenLabel`) — a race, a clinical shift, a tournament, a market day.
 *     No special step type. When anchors exist, the prep that precedes each
 *     one groups under it ("Before · <anchor>"). When none do (most
 *     interests, most of the time), the runway is a flat list — loose
 *     anchors, not forced ones.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import type { Capability, StepStatus, TimelineStep } from './types';

const AZURE = '#007AFF';
const NOW_RED = '#FF6B5A';
const ROSE = '#D9476B';
const GREEN = '#1F8636';

const GENERIC_CAP_LABELS = [
  'general', 'practice', 'planning', 'plan', 'do', 'done', 'reflect',
  'reflecting', 'review',
];

const MONTHS = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec';

/** Behind NOW = the doing is finished (even if review is pending). */
function isPastNow(status: StepStatus): boolean {
  return status === 'done' || status === 'reflected' || status === 'reflect';
}

/** An anchor is any step with a real "by when" date. `whenLabel` is only
 *  populated when the adapter resolves a genuine schedule anchor, so its
 *  presence is the signal. A race is always an anchor even if the strap is
 *  somehow blank. */
function isAnchor(step: TimelineStep): boolean {
  return !!step.whenLabel || !!step.isRace;
}

function meaningfulCaps(caps?: Capability[]): Capability[] {
  return (caps ?? []).filter(
    (c) => !GENERIC_CAP_LABELS.includes(c.label.trim().toLowerCase()),
  );
}

/** Pull a compact month/day + time out of the adapter-formatted strap so the
 *  anchor can show a calendar block without re-parsing timezones from ISO. */
function parseAnchorWhen(whenLabel?: string): { mo: string; day: string; time: string } | null {
  if (!whenLabel) return null;
  const md = whenLabel.match(new RegExp(`\\b(${MONTHS})\\b\\.?\\s*(\\d{1,2})`, 'i'));
  if (!md) return null;
  const t = whenLabel.match(/(\d{1,2}:\d{2})\s*([AaPp])[Mm]/);
  return {
    mo: md[1].slice(0, 1).toUpperCase() + md[1].slice(1, 3).toLowerCase(),
    day: md[2],
    time: t ? `${t[1]}${t[2].toLowerCase()}` : '',
  };
}

function eyebrowFor(step: TimelineStep): string | undefined {
  const cap = meaningfulCaps(step.capabilities)[0]?.label;
  const place = step.locationName ?? undefined;
  const base = step.preTitle ?? cap;
  if (base && place) return `${base} · ${place}`;
  return base ?? place ?? step.metaLeft;
}

export interface LinearWorkColumnProps {
  steps: TimelineStep[];
  focusStepId: string;
  selectEnabled?: boolean;
  isSelected?: (id: string) => boolean;
  onOpenStep: (id: string) => void;
  onToggleSelect?: (id: string) => void;
  /** Long-press any card to enter reorder mode (omit to disable). */
  onLongPressStep?: () => void;
}

export function LinearWorkColumn({
  steps,
  focusStepId,
  selectEnabled,
  isSelected,
  onOpenStep,
  onToggleSelect,
  onLongPressStep,
}: LinearWorkColumnProps) {
  const { done, ahead, groups, tail, nextId, ordById } = useMemo(() => {
    const doneSteps = steps.filter((s) => isPastNow(s.status));
    const aheadSteps = steps.filter((s) => !isPastNow(s.status));

    // Anchor-grouping layer: accumulate prep until an anchor closes a group;
    // anything after the last anchor (or all of it, when no anchor exists)
    // falls through to a flat tail.
    const grps: { anchor: TimelineStep; prep: TimelineStep[] }[] = [];
    let buffer: TimelineStep[] = [];
    for (const s of aheadSteps) {
      if (isAnchor(s)) {
        grps.push({ anchor: s, prep: buffer });
        buffer = [];
      } else {
        buffer.push(s);
      }
    }
    // 1-based ordinal = position in the caller-ordered sequence.
    const ords = new Map<string, number>();
    steps.forEach((s, i) => ords.set(s.id, i + 1));
    return {
      done: doneSteps,
      ahead: aheadSteps,
      groups: grps,
      tail: buffer,
      nextId: aheadSteps[0]?.id ?? null,
      ordById: ords,
    };
  }, [steps]);

  const cardProps = {
    focusStepId,
    selectEnabled,
    isSelected,
    onOpenStep,
    onToggleSelect,
    onLongPressStep,
    nextId,
    ordById,
    total: steps.length,
  };

  return (
    <View style={styles.col}>
      {done.length > 0 ? <DoneLedger steps={done} {...cardProps} /> : null}

      {ahead.length > 0 ? <NowDivider /> : null}

      {groups.map((g) => (
        <View key={g.anchor.id} style={styles.group}>
          {g.prep.length > 1 ? (
            <GroupHeader anchor={g.anchor} prepCount={g.prep.length} />
          ) : null}
          {g.prep.length > 0 ? (
            <View style={styles.rail}>
              {g.prep.map((s) => (
                <StepCard key={s.id} step={s} {...cardProps} />
              ))}
            </View>
          ) : null}
          <AnchorBanner step={g.anchor} {...cardProps} />
        </View>
      ))}

      {tail.map((s) => (
        <StepCard key={s.id} step={s} {...cardProps} />
      ))}
    </View>
  );
}

/* ───────────────────────── done ledger ───────────────────────── */

interface SharedCardProps {
  focusStepId: string;
  selectEnabled?: boolean;
  isSelected?: (id: string) => boolean;
  onOpenStep: (id: string) => void;
  onToggleSelect?: (id: string) => void;
  onLongPressStep?: () => void;
  nextId: string | null;
  ordById: Map<string, number>;
  total: number;
}

function DoneLedger({ steps, ...shared }: { steps: TimelineStep[] } & SharedCardProps) {
  const [open, setOpen] = useState(true);
  return (
    <View style={styles.ledger}>
      <Pressable style={styles.ledgerHead} onPress={() => setOpen((v) => !v)}>
        <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={11} color={IOS_REGISTER.labelTertiary} />
        <Text style={styles.ledgerHeadText}>Done · {steps.length}</Text>
      </Pressable>
      {open
        ? steps.map((s) => <DoneCard key={s.id} step={s} {...shared} />)
        : null}
    </View>
  );
}

// Done is the same card family as the runway ahead — just recessed and
// green-keyed — so the whole sequence reads as one stack of step-cards
// instead of a list that changes shape at NOW.
function DoneCard({ step, total, ordById, selectEnabled, isSelected, onOpenStep, onToggleSelect, onLongPressStep }:
  { step: TimelineStep } & SharedCardProps) {
  const selected = isSelected?.(step.id) ?? false;
  const caps = meaningfulCaps(step.capabilities).slice(0, 4);
  const capLabels = caps.map((c) => c.label).join(' · ');
  const eyebrow = eyebrowFor(step);
  return (
    <Pressable
      style={[styles.card, styles.cardDone, selected && styles.cardSelected]}
      onPress={selectEnabled ? () => onToggleSelect?.(step.id) : () => onOpenStep(step.id)}
      onLongPress={onLongPressStep}
      delayLongPress={300}
    >
      {eyebrow ? <Text style={styles.eyebrow} numberOfLines={1}>{eyebrow}</Text> : null}
      <View style={styles.cardRow1}>
        {selectEnabled ? (
          <View style={[styles.checkbox, selected && styles.checkboxOn]} />
        ) : (
          <View style={[styles.pill, styles.pillDone]}>
            <Ionicons name="checkmark" size={10} color={GREEN} />
            <Text style={[styles.pillText, styles.pillDoneText]}>DONE</Text>
          </View>
        )}
        <Text style={styles.ord}>{indexLabel(ordById.get(step.id), total)}</Text>
      </View>
      <Text style={[styles.title, styles.titleDone]} numberOfLines={2}>{step.title}</Text>
      {caps.length > 0 ? (
        <View style={styles.capsRow}>
          {caps.map((c) => (
            <View key={c.id} style={[styles.cdot, { backgroundColor: c.color }]} />
          ))}
          {capLabels ? <Text style={styles.capLbl} numberOfLines={1}>{capLabels}</Text> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

/* ───────────────────────── NOW divider ───────────────────────── */

function NowDivider() {
  return (
    <View style={styles.now}>
      <View style={styles.nowPin} />
      <View style={styles.nowLine} />
      <Text style={styles.nowLabel}>NOW</Text>
      <View style={[styles.nowLine, styles.nowLineR]} />
    </View>
  );
}

/* ───────────────────────── anchor group ───────────────────────── */

function GroupHeader({ anchor, prepCount }: { anchor: TimelineStep; prepCount: number }) {
  const when = parseAnchorWhen(anchor.whenLabel);
  // Anchors share one "destination" accent across every interest — rose is
  // the dated thing the runway builds toward, whether it's a race, a market
  // day, or a clinical shift. A race is just an anchor that also earns the
  // RACE pill; the colour does not carry the sailing-only meaning.
  const tint = ROSE;
  return (
    <View style={styles.groupHead}>
      <View style={[styles.groupFlag, { backgroundColor: tint }]} />
      <Text style={[styles.groupTitle, { color: tint }]} numberOfLines={1}>
        Before · {anchor.title}
      </Text>
      {prepCount > 0 ? (
        <Text style={styles.groupCount}>{prepCount} to go</Text>
      ) : null}
      {when ? (
        <Text style={styles.groupDate}>{when.mo} {when.day}</Text>
      ) : anchor.whenLabel ? (
        <Text style={styles.groupDate} numberOfLines={1}>{anchor.whenLabel}</Text>
      ) : null}
    </View>
  );
}

function AnchorBanner({ step, total, ordById, focusStepId, selectEnabled, isSelected, onOpenStep, onToggleSelect, onLongPressStep, nextId }:
  { step: TimelineStep } & SharedCardProps) {
  const when = parseAnchorWhen(step.whenLabel);
  const tint = ROSE;
  const selected = isSelected?.(step.id) ?? false;
  const isFocused = step.id === focusStepId;
  const isNext = step.id === nextId;
  return (
    <Pressable
      style={[styles.anchor, { borderLeftColor: isNext ? NOW_RED : tint, borderLeftWidth: isNext ? 5 : 4 }, isFocused && styles.cardFocused, selected && styles.cardSelected]}
      onPress={selectEnabled ? () => onToggleSelect?.(step.id) : () => onOpenStep(step.id)}
      onLongPress={onLongPressStep}
      delayLongPress={300}
    >
      <View style={[styles.cal, { borderRightColor: 'rgba(60,60,67,0.14)' }]}>
        {when ? (
          <>
            <Text style={[styles.calMo, { color: tint }]}>{when.mo.toUpperCase()}</Text>
            <Text style={styles.calDay}>{when.day}</Text>
            {when.time ? <Text style={styles.calTime}>{when.time}</Text> : null}
          </>
        ) : (
          <Ionicons name="flag" size={20} color={tint} />
        )}
      </View>
      <View style={styles.anchorBody}>
        <View style={styles.cardRow1}>
          <View style={[styles.pill, step.isRace ? styles.pillRace : isNext ? styles.pillNext : styles.pillPlanned]}>
            <Text style={[styles.pillText, { color: step.isRace ? ROSE : isNext ? '#0046A8' : IOS_REGISTER.labelSecondary }]}>
              {step.isRace ? 'RACE' : isNext ? 'NEXT' : 'PLANNED'}
            </Text>
          </View>
          <Text style={styles.ord}>{indexLabel(ordById.get(step.id), total)}</Text>
        </View>
        <Text style={[styles.title, styles.anchorTitle]} numberOfLines={2}>{step.title}</Text>
        <Text style={styles.anchorBuild}>The fixed point everything above builds toward.</Text>
      </View>
    </Pressable>
  );
}

/* ───────────────────────── step card ───────────────────────── */

function StepCard({ step, total, ordById, focusStepId, selectEnabled, isSelected, onOpenStep, onToggleSelect, onLongPressStep, nextId }:
  { step: TimelineStep } & SharedCardProps) {
  const isNext = step.id === nextId;
  const isFocused = step.id === focusStepId;
  const selected = isSelected?.(step.id) ?? false;
  const caps = meaningfulCaps(step.capabilities).slice(0, 4);
  const capLabels = caps.map((c) => c.label).join(' · ');
  const eyebrow = eyebrowFor(step);

  return (
    <Pressable
      style={[
        styles.card,
        isNext && styles.cardNext,
        isFocused && !isNext && styles.cardFocused,
        selected && styles.cardSelected,
      ]}
      onPress={selectEnabled ? () => onToggleSelect?.(step.id) : () => onOpenStep(step.id)}
      onLongPress={onLongPressStep}
      delayLongPress={300}
    >
      {eyebrow ? <Text style={styles.eyebrow} numberOfLines={1}>{eyebrow}</Text> : null}
      <View style={styles.cardRow1}>
        {selectEnabled ? (
          <View style={[styles.checkbox, selected && styles.checkboxOn]} />
        ) : (
          <View style={[styles.pill, isNext ? styles.pillNext : styles.pillPlanned]}>
            <Text style={[styles.pillText, { color: isNext ? '#0046A8' : IOS_REGISTER.labelSecondary }]}>
              {isNext ? 'NEXT' : 'PLANNED'}
            </Text>
          </View>
        )}
        <Text style={styles.ord}>{indexLabel(ordById.get(step.id), total)}</Text>
      </View>
      <Text style={[styles.title, isNext ? styles.titleNext : styles.titlePlanned]} numberOfLines={3}>
        {step.title}
      </Text>
      {caps.length > 0 ? (
        <View style={styles.capsRow}>
          {caps.map((c) => (
            <View key={c.id} style={[styles.cdot, { backgroundColor: c.color }]} />
          ))}
          {capLabels ? <Text style={styles.capLbl} numberOfLines={1}>{capLabels}</Text> : null}
        </View>
      ) : null}
      {isNext && !selectEnabled ? (
        <View style={styles.startRow}>
          <Text style={styles.startText}>Pick this up</Text>
          <Ionicons name="arrow-forward" size={13} color={AZURE} />
        </View>
      ) : null}
    </Pressable>
  );
}

/** 1-based position in the caller-ordered sequence (built in LinearWorkColumn
 *  from the steps array) over the total count: "3/5". */
function indexLabel(ord: number | undefined, total: number): string {
  return ord ? `${ord}/${total}` : '';
}

/* ───────────────────────── legend ───────────────────────── */

export function WorkColumnLegend({ steps, anchorNoun = 'anchor' }: { steps: TimelineStep[]; anchorNoun?: string }) {
  const hasAnchor = steps.some(isAnchor);
  return (
    <View style={styles.legend}>
      <Legend color={GREEN} label="done" />
      <Legend color={AZURE} label="next" />
      <Legend color="#C7C7CC" label="planned" />
      {hasAnchor ? <Legend color={ROSE} label={anchorNoun} /> : null}
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendKey}>
      <View style={[styles.legendSw, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  col: { paddingHorizontal: 2, paddingTop: 4 },

  /* done ledger */
  ledger: { marginBottom: 2 },
  ledgerHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 2 },
  ledgerHeadText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: IOS_REGISTER.labelTertiary, textTransform: 'uppercase' },

  /* NOW */
  now: { flexDirection: 'row', alignItems: 'center', gap: 9, marginVertical: 14, paddingHorizontal: 2 },
  nowPin: { width: 9, height: 9, borderRadius: 999, backgroundColor: NOW_RED },
  nowLine: { flex: 1, height: 1.5, backgroundColor: 'rgba(255,107,90,0.5)' },
  nowLineR: {},
  nowLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6, color: NOW_RED },

  /* anchor group */
  group: { marginBottom: 4 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 6, marginBottom: 10, paddingHorizontal: 2 },
  groupFlag: { width: 8, height: 8, borderRadius: 2 },
  groupTitle: { flex: 1, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  groupCount: { fontSize: 10.5, color: IOS_REGISTER.labelTertiary, fontVariant: ['tabular-nums'] },
  groupDate: { fontSize: 11, color: IOS_REGISTER.labelTertiary, fontVariant: ['tabular-nums'] },
  rail: { borderLeftWidth: 2, borderLeftColor: 'rgba(217,71,107,0.28)', borderStyle: 'dashed', marginLeft: 8, paddingLeft: 15, gap: 11 },

  /* cards */
  card: { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: 'rgba(60,60,67,0.16)', borderRadius: 16, paddingHorizontal: 15, paddingVertical: 14, marginTop: 11, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  // The NOW-red left rail ties the next card to the NowDivider directly above
  // it, so "NOW → do this" reads as a single unit; the rest of the card keeps
  // its blue NEXT treatment.
  cardNext: { borderWidth: 1.5, borderColor: AZURE, borderLeftWidth: 5, borderLeftColor: NOW_RED, backgroundColor: 'rgba(0,122,255,0.05)', shadowColor: AZURE, shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  cardDone: { backgroundColor: '#F4F6F4', borderColor: 'rgba(31,134,54,0.20)', shadowOpacity: 0, elevation: 0, marginTop: 9 },
  cardFocused: { borderColor: AZURE, borderWidth: 1 },
  cardSelected: { borderColor: AZURE, backgroundColor: 'rgba(0,122,255,0.06)' },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase', color: IOS_REGISTER.labelTertiary, marginBottom: 6 },
  cardRow1: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillNext: { backgroundColor: 'rgba(0,122,255,0.14)' },
  pillPlanned: { backgroundColor: '#F0F0F4' },
  pillRace: { backgroundColor: 'rgba(217,71,107,0.14)' },
  pillDone: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(52,199,89,0.16)' },
  pillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  pillDoneText: { color: GREEN },
  ord: { fontFamily: fontFamily.mono, fontSize: 11, color: '#b6b8be', fontVariant: ['tabular-nums'] },
  title: { fontFamily: fontFamily.serif, fontStyle: 'italic', color: IOS_REGISTER.label, lineHeight: 21 },
  titleNext: { fontSize: 18 },
  titlePlanned: { fontSize: 15, lineHeight: 19 },
  titleDone: { fontSize: 14, lineHeight: 18, color: '#565b56' },
  capsRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 11 },
  capLbl: { fontSize: 10.5, color: '#9a9ca2', marginLeft: 3, flex: 1 },
  cdot: { width: 6, height: 14, borderRadius: 2 },
  startRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 13 },
  startText: { fontSize: 13, fontWeight: '700', color: AZURE },

  /* anchor banner */
  anchor: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', backgroundColor: '#fff', borderWidth: 0.5, borderColor: 'rgba(60,60,67,0.16)', borderLeftWidth: 4, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, marginTop: 13, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cal: { width: 48, alignItems: 'center', borderRightWidth: 1, paddingRight: 13 },
  calMo: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  calDay: { fontSize: 23, fontWeight: '800', color: IOS_REGISTER.label, lineHeight: 25, marginTop: 1 },
  calTime: { fontSize: 10, color: IOS_REGISTER.labelTertiary, marginTop: 2, fontVariant: ['tabular-nums'] },
  anchorBody: { flex: 1, minWidth: 0 },
  anchorTitle: { fontSize: 16, marginTop: 6 },
  anchorBuild: { fontSize: 11, color: IOS_REGISTER.labelTertiary, marginTop: 8 },

  /* select checkbox */
  checkbox: { width: 18, height: 18, borderRadius: 999, borderWidth: 1.5, borderColor: IOS_REGISTER.separatorStrong },
  checkboxOn: { backgroundColor: AZURE, borderColor: AZURE },

  /* legend */
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 16, paddingTop: 14, paddingHorizontal: 2, borderTopWidth: 0.5, borderTopColor: 'rgba(60,60,67,0.16)' },
  legendKey: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSw: { width: 9, height: 9, borderRadius: 3 },
  legendText: { fontSize: 11, color: IOS_REGISTER.labelTertiary },
});
