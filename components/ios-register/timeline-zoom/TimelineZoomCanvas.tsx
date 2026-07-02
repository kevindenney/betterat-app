/**
 * Timeline Zoom Canvas — the single zoomable surface (L1 → L2 → L3 → L4).
 *
 * Per Sections A–C of the May 2026 Timeline Zoom & Admin handoff:
 *   • Pinch is the primary gesture (two-finger spread to zoom in, pinch to
 *     zoom out). Soft-snaps to the four discrete levels on release.
 *   • The right-rail stacked-pill indicator is the secondary affordance —
 *     always visible, tappable as a direct jump.
 *   • Single-tap any card at L2/L3/L4 zooms to L1 with that step focused
 *     (Frame 11). The reverse of pinch — pinch out is symmetric and
 *     continuous, tap is targeted. The user's intent picks the gesture.
 *
 * Mid-gesture affordances (Frame 9):
 *   • Canvas content scales subtly during the pinch so the gesture has
 *     visceral feedback before the snap (clamped 0.94→1.06 — gentle).
 *   • A dark hint pill (`Week → Season · PINCH TO ZOOM OUT`) appears at
 *     bottom-center as soon as the pinch direction is unambiguous.
 *   • A medium-strength haptic fires on the snap when the level actually
 *     changes (release at the threshold without crossing it = no haptic).
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { useInterest } from '@/providers/InterestProvider';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/navigation/FloatingTabBar';
import { useTabBarVisibility } from '@/components/navigation/TabBarVisibilityContext';
import { AppChromeRow } from '@/components/ui/AppChromeRow';
import { useScrollHideChrome } from '@/hooks/useScrollHideChrome';
import { InterestHeader } from './InterestHeader';
import { StepTaskBar } from './StepTaskBar';
import { StepAddSheet } from './StepAddSheet';
import { useUniversalPlus } from '@/components/capture';
import { NowFloat, type NowRelation } from './NowFloat';
import { L1StepView } from './L1StepView';
import { L3SeasonView } from './L3SeasonView';
import { L4YearsView } from './L4YearsView';
import { ZoomEmptyState } from './EmptyStates';
import { SelectActionBar } from './SelectActionBar';
import { useSelectMode } from './useSelectMode';
import { ZoomLevelPicker } from './ZoomLevelPicker';
import { resolveInterestVocab } from './interestVocab';
import {
  ZOOM_LEVEL_SCOPE_LABELS,
  type TimelineDataset,
  type TimelineStep,
  type ZoomLevel,
} from './types';

interface TimelineZoomCanvasProps {
  dataset: TimelineDataset;
  /** Starting zoom level. Defaults to 1 (Step). */
  initialLevel?: ZoomLevel;
  /**
   * The step id carried by an explicit `?selected=` deep-link (e.g. a
   * discussion-notification tap). Distinct from the dataset's default
   * focus: whenever this changes to a resolvable id, the canvas jumps to
   * L1 on that step — even if the Practice tab is already mounted at L2/L3.
   * `initialLevel` only applies at mount, so without this a deep-link
   * arriving on the live tab re-focuses but never zooms in.
   */
  routeFocusStepId?: string;
  /**
   * Optional handler invoked when the user taps the focused L1 card to
   * open the full step detail surface (existing `<StepDetailContent />`).
   * When omitted, the L1 card is non-interactive (preview routes). When
   * provided, the canvas stays mounted while detail pushes — pinch state
   * is preserved on back.
   */
  onOpenStepDetail?: (stepId: string) => void;
  /**
   * Open a step's Reflect tab so evidence + a reflection get captured.
   * Drives the L3 librarian card's capture CTAs (and the reflect
   * step-picker). Routed to `/step/[id]?tab=review` by the parent.
   */
  onReflectOnStep?: (stepId: string) => void;
  /**
   * Suppress the canvas's internal InterestHeader. Set true on the
   * canonical Practice tab cutover where the app chrome above already
   * shows the interest pill + avatar — rendering both creates a
   * doubled-pill row. Defaults false (preview routes keep their
   * header).
   */
  hideInterestHeader?: boolean;
  /**
   * Forwarded to L1StepView. When true, the L1 surface renders the real
   * <StepDetailContent /> (with PhaseTabs taskbar + full body) inline
   * instead of the slim preview card. Only valid when steps are real
   * Supabase rows — preview routes must leave this false.
   */
  embedFullDetailAtL1?: boolean;
  /**
   * Section D drag-reorder. Called when the user drops a card at a new
   * position at L2 or L3. The view computes the new neighbor step IDs
   * from its own ordered list and hands them to the caller; the caller
   * looks up those neighbors' sort_orders and writes a value between
   * them. Passing neighbor ids (not indices) keeps the owner agnostic
   * about whether the drag was within a week (L2) or across the season
   * (L3).
   */
  onReorderStep?: (
    stepId: string,
    beforeStepId: string | null,
    afterStepId: string | null,
  ) => void;
  /**
   * Reorder-time status flip + placement (L3). Fires when a step is dragged
   * across the NOW divider — `toBehind` true = dropped into done-behind (mark
   * done), false = dropped into queued-ahead (reopen). `beforeStepId`/
   * `afterStepId` are the drop's neighbours in the target zone so the parent
   * can place the step where dropped. The parent confirms and writes status +
   * position; a silent flip would skip the completion capture loop.
   */
  onStepCrossNow?: (
    stepId: string,
    toBehind: boolean,
    beforeStepId: string | null,
    afterStepId: string | null,
  ) => void;
  /**
   * Frame 12 bulk-edit hooks. The canvas owns select-mode state and the
   * bottom action bar; the parent wires the actual mutations. Archive
   * fires for every selected id with status='skipped'; Delete fires
   * after a confirm. Move/Tag/Reschedule arrive via onUnsupportedBulkAction
   * so the cutover screen can show a "coming soon" pill.
   */
  onBulkArchive?: (stepIds: string[]) => void;
  onBulkDelete?: (stepIds: string[]) => void;
  /**
   * Section E (Frames 15–16). When provided, the bulk "Move" button
   * fires this instead of routing through onUnsupportedBulkAction —
   * the parent opens its MoveToSeasonSheet. The canvas exits select
   * mode immediately so the sheet covers a clean canvas; the caller
   * keeps the step ids in its own state until the move resolves.
   */
  onBulkMove?: (stepIds: string[]) => void;
  /** Frame 12 — bulk Tag picker entry. Same pattern as onBulkMove. */
  onBulkTag?: (stepIds: string[]) => void;
  /** Frame 12 — bulk Schedule picker entry. Same pattern as onBulkMove. */
  onBulkSchedule?: (stepIds: string[]) => void;
  onUnsupportedBulkAction?: (actionId: 'move' | 'tag' | 'reschedule') => void;
  /**
   * Open the SeasonEditSheet in "add" mode. Wired by L3 (picker
   * footer) and L4 (BROWSE ARCS header) so the user can create new
   * arcs from either zoom.
   */
  onAddArc?: () => void;
  /** Open the SeasonEditSheet pre-populated with this arc for editing. */
  onEditArc?: (arcId: string) => void;
  /**
   * Fires whenever the canvas's view state (zoom level or focused step)
   * changes. The parent persists it (interest-scoped) so a native relaunch
   * can restore the last level/step instead of always landing on the ARC.
   */
  onViewStateChange?: (state: { level: ZoomLevel; focusStepId: string | null }) => void;
}

// L2 (WEEK) is retired — merged into the L1 Step view. Pinch steps 1↔3↔4.
const LEVELS: ZoomLevel[] = [1, 3, 4];

function isBehindNowStep(step: TimelineStep): boolean {
  return step.status === 'done' || step.status === 'reflected' || step.status === 'reflect';
}

// Pinch thresholds — release ≥ ZOOM_IN_SNAP commits a zoom-in (lower
// level number); ≤ ZOOM_OUT_SNAP commits a zoom-out. The HINT_*
// thresholds are lower (mid-gesture intent) so the hint pill appears
// before the user commits.
const HINT_IN = 1.12;
const HINT_OUT = 0.93;
const ZOOM_IN_SNAP = 1.6;
const ZOOM_OUT_SNAP = 0.78;

// Directional level-transition entering animation. Zooming in (to a more
// detailed level) brings the new content rushing toward the viewer — it
// starts smaller and grows into place. Zooming out pulls back — the new
// broader view starts larger and settles down. This makes the discrete
// level swap read as a continuous zoom rather than a flat cross-fade.
function makeZoomEntering(direction: 'in' | 'out') {
  const fromScale = direction === 'in' ? 0.88 : 1.1;
  return () => {
    'worklet';
    return {
      initialValues: { opacity: 0, transform: [{ scale: fromScale }] },
      animations: {
        opacity: withTiming(1, { duration: 200 }),
        transform: [{ scale: withTiming(1, { duration: 260 }) }],
      },
    };
  };
}

export function TimelineZoomCanvas({
  dataset,
  initialLevel = 1,
  routeFocusStepId,
  onOpenStepDetail,
  onReflectOnStep,
  hideInterestHeader = false,
  embedFullDetailAtL1 = false,
  onReorderStep,
  onStepCrossNow,
  onBulkArchive,
  onBulkDelete,
  onBulkMove,
  onBulkTag,
  onBulkSchedule,
  onUnsupportedBulkAction,
  onAddArc,
  onEditArc,
  onViewStateChange,
}: TimelineZoomCanvasProps) {
  const { submit: submitStep } = useUniversalPlus();
  const [level, setLevel] = useState<ZoomLevel>(initialLevel);
  const [addOpen, setAddOpen] = useState(false);
  // Track the previous level so the keyed level stage knows whether this
  // mount is a zoom-in (lower level number) or zoom-out for its entering
  // animation. Read during render, committed after paint.
  const prevLevelRef = useRef<ZoomLevel>(initialLevel);
  const zoomDirection: 'in' | 'out' = level <= prevLevelRef.current ? 'in' : 'out';
  React.useEffect(() => {
    prevLevelRef.current = level;
  }, [level]);
  const [focusStepId, setFocusStepId] = useState<string>(dataset.focusStepId);
  const [gestureDirection, setGestureDirection] = useState<'in' | 'out' | null>(null);
  // The arc that owns a given step (steps are bucketed into a season by date
  // window, so this is the source of truth for "which arc is this step in").
  const seasonIdOfStepIn = useCallback(
    (stepId: string | null | undefined): string | null => {
      if (!stepId) return null;
      return (
        dataset.seasons.find((s) =>
          s.weeks.some((w) => w.steps.some((st) => st.id === stepId)),
        )?.id ?? null
      );
    },
    [dataset.seasons],
  );
  // Canvas-wide season selection — survives zoom-level changes so the
  // user's pick at L3 persists when they pinch back in and out. Defaults to
  // the arc that owns the focused (NOW) step rather than the date-of-today
  // "current" arc, which is empty whenever the user's active arc is past its
  // calendar window.
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>(
    () => seasonIdOfStepIn(dataset.focusStepId) ?? dataset.currentSeasonId,
  );
  React.useEffect(() => {
    if (!dataset.focusStepId) return;
    setFocusStepId((current) =>
      current === dataset.focusStepId ? current : dataset.focusStepId,
    );
  }, [dataset.focusStepId]);
  // Keep the arc selector pointed at the focused step's arc. Drilling into a
  // step (handleOpenStep), snapping to NOW, or switching interest all move
  // focusStepId; this follows it so zooming L1→L3 lands on the arc that owns
  // the step instead of the empty calendar-current arc. Browsing arcs at L3
  // changes selectedSeasonId without touching focusStepId, so it isn't undone.
  const focusedArcId = useMemo(
    () => seasonIdOfStepIn(focusStepId),
    [seasonIdOfStepIn, focusStepId],
  );
  React.useEffect(() => {
    if (!focusedArcId) return;
    setSelectedSeasonId((current) =>
      current === focusedArcId ? current : focusedArcId,
    );
  }, [focusedArcId]);
  // Explicit `?selected=` deep-link (discussion-notification tap). Whenever
  // it resolves to a step, jump to L1 on it — `initialLevel` only applies at
  // mount, so a deep-link landing on the already-mounted Practice tab would
  // otherwise re-focus but stay zoomed out at L2/L3.
  React.useEffect(() => {
    if (!routeFocusStepId) return;
    setFocusStepId(routeFocusStepId);
    setLevel(1);
  }, [routeFocusStepId]);
  // Report view-state changes upward so the parent can persist the last
  // zoom level + focused step (drives native relaunch restore).
  React.useEffect(() => {
    onViewStateChange?.({ level, focusStepId: focusStepId || null });
  }, [level, focusStepId, onViewStateChange]);
  const select = useSelectMode();
  const { currentInterest } = useInterest();
  const interestAccent = currentInterest?.accent_color ?? IOS_REGISTER.labelTertiary;
  const isSailRacing = (dataset.interest.slug ?? '').toLowerCase() === 'sail-racing';
  // Hide the floating zoom rail while a text input / composer is focused so
  // it never collides with a send button or the rising keyboard. Keyboard
  // events are the most reliable cross-input signal (Discuss composer, any
  // inline TextInput) and mirror Apple Photos hiding its toolbar on edit.
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  React.useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  const periodNoun = resolveInterestVocab(dataset.interest.label).periodNoun;
  const insets = useSafeAreaInsets();
  // Step level shows the global floating tab bar; reserve clearance so the
  // embedded capture composer + NowFloat sit above it instead of behind it.
  const tabBarClearance = Math.max(insets.bottom, 8) + FLOATING_TAB_BAR_HEIGHT + 16;
  const [chromeHeight, setChromeHeight] = useState(0);
  const chromeHideFallback = Platform.OS === 'android' ? 96 : 72;
  const chromeHideDistance = Math.ceil(
    Math.max(chromeHeight, chromeHideFallback) + 8,
  );
  const handleChromeLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    if (height > 0) {
      setChromeHeight((current) => (
        Math.abs(current - height) > 1 ? height : current
      ));
    }
  }, []);
  // Same scroll that hides the top chrome also slides the bottom floating
  // tab bar away (shared value written on the UI thread, no re-renders).
  const { scrollHidden } = useTabBarVisibility();
  const { onScroll: onInnerScroll, chromeAnimStyle } = useScrollHideChrome({
    hideDistance: chromeHideDistance,
    externalProgress: scrollHidden,
  });
  const chromeCollapseStyle = useAnimatedStyle(() => ({
    marginBottom: -scrollHidden.value * Math.max(chromeHeight, chromeHideFallback),
  }));
  // Restore the tab bar when this surface unmounts (tab switch / pop) so a
  // mid-scroll hidden state doesn't leak into other screens.
  React.useEffect(() => {
    return () => {
      scrollHidden.value = 0;
    };
  }, [scrollHidden]);

  // Continuous scale value driven by pinch — used to gate level changes on
  // release and to animate the canvas scale during the gesture.
  const pinchScale = useSharedValue(1);
  const gestureActive = useSharedValue(0);

  const stepLevelWithHaptic = useCallback((direction: 'in' | 'out') => {
    let changed = false;
    setLevel((current) => {
      const idx = LEVELS.indexOf(current);
      const nextIdx =
        direction === 'in'
          ? Math.max(0, idx - 1)
          : Math.min(LEVELS.length - 1, idx + 1);
      if (nextIdx !== idx) changed = true;
      return LEVELS[nextIdx];
    });
    if (changed) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
  }, []);

  const clearGestureDirection = useCallback(() => setGestureDirection(null), []);

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      gestureActive.value = 1;
    })
    .onUpdate((e) => {
      pinchScale.value = e.scale;
    })
    .onEnd(() => {
      const s = pinchScale.value;
      if (s >= ZOOM_IN_SNAP) runOnJS(stepLevelWithHaptic)('in');
      else if (s <= ZOOM_OUT_SNAP) runOnJS(stepLevelWithHaptic)('out');
      gestureActive.value = 0;
      pinchScale.value = withTiming(1, { duration: 160 });
      runOnJS(clearGestureDirection)();
    });

  // Sync gesture direction back to React state only on transitions — keeps
  // the hint pill's mount/unmount cheap. Worklet thread reads the shared
  // values; transitions fire runOnJS exactly once per direction change.
  useAnimatedReaction(
    () => {
      if (gestureActive.value === 0) return null;
      if (pinchScale.value >= HINT_IN) return 'in' as const;
      if (pinchScale.value <= HINT_OUT) return 'out' as const;
      return null;
    },
    (current, prev) => {
      if (current !== prev) {
        runOnJS(setGestureDirection)(current);
      }
    },
  );

  // Canvas content scale during gesture — clamped to a gentle range so the
  // UI stays readable. Released values spring back via withTiming above.
  const canvasAnimStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          pinchScale.value,
          [ZOOM_OUT_SNAP, 1, ZOOM_IN_SNAP],
          [0.94, 1, 1.06],
          Extrapolation.CLAMP,
        ),
      },
    ],
    opacity: interpolate(
      pinchScale.value,
      [ZOOM_OUT_SNAP, 1, ZOOM_IN_SNAP],
      [0.85, 1, 0.85],
      Extrapolation.CLAMP,
    ),
  }));

  const handleOpenStep = useCallback((stepId: string) => {
    setFocusStepId(stepId);
    setLevel(1);
  }, []);

  // Whole-chapter-card tap on L4 → drill into that arc at L3.
  const handleOpenSeason = useCallback((seasonId: string) => {
    setSelectedSeasonId(seasonId);
    setLevel(3);
  }, []);

  const handleSnapToCurrent = useCallback(() => {
    setFocusStepId(dataset.focusStepId);
    setLevel(1);
  }, [dataset.focusStepId]);

  const flatSteps = useMemo(
    () => dataset.seasons.flatMap((s) => s.weeks).flatMap((w) => w.steps),
    [dataset.seasons],
  );
  const selectedSeason = useMemo(
    () =>
      dataset.seasons.find((s) => s.id === selectedSeasonId) ??
      dataset.seasons.find((s) => s.id === dataset.currentSeasonId) ??
      // seasons read chronologically — the last lane is the newest arc.
      dataset.seasons[dataset.seasons.length - 1],
    [dataset.currentSeasonId, dataset.seasons, selectedSeasonId],
  );
  const currentSeasonLane = useMemo(
    () =>
      dataset.seasons.find((s) => s.id === dataset.currentSeasonId) ??
      dataset.seasons[dataset.seasons.length - 1],
    [dataset.currentSeasonId, dataset.seasons],
  );
  const selectedSeasonSteps = useMemo(
    () => selectedSeason?.weeks.flatMap((w) => w.steps) ?? [],
    [selectedSeason],
  );
  const focusedStep =
    flatSteps.find((s) => s.id === focusStepId) ??
    selectedSeason?.weeks[0]?.steps[0];

  // Step-level navigation stays inside one arc. Anchor on the arc that owns
  // the focused step (so snap-to-NOW still lands in NOW's arc), else the
  // viewed arc — swiping must never leak into a neighboring arc.
  const arcIndexOfStep = useCallback(
    (stepId: string | null | undefined) =>
      stepId
        ? dataset.seasons.findIndex((s) =>
            s.weeks.some((w) => w.steps.some((st) => st.id === stepId)),
          )
        : -1,
    [dataset.seasons],
  );
  const focusedArcIdx = arcIndexOfStep(focusedStep?.id);
  const focusedArc = focusedArcIdx >= 0 ? dataset.seasons[focusedArcIdx] : selectedSeason;
  const arcSteps = useMemo(
    () => focusedArc?.weeks.flatMap((w) => w.steps) ?? [],
    [focusedArc],
  );
  const orderedArcSteps = useMemo(() => {
    const behindNow = arcSteps.filter((s) => isBehindNowStep(s));
    const ahead = arcSteps.filter((s) => !isBehindNowStep(s));
    return [...behindNow, ...ahead];
  }, [arcSteps]);

  const chromeSteps = level === 3 && selectedSeasonSteps.length > 0
    ? selectedSeasonSteps
    : orderedArcSteps;
  const chromeFocusedStep =
    chromeSteps.find((s) => s.id === focusStepId) ??
    (level === 3 ? chromeSteps[0] : focusedStep);

  const swipeToNeighbor = useCallback(
    (direction: 'prev' | 'next') => {
      if (orderedArcSteps.length < 2) return;
      const idx = orderedArcSteps.findIndex((s) => s.id === focusStepId);
      if (idx < 0) return;
      const nextIdx = direction === 'prev' ? idx - 1 : idx + 1;
      if (nextIdx < 0 || nextIdx >= orderedArcSteps.length) return;
      setFocusStepId(orderedArcSteps[nextIdx].id);
    },
    [orderedArcSteps, focusStepId],
  );
  const jumpToArcIndex = useCallback(
    (index: number) => {
      const step = orderedArcSteps[index];
      if (!step) return;
      setFocusStepId(step.id);
      setLevel(1);
    },
    [orderedArcSteps],
  );

  const focusedArcStepIdx = useMemo(
    () => orderedArcSteps.findIndex((s) => s.id === focusStepId),
    [orderedArcSteps, focusStepId],
  );
  const prevStep = focusedArcStepIdx > 0 ? orderedArcSteps[focusedArcStepIdx - 1] : null;
  const nextStep =
    focusedArcStepIdx >= 0 && focusedArcStepIdx < orderedArcSteps.length - 1
      ? orderedArcSteps[focusedArcStepIdx + 1]
      : null;
  // NowFloat — the viewed step's relation to the canonical now-step. When the
  // now-step lives in a different arc, compare the arcs chronologically.
  const nowArcStepIdx = useMemo(
    () => orderedArcSteps.findIndex((s) => s.id === dataset.focusStepId),
    [orderedArcSteps, dataset.focusStepId],
  );
  const nowArcIdx = arcIndexOfStep(dataset.focusStepId);
  const nowRelation: NowRelation =
    focusedArcStepIdx < 0
      ? 'now'
      : nowArcStepIdx >= 0
        ? focusedArcStepIdx === nowArcStepIdx
          ? 'now'
          : focusedArcStepIdx < nowArcStepIdx
            ? 'done'
            : 'next'
        : nowArcIdx < 0 || focusedArcIdx === nowArcIdx
          ? 'now'
          : focusedArcIdx < nowArcIdx
            ? 'done'
            : 'next';

  // Compute the level the user is about to snap to, given direction +
  // current level. Returns null when at a boundary (can't go further).
  const targetLevel: ZoomLevel | null = useMemo(() => {
    if (!gestureDirection) return null;
    const idx = LEVELS.indexOf(level);
    const next =
      gestureDirection === 'in'
        ? Math.max(0, idx - 1)
        : Math.min(LEVELS.length - 1, idx + 1);
    if (next === idx) return null;
    return LEVELS[next];
  }, [gestureDirection, level]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.surface}>
        {hideInterestHeader ? (
          !select.enabled ? (
            <Animated.View
              style={[styles.chromeLayer, chromeAnimStyle, chromeCollapseStyle]}
              onLayout={handleChromeLayout}
            >
              {level === 1 || level === 3 ? (
                <StepTaskBar
                  interestLabel={dataset.interest.label}
                  focusedStep={chromeFocusedStep}
                  allSteps={chromeSteps}
                  nowStepId={dataset.focusStepId}
                  onJumpToStep={(id) => setFocusStepId(id)}
                  viewedSeasonId={selectedSeason?.id ?? null}
                />
              ) : (
                <AppChromeRow onPlusPress={() => setAddOpen(true)} />
              )}
            </Animated.View>
          ) : null
        ) : (
          <InterestHeader
            interestLabel={dataset.interest.label}
            accentColor={interestAccent}
            level={level}
            stepCounter={dataset.stepCounter}
            weekCounter={dataset.weekCounter}
            seasonCounter={
              currentSeasonLane
                ? {
                    current: currentSeasonLane.bricks.length,
                    total: dataset.totalSteps,
                  }
                : undefined
            }
            user={dataset.user}
          />
        )}

        <GestureDetector gesture={pinch}>
          <View style={styles.canvas}>
            <Animated.View style={[styles.canvasInner, canvasAnimStyle]}>
              {/* keyed wrapper so React unmounts/mounts on level change,
                  triggering the directional zoom entering animation each time */}
              <Animated.View
                key={`lvl-${level}`}
                entering={makeZoomEntering(zoomDirection)}
                style={styles.levelStage}
              >
                {level === 1 ? (
                  focusedStep ? (
                    <L1StepView
                      dataset={dataset}
                      step={focusedStep}
                      onOpenStepDetail={embedFullDetailAtL1 ? undefined : onOpenStepDetail}
                      embedFullDetail={embedFullDetailAtL1}
                      onSwipePrev={() => swipeToNeighbor('prev')}
                      onSwipeNext={() => swipeToNeighbor('next')}
                      prevStep={prevStep}
                      nextStep={nextStep}
                      onScroll={onInnerScroll}
                      onStepDeleted={() => {
                        // Stay at L1 on the step that slides into the deleted
                        // one's slot (next, else the previous neighbor). Only
                        // fall back to the arc view when nothing's left.
                        const fallback = nextStep ?? prevStep;
                        if (fallback) setFocusStepId(fallback.id);
                        else setLevel(3);
                      }}
                      allSteps={orderedArcSteps}
                      onJumpToStep={(id) => setFocusStepId(id)}
                      hideStepSwitcher={hideInterestHeader}
                      // NowFloat hovers 20pt above the tab-bar clearance and is
                      // ~34pt tall — without this extra room the last element
                      // (Move to Reflect CTA) stops behind the pager pill.
                      bottomInset={embedFullDetailAtL1 ? tabBarClearance + 56 : 0}
                    />
                  ) : (
                    <ZoomEmptyState
                      level={1}
                      interestLabel={dataset.interest.label}
                      periodNoun={periodNoun}
                      onAddStep={() => setAddOpen(true)}
                    />
                  )
                ) : null}
                {level === 3 ? (
                  <L3SeasonView
                    dataset={dataset}
                    focusStepId={focusStepId}
                    selectedSeasonId={selectedSeasonId}
                    onSelectSeason={setSelectedSeasonId}
                    onOpenStep={handleOpenStep}
                    onReflectOnStep={onReflectOnStep}
                    onReorderStep={select.enabled ? undefined : onReorderStep}
                    onMoveAcrossNow={select.enabled ? undefined : onStepCrossNow}
                    onEnterSelectMode={select.enter}
                    selectEnabled={select.enabled}
                    isSelected={select.isSelected}
                    onToggleSelect={select.toggle}
                    onAddArc={onAddArc}
                    onEditArc={onEditArc}
                    onAddStep={() => setAddOpen(true)}
                    hideInlineCounter={hideInterestHeader}
                    bottomInset={tabBarClearance}
                  />
                ) : null}
                {level === 4 ? (
                  <L4YearsView
                    dataset={dataset}
                    onOpenSeason={handleOpenSeason}
                    onAddArc={onAddArc}
                    onEditArc={onEditArc}
                  />
                ) : null}
              </Animated.View>
            </Animated.View>
          </View>
        </GestureDetector>


        {targetLevel && gestureDirection ? (
          <PinchHintPill
            from={level}
            to={targetLevel}
            direction={gestureDirection}
            periodNoun={periodNoun}
          />
        ) : null}

        {select.enabled ? (
          <SelectActionBar
            selectedCount={select.selected.size}
            onCancel={select.exit}
            onArchive={() => {
              onBulkArchive?.(Array.from(select.selected));
              select.exit();
            }}
            onDelete={() => {
              onBulkDelete?.(Array.from(select.selected));
              select.exit();
            }}
            onMove={
              onBulkMove
                ? () => {
                    const ids = Array.from(select.selected);
                    select.exit();
                    onBulkMove(ids);
                  }
                : undefined
            }
            onTag={
              onBulkTag
                ? () => {
                    const ids = Array.from(select.selected);
                    select.exit();
                    onBulkTag(ids);
                  }
                : undefined
            }
            onSchedule={
              onBulkSchedule
                ? () => {
                    const ids = Array.from(select.selected);
                    select.exit();
                    onBulkSchedule(ids);
                  }
                : undefined
            }
            onUnsupportedAction={(id) => onUnsupportedBulkAction?.(id)}
          />
        ) : (
          <ZoomLevelPicker
            level={level}
            onChange={setLevel}
            onSnapToCurrent={handleSnapToCurrent}
            periodNoun={periodNoun}
            hidden={keyboardVisible}
          />
        )}

        {level === 1 && embedFullDetailAtL1 && !select.enabled && focusedStep ? (
          <NowFloat
            relation={nowRelation}
            nowIndex={nowArcStepIdx}
            viewedIndex={Math.max(focusedArcStepIdx, 0)}
            total={orderedArcSteps.length}
            onJumpToIndex={jumpToArcIndex}
            onPrev={prevStep ? () => swipeToNeighbor('prev') : undefined}
            onNext={nextStep ? () => swipeToNeighbor('next') : undefined}
            bottomOffset={tabBarClearance + 20}
          />
        ) : null}
        <StepAddSheet
          visible={addOpen}
          onClose={() => setAddOpen(false)}
          onSave={submitStep}
          onStepAdded={(id) => {
            setAddOpen(false);
            setFocusStepId(id);
            setLevel(1);
          }}
          showRaceSelector={isSailRacing}
          viewedSeasonId={selectedSeason?.id ?? null}
        />
      </View>
    </GestureHandlerRootView>
  );
}

interface PinchHintPillProps {
  from: ZoomLevel;
  to: ZoomLevel;
  direction: 'in' | 'out';
  periodNoun: string;
}

function PinchHintPill({ from, to, direction, periodNoun }: PinchHintPillProps) {
  const scopeLabel = (l: ZoomLevel) =>
    l === 3 ? `Current ${periodNoun}` : ZOOM_LEVEL_SCOPE_LABELS[l];
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    opacity.value = withTiming(1, { duration: 120 });
    return () => {
      opacity.value = withTiming(0, { duration: 100 });
    };
  }, [opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View pointerEvents="none" style={[styles.hintPillWrap, animStyle]}>
      <View style={styles.hintPill}>
        <Text style={styles.hintTitle}>
          {scopeLabel(from)} → {scopeLabel(to)}
        </Text>
        <Text style={styles.hintSub}>
          {direction === 'in' ? 'PINCH TO ZOOM IN' : 'PINCH TO ZOOM OUT'}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  surface: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  // Keep the chrome row (and its descending ProfileDropdown / interest
  // popover) above the canvas. chromeAnimStyle applies a transform, which
  // opens a stacking context; without this the later canvas sibling paints
  // over the open dropdown and swallows its taps.
  chromeLayer: {
    zIndex: 100,
    ...Platform.select({ android: { elevation: 30 } }),
  },
  canvas: {
    flex: 1,
    // The ZoomLevelPicker is an absolutely-positioned sibling that floats OVER
    // the surface (Apple Photos style) at every level — we deliberately do NOT
    // reserve a gutter for it, so content goes edge-to-edge and the rail hovers.
  },
  canvasInner: {
    flex: 1,
  },
  levelStage: {
    flex: 1,
  },
  hintPillWrap: {
    position: 'absolute',
    bottom: 96,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintPill: {
    backgroundColor: '#1F1F1F',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  hintTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  hintSub: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginTop: 2,
  },
});
