/**
 * SnakeTimeline — the boustrophedon "step river" for L3 (season) and L4
 * (all-time). Steps lay out in horizontal lanes that alternate direction
 * down the page (left→right, then right→left…), and a NOW-anchored thread
 * weaves through every node: solid + colored for the reached portion
 * (done → NOW), dashed + gray for what's still planned downstream.
 *
 * Ported from the desktop/mobile mockups (public/timeline-zoom-*.html).
 * The thread is an SVG overlay drawn from measured node centers — each
 * lane reports its y-offset and each card its frame, and the two combine
 * into container-space points the path connects (straight within a lane,
 * a cubic-bezier U-turn between lanes).
 *
 * Two presentations share the threading machinery:
 *   - mode="cards"  — season zoom: compact step cards (2 per lane).
 *   - mode="nodes"  — all-time zoom: steps shrink to labelled dots
 *                     (~5 per lane), milestones get a star.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { useDragReorder } from './useDragReorder';
import type { StepStatus, TimelineStep } from './types';

const NOW = '#FF6B5A';
const AZURE = '#007AFF';
// Race steps — the one first-class step distinction — get a rose left
// stripe (mockup §race step). Takes priority over the azure provenance stripe.
const ROSE = '#D9476B';
const GREEN = '#1E9E6A';
const LILAC = '#9D70C9';
const THREAD_TRACK = 'rgba(60, 60, 67, 0.22)';

const LANE_PAD_TOP = 32;
const LANE_PAD_H = 6;
const NODE_GAP = 16; // node center sits this far above the card/dot top
const NODE_R = 6;

const GENERIC_CAP_LABELS = [
  'general', 'practice', 'planning', 'plan', 'do', 'done', 'reflect',
  'reflecting', 'review',
];

/** Past the NOW bar: the doing is finished even if review is pending. */
function isPastNow(status: StepStatus): boolean {
  return status === 'done' || status === 'reflected' || status === 'reflect';
}

/** First step in display order that hasn't been done — the single NEXT. */
function nextStepIndex(statuses: StepStatus[]): number {
  return statuses.findIndex((s) => !isPastNow(s));
}

// A step is either done or planned, with exactly one NEXT (the first
// planned step to the right of NOW). No NOW/DOING pills — NOW is the
// position marker on the thread, not a step state.
function pillFor(status: StepStatus, isNext: boolean): { label: string; color: string; bg: string } {
  switch (status) {
    case 'done':
    case 'reflected':
      return { label: 'DONE', color: '#1F8636', bg: 'rgba(52,199,89,0.16)' };
    case 'reflect':
      return { label: 'REVIEW', color: LILAC, bg: 'rgba(157,112,201,0.14)' };
    default:
      if (isNext) return { label: 'NEXT', color: '#0046A8', bg: 'rgba(0,122,255,0.14)' };
      return { label: 'PLANNED', color: IOS_REGISTER.labelSecondary, bg: '#F2F2F7' };
  }
}

/** A single laid-out node center in container coordinates. */
interface Pt { x: number; y: number }

/** Shared geometry: measure lanes + items, emit the track/prog SVG paths.
 *  `pointYOffset` shifts the thread vertically off each item's top edge:
 *  cards draw their node ABOVE the card (negative), node-dots sit just
 *  inside the item top (small positive). */
function useSnakeThread(
  count: number,
  perLane: number,
  doneFlags: boolean[],
  pointYOffset: number,
  nowIndex: number,
) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const laneY = useRef<Record<number, number>>({});
  const frames = useRef<Record<number, { x: number; y: number; w: number; h: number }>>({});
  const [version, setVersion] = useState(0);

  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) =>
      Math.abs(prev.w - width) > 0.5 || Math.abs(prev.h - height) > 0.5
        ? { w: width, h: height }
        : prev,
    );
  }, []);

  const onLaneLayout = useCallback((laneIndex: number) => (e: LayoutChangeEvent) => {
    const y = e.nativeEvent.layout.y;
    if (Math.abs((laneY.current[laneIndex] ?? -1) - y) > 0.5) {
      laneY.current[laneIndex] = y;
      setVersion((v) => v + 1);
    }
  }, []);

  const onItemLayout = useCallback((index: number) => (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    const prev = frames.current[index];
    if (!prev || Math.abs(prev.x - x) > 0.5 || Math.abs(prev.y - y) > 0.5 || Math.abs(prev.w - width) > 0.5) {
      frames.current[index] = { x, y, w: width, h: height };
      setVersion((v) => v + 1);
    }
  }, []);

  const { track, prog, nowPoint } = useMemo(() => {
    void version; // recompute when measurements change
    const empty = { track: '', prog: '', nowPoint: null as Pt | null };
    const pts: Pt[] = [];
    for (let i = 0; i < count; i++) {
      const f = frames.current[i];
      const ly = laneY.current[Math.floor(i / perLane)];
      if (!f || ly == null) return empty;
      pts.push({ x: f.x + f.w / 2, y: ly + f.y + pointYOffset });
    }
    if (pts.length < 2) return empty;

    const mid = size.w / 2;
    const seg = (a: Pt, b: Pt) => {
      if (Math.abs(b.y - a.y) < 12) return ` L ${b.x} ${b.y}`;
      const out = (a.x > mid ? 1 : -1) * Math.min(24, Math.max(16, Math.abs(b.y - a.y) * 0.5));
      return ` C ${a.x + out} ${a.y}, ${b.x + out} ${b.y}, ${b.x} ${b.y}`;
    };

    let full = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) full += seg(pts[i - 1], pts[i]);
    // Solid azure only where BOTH endpoints are done — so a done step that
    // sorts after a planned one stays on the dashed track instead of getting
    // bridged by a contiguous prefix. Each solid run is its own M-subpath.
    let pr = '';
    for (let i = 1; i < pts.length; i++) {
      if (doneFlags[i - 1] && doneFlags[i]) {
        pr += ` M ${pts[i - 1].x} ${pts[i - 1].y}` + seg(pts[i - 1], pts[i]);
      }
    }
    const np = nowIndex >= 0 && nowIndex < pts.length ? pts[nowIndex] : null;
    return { track: full, prog: pr.trim(), nowPoint: np };
  }, [version, count, perLane, doneFlags, size.w, pointYOffset, nowIndex]);

  return { size, onContainerLayout, onLaneLayout, onItemLayout, track, prog, nowPoint };
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/** The single red NOW anchor floating above the focus node on the thread. */
function NowFlag({ x, y }: { x: number; y: number }) {
  return (
    <View style={[styles.nowFlag, { left: x, top: Math.max(0, y - 26) }]} pointerEvents="none">
      <View style={styles.nowFlagPill}>
        <Text style={styles.nowFlagText}>NOW</Text>
      </View>
      <View style={styles.nowFlagStem} />
    </View>
  );
}

/* ───────────────────────── cards (season) ───────────────────────── */

export interface SnakeStepTimelineProps {
  /** Chronological order (oldest → newest) so the thread runs done → NOW → planned. */
  steps: TimelineStep[];
  focusStepId: string;
  perLane?: number;
  selectEnabled?: boolean;
  isSelected?: (id: string) => boolean;
  onOpenStep: (id: string) => void;
  onToggleSelect?: (id: string) => void;
  /** Long-press any card to enter reorder mode (omit to disable). */
  onLongPressStep?: () => void;
}

export function SnakeStepTimeline({
  steps,
  focusStepId,
  perLane = 2,
  selectEnabled,
  isSelected,
  onOpenStep,
  onToggleSelect,
  onLongPressStep,
}: SnakeStepTimelineProps) {
  // NOW sits between the done run and the first planned step; the flag
  // rides the NEXT card and the solid thread covers only done steps.
  // When every step is done there is no NEXT — NOW would otherwise park on
  // the last (done) card, falsely flagging finished work as current, so we
  // drop the flag entirely (the full solid thread already reads "all done").
  const nextIdx = nextStepIndex(steps.map((s) => s.status));
  const nowIndex = nextIdx;
  const doneFlags = useMemo(() => steps.map((s) => isPastNow(s.status)), [steps]);
  const { size, onContainerLayout, onLaneLayout, onItemLayout, track, prog, nowPoint } =
    useSnakeThread(steps.length, perLane, doneFlags, -NODE_GAP, nowIndex);

  const lanes = useMemo(() => chunk(steps, perLane), [steps, perLane]);

  return (
    <View style={styles.snake} onLayout={onContainerLayout}>
      {size.w > 0 && track ? (
        <Svg style={StyleSheet.absoluteFill} width={size.w} height={size.h} pointerEvents="none">
          <Path d={track} fill="none" stroke={THREAD_TRACK} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 8" />
          {prog ? (
            <Path d={prog} fill="none" stroke={AZURE} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
        </Svg>
      ) : null}

      {nowPoint ? <NowFlag x={nowPoint.x} y={nowPoint.y} /> : null}

      {lanes.map((lane, laneIndex) => (
        <View
          key={laneIndex}
          style={[styles.lane, laneIndex % 2 === 1 && styles.laneRev]}
          onLayout={onLaneLayout(laneIndex)}
        >
          {lane.map((step, j) => {
            const globalIndex = laneIndex * perLane + j;
            const selected = isSelected?.(step.id) ?? false;
            return (
              <View key={step.id} style={styles.cardSlot} onLayout={onItemLayout(globalIndex)}>
                <SnakeCard
                  step={step}
                  isFocused={step.id === focusStepId}
                  isNext={globalIndex === nextIdx}
                  ordinal={globalIndex + 1}
                  total={steps.length}
                  selectEnabled={selectEnabled}
                  selected={selected}
                  onPress={selectEnabled ? () => onToggleSelect?.(step.id) : () => onOpenStep(step.id)}
                  onLongPress={onLongPressStep}
                />
              </View>
            );
          })}
          {lane.length < perLane
            ? Array.from({ length: perLane - lane.length }).map((_, k) => (
                <View key={`sp-${k}`} style={styles.cardSlot} />
              ))
            : null}
        </View>
      ))}
    </View>
  );
}

function SnakeCard({
  step,
  isFocused,
  isNext,
  ordinal,
  total,
  selectEnabled,
  selected,
  onPress,
  onLongPress,
}: {
  step: TimelineStep;
  /** The step whose detail is open — highlight only, not a status. */
  isFocused: boolean;
  /** The single first-planned-after-NOW step. */
  isNext: boolean;
  ordinal: number;
  total: number;
  selectEnabled?: boolean;
  selected: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const pill = pillFor(step.status, isNext);
  const isDone = step.status === 'done' || step.status === 'reflected';
  const caps = (step.capabilities ?? []).filter(
    (c) => !GENERIC_CAP_LABELS.includes(c.label.trim().toLowerCase()),
  );
  const stripeColor = step.isRace ? ROSE : step.from ? AZURE : null;
  const nodeFilled = isDone || isNext;
  // Eyebrow — prefer the schedule pre-title (TODAY · MORNING); fall back to
  // the dominant capability name so most cards carry a context label like
  // the mockup's ptag (Drills, Tactics, HKDW prep).
  const eyebrow = step.preTitle ?? caps[0]?.label;
  // Date strap — the schedule date if known, else the meta-left
  // (day · location). Omitted when the step has neither.
  const meta = step.whenLabel ?? step.metaLeft;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      style={[
        styles.card,
        isNext && styles.cardNext,
        isFocused && styles.cardNow,
        isDone && styles.cardDone,
        selected && styles.cardSelected,
      ]}
    >
      <View
        style={[
          styles.node,
          nodeFilled && { backgroundColor: isNext ? '#FFFFFF' : AZURE, borderColor: isNext ? AZURE : '#FAF8F4' },
          isNext && styles.nodeNow,
        ]}
      />
      {stripeColor ? <View style={[styles.stripe, { backgroundColor: stripeColor }]} /> : null}

      <View style={styles.cardTop}>
        {selectEnabled ? (
          <View style={[styles.checkbox, selected && styles.checkboxOn]} />
        ) : (
          <View style={[styles.pill, { backgroundColor: pill.bg }]}>
            <Text style={[styles.pillText, { color: pill.color }]}>{pill.label}</Text>
          </View>
        )}
        <Text style={styles.stepNo}>{ordinal} / {total}</Text>
      </View>

      {eyebrow ? (
        <Text style={styles.preTitle} numberOfLines={1}>{eyebrow}</Text>
      ) : null}

      <Text style={styles.title} numberOfLines={3}>{step.title}</Text>

      {meta ? (
        <Text style={styles.metaLine} numberOfLines={1}>{meta}</Text>
      ) : null}

      {caps.length > 0 ? (
        <View style={styles.metaRow}>
          <View style={styles.caps}>
            {caps.slice(0, 4).map((c) => (
              <View key={c.id} style={[styles.cdot, { backgroundColor: c.color }]} />
            ))}
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

/* ───────────────────────── legend ───────────────────────── */

/** Decodes the snake's visual grammar: the azure/dashed thread, the red
 *  NOW anchor, and the rose race stripe. Render once beneath the river. */
export function SnakeLegend() {
  return (
    <View style={styles.legend}>
      <View style={styles.legendKey}>
        <View style={[styles.legendLine, { backgroundColor: AZURE }]} />
        <Text style={styles.legendText}>done</Text>
      </View>
      <View style={styles.legendKey}>
        <View style={styles.legendLineDashed}>
          <View style={styles.legendDash} />
          <View style={styles.legendDash} />
          <View style={styles.legendDash} />
        </View>
        <Text style={styles.legendText}>planned</Text>
      </View>
      <View style={styles.legendKey}>
        <View style={[styles.legendDot, { backgroundColor: NOW }]} />
        <Text style={styles.legendText}>now</Text>
      </View>
      <View style={styles.legendKey}>
        <View style={[styles.legendSwatch, { backgroundColor: ROSE }]} />
        <Text style={styles.legendText}>race</Text>
      </View>
    </View>
  );
}

/* ───────────────────────── nodes (all-time) ───────────────────────── */

export interface SnakeNode {
  id: string;
  label: string;
  /** Season-identity color for the dot. */
  color: string;
  big?: boolean;
  milestone?: boolean;
  star?: string;
  /** True for the single NOW node (red, ringed). */
  now?: boolean;
}

export interface SnakeNodeRiverProps {
  nodes: SnakeNode[];
  /** Number of nodes reached (done → NOW) — drives the solid progress thread. */
  progressCount: number;
  perLane?: number;
  onPressNode?: (id: string) => void;
}

export function SnakeNodeRiver({
  nodes,
  progressCount,
  perLane = 5,
  onPressNode,
}: SnakeNodeRiverProps) {
  const nowIndex = nodes.findIndex((n) => n.now);
  const doneFlags = useMemo(
    () => nodes.map((_, i) => i < progressCount),
    [nodes, progressCount],
  );
  const { size, onContainerLayout, onLaneLayout, onItemLayout, track, prog, nowPoint } =
    useSnakeThread(nodes.length, perLane, doneFlags, 6, nowIndex);
  const lanes = useMemo(() => chunk(nodes, perLane), [nodes, perLane]);

  return (
    <View style={styles.snake} onLayout={onContainerLayout}>
      {size.w > 0 && track ? (
        <Svg style={StyleSheet.absoluteFill} width={size.w} height={size.h} pointerEvents="none">
          <Path d={track} fill="none" stroke={THREAD_TRACK} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 8" />
          {prog ? (
            <Path d={prog} fill="none" stroke={GREEN} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
        </Svg>
      ) : null}

      {nowPoint ? <NowFlag x={nowPoint.x} y={nowPoint.y} /> : null}

      {lanes.map((lane, laneIndex) => (
        <View
          key={laneIndex}
          style={[styles.nodeLane, laneIndex % 2 === 1 && styles.nodeLaneRev]}
          onLayout={onLaneLayout(laneIndex)}
        >
          {lane.map((n, j) => {
            const globalIndex = laneIndex * perLane + j;
            return (
              <Pressable
                key={n.id}
                style={styles.nnode}
                onLayout={onItemLayout(globalIndex)}
                onPress={onPressNode ? () => onPressNode(n.id) : undefined}
              >
                {n.star ? <Text style={styles.nstar}>{n.star}</Text> : null}
                <View
                  style={[
                    styles.ndot,
                    { backgroundColor: n.now ? NOW : n.color },
                    n.big && styles.ndotBig,
                    n.now && styles.ndotNow,
                  ]}
                />
                <Text
                  style={[styles.nlab, n.milestone && styles.nlabMilestone]}
                  numberOfLines={2}
                >
                  {n.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/* ───────────────────────── reorder mode ───────────────────────── */

export interface SnakeReorderListProps {
  /** Same chronological order the snake renders (oldest → newest). */
  steps: TimelineStep[];
  /** (stepId, fromIndex, toIndex) in the flat list — caller resolves neighbours. */
  onReorder: (stepId: string, fromIndex: number, toIndex: number) => void;
  /** Mirror the lifted state up so the parent can freeze its ScrollView. */
  onDraggingChange?: (dragging: boolean) => void;
}

/** Reorder mode: the snake flattens into a single-column drag list — a
 *  boustrophedon grid can't host an in-place drag, but order is 1-D, so
 *  long-press-lift + vertical drag maps onto the same sort_order the
 *  river renders. "Done" returns to the snake. */
export function SnakeReorderList({
  steps,
  onReorder,
  onDraggingChange,
}: SnakeReorderListProps) {
  const drag = useDragReorder<TimelineStep>({
    items: steps,
    enabled: steps.length > 1,
    axis: 'vertical',
    onReorder,
  });

  useEffect(() => {
    onDraggingChange?.(drag.isDragging);
  }, [drag.isDragging, onDraggingChange]);

  const nextIdx = nextStepIndex(steps.map((s) => s.status));

  return (
    <View style={styles.reorderList}>
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          {index === nextIdx && nextIdx > 0 ? (
            <View style={styles.reorderNow}>
              <View style={styles.reorderNowLine} />
              <Text style={styles.reorderNowLabel}>NOW</Text>
              <View style={styles.reorderNowLine} />
            </View>
          ) : null}
          <ReorderRow
            step={step}
            index={index}
            ordinal={index + 1}
            isNext={index === nextIdx}
            isLifted={drag.liftedId === step.id}
            showDropBefore={drag.dropTargetIndex === index && drag.liftedId !== step.id}
            liftedTranslateY={drag.liftedTranslate}
            buildGesture={drag.buildItemGesture}
            registerRowLayout={drag.registerRowLayout}
          />
        </React.Fragment>
      ))}
    </View>
  );
}

function ReorderRow({
  step,
  index,
  ordinal,
  isNext,
  isLifted,
  showDropBefore,
  liftedTranslateY,
  buildGesture,
  registerRowLayout,
}: {
  step: TimelineStep;
  index: number;
  ordinal: number;
  isNext: boolean;
  isLifted: boolean;
  showDropBefore: boolean;
  liftedTranslateY: number;
  buildGesture: ReturnType<typeof useDragReorder>['buildItemGesture'];
  registerRowLayout: ReturnType<typeof useDragReorder>['registerRowLayout'];
}) {
  const gesture = useMemo(
    () => buildGesture(step.id, index),
    [buildGesture, step.id, index],
  );
  const liftStyle = useAnimatedStyle(() => {
    if (!isLifted) return { transform: [] as never[] };
    return {
      transform: [{ translateY: liftedTranslateY }, { scale: 1.02 }],
      zIndex: 10,
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 10,
    };
  }, [isLifted, liftedTranslateY]);
  const pill = pillFor(step.status, isNext);

  return (
    <View
      onLayout={(e) => {
        const { y, height } = e.nativeEvent.layout;
        registerRowLayout(step.id, { start: y, length: height });
      }}
    >
      {showDropBefore ? <View style={styles.dropIndicator} /> : null}
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[styles.reorderRow, isLifted && styles.reorderRowLifted, liftStyle]}
        >
          <Ionicons
            name="reorder-three-outline"
            size={18}
            color={IOS_REGISTER.labelTertiary}
          />
          <Text style={styles.reorderOrdinal}>{ordinal}</Text>
          <View style={[styles.pill, { backgroundColor: pill.bg }]}>
            <Text style={[styles.pillText, { color: pill.color }]}>{pill.label}</Text>
          </View>
          <Text style={styles.reorderTitle} numberOfLines={1}>{step.title}</Text>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  snake: {
    position: 'relative',
    marginTop: 6,
  },

  /* single red NOW anchor floating above the focus node */
  nowFlag: {
    position: 'absolute',
    width: 60,
    marginLeft: -30,
    alignItems: 'center',
    zIndex: 5,
  },
  nowFlagPill: {
    backgroundColor: NOW,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    shadowColor: NOW,
    shadowOpacity: 0.45,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  nowFlagText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  nowFlagStem: {
    width: 2,
    height: 7,
    backgroundColor: NOW,
    borderRadius: 1,
    marginTop: 1,
  },

  /* flatten-to-list reorder mode */
  reorderList: {
    marginHorizontal: 16,
    marginTop: 4,
  },
  reorderNow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
    marginBottom: 10,
  },
  reorderNowLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: NOW,
    opacity: 0.5,
  },
  reorderNowLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: NOW,
  },
  reorderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: IOS_REGISTER.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 8,
  },
  reorderRowLifted: {
    borderColor: AZURE,
    backgroundColor: '#FFFFFF',
  },
  reorderOrdinal: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    color: IOS_REGISTER.labelTertiary,
    width: 18,
    fontVariant: ['tabular-nums'],
  },
  reorderTitle: {
    flex: 1,
    fontFamily: fontFamily.serif,
    fontStyle: 'italic',
    fontSize: 14.5,
    color: IOS_REGISTER.label,
    letterSpacing: -0.1,
  },
  dropIndicator: {
    position: 'absolute',
    top: -6,
    left: 4,
    right: 4,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: AZURE,
    zIndex: 20,
  },

  /* legend — decodes the river grammar */
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    rowGap: 8,
    columnGap: 14,
    marginTop: 14,
    marginHorizontal: 16,
  },
  legendKey: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendText: {
    fontSize: 11,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: 0.05,
  },
  legendLine: {
    width: 20,
    height: 3,
    borderRadius: 2,
  },
  legendLineDashed: {
    width: 20,
    height: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legendDash: {
    width: 4,
    height: 3,
    borderRadius: 1,
    backgroundColor: 'rgba(60,60,67,0.4)',
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
  legendSwatch: {
    width: 9,
    height: 9,
    borderRadius: 2,
  },

  /* card lanes */
  lane: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: LANE_PAD_TOP,
    paddingHorizontal: LANE_PAD_H,
    zIndex: 1,
  },
  laneRev: {
    flexDirection: 'row-reverse',
  },
  cardSlot: {
    width: '47%',
  },
  card: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: 'rgba(60,60,67,0.18)',
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingTop: 9,
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
    overflow: 'hidden',
  },
  cardNow: {
    borderColor: AZURE,
    borderWidth: 1,
    shadowColor: AZURE,
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  cardNext: {
    borderColor: AZURE,
    borderWidth: 1.5,
    backgroundColor: 'rgba(0,122,255,0.05)',
    shadowColor: AZURE,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardDone: {
    opacity: 0.82,
  },
  cardSelected: {
    borderColor: AZURE,
    backgroundColor: 'rgba(0,122,255,0.06)',
  },
  node: {
    position: 'absolute',
    top: -(NODE_GAP + NODE_R),
    left: '50%',
    marginLeft: -NODE_R,
    width: NODE_R * 2,
    height: NODE_R * 2,
    borderRadius: 999,
    backgroundColor: THREAD_TRACK,
    borderWidth: 2.5,
    borderColor: '#FAF8F4',
    zIndex: 3,
  },
  nodeNow: {
    top: -(NODE_GAP + 8),
    marginLeft: -8,
    width: 16,
    height: 16,
    borderWidth: 3,
  },
  stripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  pill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.45,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: IOS_REGISTER.separatorStrong,
  },
  checkboxOn: {
    backgroundColor: AZURE,
    borderColor: AZURE,
  },
  stepNo: {
    marginLeft: 'auto',
    fontFamily: fontFamily.mono,
    fontSize: 9.5,
    color: IOS_REGISTER.labelTertiary,
    fontVariant: ['tabular-nums'],
  },
  preTitle: {
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: IOS_REGISTER.labelTertiary,
    marginBottom: 3,
  },
  metaLine: {
    fontFamily: fontFamily.mono,
    fontSize: 9.5,
    color: IOS_REGISTER.labelTertiary,
    marginTop: 4,
    letterSpacing: 0.1,
  },
  title: {
    fontFamily: fontFamily.serif,
    fontStyle: 'italic',
    fontSize: 14,
    lineHeight: 17,
    letterSpacing: -0.1,
    color: IOS_REGISTER.label,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  caps: {
    flexDirection: 'row',
    gap: 3,
  },
  cdot: {
    width: 7,
    height: 7,
    borderRadius: 2,
  },

  /* node lanes */
  nodeLane: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    paddingTop: LANE_PAD_TOP - 6,
    paddingHorizontal: LANE_PAD_H,
    zIndex: 1,
  },
  nodeLaneRev: {
    flexDirection: 'row-reverse',
  },
  nnode: {
    width: '18%',
    alignItems: 'center',
  },
  ndot: {
    width: 11,
    height: 11,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#FAF8F4',
    zIndex: 3,
  },
  ndotBig: {
    width: 15,
    height: 15,
  },
  ndotNow: {
    width: 15,
    height: 15,
    borderWidth: 3,
  },
  nlab: {
    fontSize: 8.5,
    fontWeight: '600',
    color: IOS_REGISTER.labelTertiary,
    marginTop: 5,
    textAlign: 'center',
    lineHeight: 11,
  },
  nlabMilestone: {
    color: IOS_REGISTER.label,
    fontWeight: '700',
  },
  nstar: {
    position: 'absolute',
    top: -14,
    fontSize: 10,
    zIndex: 4,
  },
});
