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

import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  FadeIn,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { InterestHeader } from './InterestHeader';
import { L1StepView } from './L1StepView';
import { L2WeekView } from './L2WeekView';
import { L3SeasonView } from './L3SeasonView';
import { L4YearsView } from './L4YearsView';
import { ZoomRailIndicator } from './ZoomRailIndicator';
import { ZOOM_LEVEL_LABELS, type TimelineDataset, type ZoomLevel } from './types';

interface TimelineZoomCanvasProps {
  dataset: TimelineDataset;
  /** Starting zoom level. Defaults to 1 (Step). */
  initialLevel?: ZoomLevel;
  /**
   * Optional handler invoked when the user taps the focused L1 card to
   * open the full step detail surface (existing `<StepDetailContent />`).
   * When omitted, the L1 card is non-interactive (preview routes). When
   * provided, the canvas stays mounted while detail pushes — pinch state
   * is preserved on back.
   */
  onOpenStepDetail?: (stepId: string) => void;
}

const LEVELS: ZoomLevel[] = [1, 2, 3, 4];

// Pinch thresholds — release ≥ ZOOM_IN_SNAP commits a zoom-in (lower
// level number); ≤ ZOOM_OUT_SNAP commits a zoom-out. The HINT_*
// thresholds are lower (mid-gesture intent) so the hint pill appears
// before the user commits.
const HINT_IN = 1.12;
const HINT_OUT = 0.88;
const ZOOM_IN_SNAP = 1.6;
const ZOOM_OUT_SNAP = 0.6;

function titleCase(label: string): string {
  return label.charAt(0) + label.slice(1).toLowerCase();
}

export function TimelineZoomCanvas({
  dataset,
  initialLevel = 1,
  onOpenStepDetail,
}: TimelineZoomCanvasProps) {
  const [level, setLevel] = useState<ZoomLevel>(initialLevel);
  const [focusStepId, setFocusStepId] = useState<string>(dataset.focusStepId);
  const [gestureDirection, setGestureDirection] = useState<'in' | 'out' | null>(null);

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

  const handleSnapToCurrent = useCallback(() => {
    setFocusStepId(dataset.focusStepId);
    setLevel(1);
  }, [dataset.focusStepId]);

  const focusedStep =
    dataset.seasons
      .flatMap((s) => s.weeks)
      .flatMap((w) => w.steps)
      .find((s) => s.id === focusStepId) ??
    dataset.seasons[0].weeks[0]?.steps[0];

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
        <InterestHeader
          interestLabel={dataset.interest.label}
          level={level}
          stepCounter={dataset.stepCounter}
          weekCounter={dataset.weekCounter}
          seasonCounter={
            dataset.seasons[0]
              ? {
                  current: dataset.seasons[0].bricks.length,
                  total: dataset.totalSteps,
                }
              : undefined
          }
          user={dataset.user}
        />

        <GestureDetector gesture={pinch}>
          <View style={styles.canvas}>
            <Animated.View style={[styles.canvasInner, canvasAnimStyle]}>
              {/* keyed wrapper so React unmounts/mounts on level change,
                  triggering the FadeIn entering animation each time */}
              <Animated.View
                key={`lvl-${level}`}
                entering={FadeIn.duration(180)}
                style={styles.levelStage}
              >
                {level === 1 && focusedStep ? (
                  <L1StepView
                    dataset={dataset}
                    step={focusedStep}
                    onOpenStepDetail={onOpenStepDetail}
                  />
                ) : null}
                {level === 2 ? (
                  <L2WeekView
                    dataset={dataset}
                    focusStepId={focusStepId}
                    onOpenStep={handleOpenStep}
                  />
                ) : null}
                {level === 3 ? (
                  <L3SeasonView
                    dataset={dataset}
                    focusStepId={focusStepId}
                    onOpenStep={handleOpenStep}
                  />
                ) : null}
                {level === 4 ? (
                  <L4YearsView dataset={dataset} onOpenStep={handleOpenStep} />
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
          />
        ) : null}

        <ZoomRailIndicator
          level={level}
          onChange={setLevel}
          onSnapToCurrent={handleSnapToCurrent}
        />
      </View>
    </GestureHandlerRootView>
  );
}

interface PinchHintPillProps {
  from: ZoomLevel;
  to: ZoomLevel;
  direction: 'in' | 'out';
}

function PinchHintPill({ from, to, direction }: PinchHintPillProps) {
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
          {titleCase(ZOOM_LEVEL_LABELS[from])} → {titleCase(ZOOM_LEVEL_LABELS[to])}
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
  canvas: {
    flex: 1,
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
