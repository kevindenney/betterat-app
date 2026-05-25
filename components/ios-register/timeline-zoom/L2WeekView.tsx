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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { router } from 'expo-router';

import { Ionicons } from '@expo/vector-icons';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { StepDigestCard } from './StepDigestCard';
import { SeasonLibrarianPrompt } from './SeasonLibrarianPrompt';
import { useDragReorder } from './useDragReorder';
import { useUniversalPlus } from '@/components/capture/UniversalPlusProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { createStep } from '@/services/TimelineStepService';
import { useCrossInterestSuggestions } from '@/hooks/useCrossInterestSuggestions';
import type { CrossInterestSuggestion } from '@/types/step-detail';
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
  // The "today" highlight in the M T W T F S S strip should follow the
  // card the user is actually looking at. Mount-time defaults to the
  // focused card's day; carousel scroll updates it as cards pass the
  // viewport center.
  const [scrollDay, setScrollDay] = useState<DayKey | null>(null);
  const todayDay: DayKey = scrollDay ?? focusedStep?.dayOfWeek ?? 'wed';

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
      <Text style={styles.verbEyebrow}>ZOOM · THIS WEEK · PLANNING</Text>
      {currentWeek?.contextStrip ? (
        <Text style={styles.contextStrip}>{currentWeek.contextStrip}</Text>
      ) : null}
      <View style={styles.titleRow}>
        <Text style={styles.title}>This week</Text>
        <Text style={styles.titleRight}>{currentWeek?.dateRange ?? 'Mon 13 → Sun 19'}</Text>
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

      {steps.length === 0 ? (
        <EmptyWeekInline />
      ) : (
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardCarousel}
          snapToInterval={CARD_WIDTH + CARD_GAP}
          decelerationRate="fast"
          scrollEnabled={!drag.isDragging}
          scrollEventThrottle={32}
          onScroll={(e) => {
            // Center-pinned: the card whose midpoint is closest to the
            // viewport center wins the "today" highlight. CARD_WIDTH +
            // CARD_GAP is the snap unit, so dividing by it gives the
            // focused index directly.
            const x = e.nativeEvent.contentOffset.x;
            const idx = Math.max(
              0,
              Math.min(steps.length - 1, Math.round(x / (CARD_WIDTH + CARD_GAP))),
            );
            const nextDay = steps[idx]?.dayOfWeek ?? null;
            if (nextDay && nextDay !== scrollDay) setScrollDay(nextDay);
          }}
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
      )}

      <L2SuggestedSteps
        focusStepId={focusStepId}
        focusHint={focusedStep?.title}
        currentInterestId={dataset.interest.id === 'live' ? undefined : dataset.interest.id}
      />

      {currentWeek?.planningHint ? (
        <View style={styles.planningHintWrap}>
          <SeasonLibrarianPrompt prompt={currentWeek.planningHint} />
        </View>
      ) : null}
    </View>
  );
}

function L2SuggestedSteps({
  focusStepId,
  focusHint,
  currentInterestId,
}: {
  focusStepId: string;
  focusHint?: string;
  currentInterestId?: string;
}) {
  const { user } = useAuth();
  const { currentInterest, userInterests } = useInterest();
  const resolvedInterestId = currentInterestId ?? currentInterest?.id;
  const { suggestions, isLoading } = useCrossInterestSuggestions(
    focusStepId,
    resolvedInterestId,
    focusHint,
  );
  const [creatingId, setCreatingId] = useState<string | null>(null);

  const visible = suggestions.slice(0, 2);
  if (isLoading || visible.length === 0) return null;

  const createSuggestedStep = async (suggestion: CrossInterestSuggestion) => {
    if (!user?.id) return;
    const targetInterest =
      userInterests.find((i) => i.slug === suggestion.sourceInterestSlug) ??
      userInterests.find((i) => i.id === resolvedInterestId);
    if (!targetInterest) {
      showAlert('Could not create step', 'No target interest found for this suggestion.');
      return;
    }
    setCreatingId(suggestion.id);
    try {
      const created = await createStep({
        user_id: user.id,
        interest_id: targetInterest.id,
        title: suggestion.suggestion.slice(0, 80),
        status: 'pending',
        source_type: 'suggestion',
        source_id: focusStepId,
        category: suggestion.suggestedCategory || 'general',
        metadata: {
          plan: {
            what_will_you_do: suggestion.suggestion,
            capability_goals: [
              `${currentInterest?.name ?? 'Current interest'} + ${suggestion.sourceInterestName}`,
            ],
          },
          suggestion_context: {
            source_step_id: focusStepId,
            source_interest_slug: suggestion.sourceInterestSlug,
            source_interest_name: suggestion.sourceInterestName,
            relevance: suggestion.relevance,
          },
        },
      });
      router.push(`/step/${created.id}` as never);
    } catch {
      showAlert('Could not create step', 'Please try again.');
    } finally {
      setCreatingId(null);
    }
  };

  return (
    <View style={styles.suggestedWrap}>
      <View style={styles.suggestedHeader}>
        <Ionicons name="sparkles-outline" size={12} color="#AF52DE" />
        <Text style={styles.suggestedEye}>Suggested next steps</Text>
      </View>
      {visible.map((suggestion) => (
        <Pressable
          key={suggestion.id}
          style={styles.suggestedCard}
          onPress={() => void createSuggestedStep(suggestion)}
          disabled={creatingId === suggestion.id}
        >
          <View style={styles.suggestedIcon}>
            <Ionicons name="sparkles" size={13} color="#7B3FB0" />
          </View>
          <View style={styles.suggestedCopy}>
            <Text style={styles.suggestedTitle} numberOfLines={1}>
              {suggestion.suggestion}
            </Text>
            <Text style={styles.suggestedMeta} numberOfLines={1}>
              Create in {suggestion.sourceInterestName}
            </Text>
          </View>
          <Ionicons name="add-circle-outline" size={17} color={IOS_REGISTER.accentUserAction} />
        </Pressable>
      ))}
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

function EmptyWeekInline() {
  const universalPlus = useUniversalPlus();
  return (
    <View style={styles.emptyInline}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="leaf-outline" size={22} color={IOS_REGISTER.labelTertiary} />
      </View>
      <Text style={styles.emptyTitle}>No steps this week</Text>
      <Text style={styles.emptyBody}>
        Add a step or pick a day above to plan toward.
      </Text>
      {universalPlus.isAvailable ? (
        <Pressable style={styles.emptyCta} onPress={universalPlus.open}>
          <Ionicons name="add" size={16} color="#FFFFFF" />
          <Text style={styles.emptyCtaText}>Add a step</Text>
        </Pressable>
      ) : null}
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
  verbEyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelSecondary,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  contextStrip: {
    fontSize: 13,
    fontStyle: 'italic',
    color: IOS_REGISTER.labelSecondary,
    paddingHorizontal: 16,
    marginBottom: 10,
    lineHeight: 18,
  },
  planningHintWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 96, // clear the floating tab bar
  },
  suggestedWrap: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 180,
    gap: 6,
  },
  suggestedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  suggestedEye: {
    fontSize: 10,
    fontWeight: '700',
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  suggestedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(175, 82, 222, 0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(175, 82, 222, 0.28)',
  },
  suggestedIcon: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(175, 82, 222, 0.12)',
  },
  suggestedCopy: {
    flex: 1,
    minWidth: 0,
  },
  suggestedTitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.1,
  },
  suggestedMeta: {
    marginTop: 1,
    fontSize: 10.5,
    color: IOS_REGISTER.labelSecondary,
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
    paddingBottom: 18,
    gap: CARD_GAP,
  },
  emptyInline: {
    marginHorizontal: 16,
    paddingHorizontal: 18,
    paddingVertical: 22,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 14,
    alignItems: 'center',
  },
  emptyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: IOS_REGISTER.fillPill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  emptyBody: {
    fontSize: 13.5,
    color: IOS_REGISTER.labelSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: IOS_REGISTER.accentUserAction,
  },
  emptyCtaText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
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
