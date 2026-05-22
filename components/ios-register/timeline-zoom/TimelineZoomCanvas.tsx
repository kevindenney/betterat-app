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
 * This is the canvas shell only. Heavy interactions (multi-select bulk
 * edit, drag-to-reorder, move-to-season sheet) are deferred to follow-up
 * commits.
 */

import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import {
  runOnJS,
  useAnimatedReaction,
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
import type { TimelineDataset, ZoomLevel } from './types';

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

export function TimelineZoomCanvas({
  dataset,
  initialLevel = 1,
  onOpenStepDetail,
}: TimelineZoomCanvasProps) {
  const [level, setLevel] = useState<ZoomLevel>(initialLevel);
  const [focusStepId, setFocusStepId] = useState<string>(dataset.focusStepId);

  // Continuous scale value driven by pinch — used to gate level changes on
  // release. We treat each "tier" as a doubling, so log2(scale) maps cleanly:
  //   scale ≥ 1.6  → zoom in one level
  //   scale ≤ 0.6  → zoom out one level
  const pinchScale = useSharedValue(1);

  const stepLevel = useCallback(
    (direction: 'in' | 'out') => {
      setLevel((current) => {
        const idx = LEVELS.indexOf(current);
        // "Zoom in" = lower number (closer to L1 Step); "zoom out" = higher.
        const nextIdx =
          direction === 'in' ? Math.max(0, idx - 1) : Math.min(LEVELS.length - 1, idx + 1);
        return LEVELS[nextIdx];
      });
    },
    [],
  );

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      pinchScale.value = e.scale;
    })
    .onEnd(() => {
      const s = pinchScale.value;
      if (s >= 1.6) {
        runOnJS(stepLevel)('in');
      } else if (s <= 0.6) {
        runOnJS(stepLevel)('out');
      }
      pinchScale.value = withTiming(1, { duration: 120 });
    });

  // No-op reaction kept so the shared value is committed each frame even
  // when nothing else binds to it — keeps the gesture worklet hot.
  useAnimatedReaction(
    () => pinchScale.value,
    () => {
      // intentionally empty
    },
  );

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
          </View>
        </GestureDetector>

        <ZoomRailIndicator
          level={level}
          onChange={setLevel}
          onSnapToCurrent={handleSnapToCurrent}
        />
      </View>
    </GestureHandlerRootView>
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
});
