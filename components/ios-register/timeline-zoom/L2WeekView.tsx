/**
 * L2 — three step cards across, day strip on top. Swipe scrolls in weeks.
 *
 * Frame 2/6. "This week" big headline + Mon → Sun date range. Day strip
 * M T W T F S S with today highlighted iOS-blue and dots under days that
 * have steps. The day strip is tappable — jump the carousel to Friday and
 * the carousel scrolls to it (per Frame 2 description). The card the user
 * came from is outlined iOS blue.
 *
 * Section D drag-reorder (Frame 13): long-press a card in the carousel to
 * lift it, then drag left/right to reorder. The hook uses horizontal axis
 * hit-testing; ScrollView's scrollEnabled is bound to drag.isDragging so
 * the swipe-to-scroll gesture stops competing once a card is lifted.
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { StepDigestCard } from './StepDigestCard';
import { useDragReorder } from './useDragReorder';
import type { DayKey, TimelineDataset, TimelineStep } from './types';

interface L2WeekViewProps {
  dataset: TimelineDataset;
  focusStepId: string;
  onOpenStep: (stepId: string) => void;
  /**
   * Section D reorder commit. L2 resolves neighbor step ids from the
   * current week's ordering and hands those to the canvas owner.
   */
  onReorderStep?: (
    stepId: string,
    beforeStepId: string | null,
    afterStepId: string | null,
  ) => void;
}

const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS: Record<DayKey, string> = {
  mon: 'M', tue: 'T', wed: 'W', thu: 'T', fri: 'F', sat: 'S', sun: 'S',
};
const DAY_DATES = [13, 14, 15, 16, 17, 18, 19] as const;

export function L2WeekView({
  dataset,
  focusStepId,
  onOpenStep,
  onReorderStep,
}: L2WeekViewProps) {
  const currentSeason = dataset.seasons.find((s) => s.id === dataset.currentSeasonId);
  const currentWeek = currentSeason?.weeks.find((w) => w.isCurrent);
  // Memoize so the useEffect / useCallback dependencies below have a
  // stable identity across renders.
  const steps: TimelineStep[] = useMemo(
    () => currentWeek?.steps ?? [],
    [currentWeek],
  );

  const focusedStep = steps.find((s) => s.id === focusStepId) ?? steps[steps.length - 1];
  const todayDay: DayKey = focusedStep?.dayOfWeek ?? 'wed';

  // Day-of-week → step (first wins) for the dot row.
  const stepsByDay = new Map<DayKey, TimelineStep>();
  steps.forEach((s) => {
    if (!stepsByDay.has(s.dayOfWeek)) stepsByDay.set(s.dayOfWeek, s);
  });

  // Carousel ref so the day strip can scroll the carousel without
  // navigating away from L2. Frame 2: "the day strip is tappable — jump
  // to Friday and the carousel scrolls to it."
  const scrollRef = useRef<ScrollView>(null);

  const drag = useDragReorder<TimelineStep>({
    items: steps,
    axis: 'horizontal',
    enabled: Boolean(onReorderStep),
    onReorder: useCallback(
      (id, from, to) => {
        const without = steps.filter((s) => s.id !== id);
        const clamped = Math.max(0, Math.min(to, without.length));
        const before = without[clamped - 1]?.id ?? null;
        const after = without[clamped]?.id ?? null;
        onReorderStep?.(id, before, after);
        void from;
      },
      [steps, onReorderStep],
    ),
  });

  // Auto-scroll on mount + when focus changes (e.g. pinch-in/out preserves
  // focusStepId; the carousel should open with that card visible).
  useEffect(() => {
    const idx = steps.findIndex((s) => s.id === focusStepId);
    if (idx < 0) return;
    // requestAnimationFrame so the ScrollView has finished its initial
    // layout before we scroll into it on mount.
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        x: idx * (CARD_WIDTH + CARD_GAP),
        animated: false,
      });
    });
  }, [focusStepId, steps]);

  const scrollToDay = useCallback(
    (day: DayKey) => {
      const idx = steps.findIndex((s) => s.dayOfWeek === day);
      if (idx < 0) return;
      scrollRef.current?.scrollTo({
        x: idx * (CARD_WIDTH + CARD_GAP),
        animated: true,
      });
    },
    [steps],
  );

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>This week</Text>
        <Text style={styles.titleRight}>Mon 13 → Sun 19</Text>
      </View>

      <View style={styles.dayStrip}>
        {DAY_KEYS.map((d, idx) => {
          const isToday = d === todayDay;
          const hasStep = stepsByDay.has(d);
          return (
            <Pressable
              key={d}
              style={styles.dayCell}
              onPress={() => scrollToDay(d)}
              disabled={!hasStep}
            >
              <Text style={[styles.dayLetter, isToday && styles.dayLetterToday]}>
                {DAY_LABELS[d]}
              </Text>
              <View
                style={[
                  styles.dayNumberWrap,
                  isToday && styles.dayNumberWrapToday,
                ]}
              >
                <Text style={[styles.dayNumber, isToday && styles.dayNumberToday]}>
                  {DAY_DATES[idx]}
                </Text>
              </View>
              <View
                style={[
                  styles.dayDot,
                  hasStep && !isToday && styles.dayDotActive,
                ]}
              />
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardCarousel}
        snapToInterval={CARD_WIDTH + CARD_GAP}
        decelerationRate="fast"
        scrollEnabled={!drag.isDragging}
      >
        {steps.map((step, index) => {
          const isLifted = drag.liftedId === step.id;
          const showDropIndicator =
            drag.dropTargetIndex === index && !isLifted;
          return (
            <DraggableCarouselSlot
              key={step.id}
              step={step}
              index={index}
              isLifted={isLifted}
              showDropIndicatorBefore={showDropIndicator}
              liftedTranslateX={drag.liftedTranslate}
              highlighted={step.id === focusStepId}
              onOpen={() => onOpenStep(step.id)}
              buildGesture={drag.buildItemGesture}
              registerRowLayout={drag.registerRowLayout}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

interface DraggableCarouselSlotProps {
  step: TimelineStep;
  index: number;
  isLifted: boolean;
  showDropIndicatorBefore: boolean;
  liftedTranslateX: number;
  highlighted: boolean;
  onOpen: () => void;
  buildGesture: ReturnType<typeof useDragReorder>['buildItemGesture'];
  registerRowLayout: ReturnType<typeof useDragReorder>['registerRowLayout'];
}

function DraggableCarouselSlot({
  step,
  index,
  isLifted,
  showDropIndicatorBefore,
  liftedTranslateX,
  highlighted,
  onOpen,
  buildGesture,
  registerRowLayout,
}: DraggableCarouselSlotProps) {
  const gesture = useMemo(
    () => buildGesture(step.id, index),
    [buildGesture, step.id, index],
  );

  const liftStyle = useAnimatedStyle(() => {
    if (!isLifted) return { transform: [] as never[] };
    return {
      transform: [
        { translateX: liftedTranslateX },
        { scale: 1.04 },
        { rotateZ: '1.5deg' },
      ],
      zIndex: 10,
      shadowColor: '#000',
      shadowOpacity: 0.22,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 12,
    };
  }, [isLifted, liftedTranslateX]);

  return (
    <View style={styles.cardSlot}>
      {showDropIndicatorBefore ? <View style={styles.dropIndicator} /> : null}
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[styles.slotFlex, liftStyle]}
          onLayout={(e) => {
            const { x, width } = e.nativeEvent.layout;
            registerRowLayout(step.id, { start: x, length: width });
          }}
        >
          <StepDigestCard
            step={step}
            highlighted={highlighted}
            onPress={onOpen}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const CARD_WIDTH = 230;
const CARD_GAP = 12;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 4,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
    color: IOS_REGISTER.label,
  },
  titleRight: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    paddingBottom: 4,
  },
  dayStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  dayCell: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  dayLetter: {
    fontSize: 11,
    color: IOS_REGISTER.labelTertiary,
    letterSpacing: 0.2,
  },
  dayLetterToday: {
    color: '#FFFFFF',
  },
  dayNumberWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberWrapToday: {
    backgroundColor: IOS_REGISTER.accentUserAction,
  },
  dayNumber: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_REGISTER.label,
  },
  dayNumberToday: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  dayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'transparent',
    marginTop: 2,
  },
  dayDotActive: {
    backgroundColor: '#FF3B30',
  },
  cardCarousel: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    gap: CARD_GAP,
  },
  cardSlot: {
    width: CARD_WIDTH,
    position: 'relative',
  },
  slotFlex: { flex: 1 },
  dropIndicator: {
    position: 'absolute',
    left: -8,
    top: 0,
    bottom: 0,
    width: 3,
    borderRadius: 2,
    backgroundColor: IOS_REGISTER.accentUserAction,
    zIndex: 5,
  },
});
