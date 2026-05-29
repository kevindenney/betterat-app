/**
 * L2 — nearby planning field centered on NOW.
 *
 * This surface is intentionally sequence-first, not calendar-first. The
 * user reads it as "just happened -> now -> next" rather than as a dated
 * week strip. The current card rides under a fixed NOW bar, while the
 * season-shape sentence + short-horizon counts frame the nearby run of
 * steps.
 *
 * Section D drag-reorder (Frame 13): long-press a card in the carousel to
 * lift it, then drag left/right to reorder. The hook uses horizontal axis
 * hit-testing; ScrollView's scrollEnabled is bound to drag.isDragging so
 * the swipe-to-scroll gesture stops competing once a card is lifted.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { Ionicons } from '@expo/vector-icons';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { StepDigestCard } from './StepDigestCard';
import { SeasonLibrarianPrompt } from './SeasonLibrarianPrompt';
import { useDragReorder } from './useDragReorder';
import { resolveInterestVocab } from './interestVocab';
import { useUniversalPlus } from '@/components/capture/UniversalPlusProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { createStep, shiftTimelineSortOrdersAtOrAfter } from '@/services/TimelineStepService';
import { useInboxItems } from '@/hooks/useInboxItems';
import { useInboxActions } from '@/hooks/useInboxActions';
import { useCrossInterestSuggestions } from '@/hooks/useCrossInterestSuggestions';
import { ANALYSIS_MIN_STEPS } from './realDataAdapter';
import {
  useAdoptBlueprintStep,
  useSuggestedNextSteps,
} from '@/hooks/useBlueprint';
import type { InboxItem } from '@/components/practice/types';
import type { CrossInterestSuggestion } from '@/types/step-detail';
import type { TimelineDataset, TimelineStep } from './types';
import type { BlueprintSuggestedNextStep } from '@/types/blueprint';

/**
 * `peek` keeps the canonical carousel-with-silhouettes layout — large
 * centered card (150pt), neighbours peeking from the edges, snap-to-
 * centre. Right for personas with a sparser week (sailing's 1–3 races,
 * golf's 1–2 rounds).
 *
 * `compact` swaps in narrower cards (100pt) and 5–6 visible at a time
 * without snap — right for densely-scheduled weeks (nursing's daily
 * clinical / sim / lecture / debrief cadence; an entrepreneur's haat
 * + production + scheme-deadline week). The view stays scrollable.
 */
export type L2Density = 'peek' | 'compact';

const DENSE_INTEREST_VOCAB_IDS: ReadonlySet<string> = new Set([
  'nursing',
  'entrepreneur',
]);

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
  /**
   * Mark a step done. Wired to the drag gesture: dropping a pending card to
   * the left of the NOW bar (into the "past") completes it instead of
   * reordering.
   */
  onMarkStepDone?: (stepId: string) => void;
  /**
   * Toggle a how-sub-step on an in-play step's cover card. L2 shows the
   * checklist on cards whose status is 'do'.
   */
  onToggleHowItem?: (
    stepId: string,
    subStepId: string,
    completed: boolean,
  ) => void;
  /**
   * Layout density. Defaults to the interest vocab's preference (dense
   * personas get `compact`, sparse personas get `peek`). Pass explicitly
   * to override.
   */
  density?: L2Density;
}

export function L2WeekView({
  dataset,
  focusStepId,
  onOpenStep,
  onReorderStep,
  onMarkStepDone,
  onToggleHowItem,
  density,
}: L2WeekViewProps) {
  const { width: viewportWidth } = useWindowDimensions();
  const vocab = useMemo(
    () =>
      resolveInterestVocab(
        dataset.interest.id,
        dataset.interest.label,
        dataset.interest.slug,
      ),
    [dataset.interest.id, dataset.interest.label, dataset.interest.slug],
  );
  const effectiveDensity: L2Density =
    density ?? (DENSE_INTEREST_VOCAB_IDS.has(vocab.id) ? 'compact' : 'peek');
  const cardWidth = effectiveDensity === 'compact' ? COMPACT_CARD_WIDTH : CARD_WIDTH;
  const universalPlus = useUniversalPlus();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { currentInterest } = useInterest();
  const { data: inboxItems = [] } = useInboxItems();
  const currentSeason = dataset.seasons.find((s) => s.id === dataset.currentSeasonId);
  const currentWeek = currentSeason?.weeks.find((w) => w.isCurrent);
  // Nearby still centers on NOW, but it should span the whole current
  // season so the user can swipe across the arc rather than getting
  // trapped inside the current week bucket.
  const steps: TimelineStep[] = useMemo(
    () => reorderNearbySteps(currentSeason?.weeks.flatMap((week) => week.steps) ?? []),
    [currentSeason],
  );
  const nowSplitIndex = useMemo(
    () => getNowSplitIndex(steps),
    [steps],
  );
  const defaultFocusIndex =
    nowSplitIndex < steps.length ? nowSplitIndex : Math.max(0, steps.length - 1);

  const initialCenterIndex = steps.findIndex((s) => s.id === focusStepId);
  const [centerIndex, setCenterIndex] = useState(
    initialCenterIndex >= 0 ? initialCenterIndex : defaultFocusIndex,
  );
  const [scrollX, setScrollX] = useState(0);
  const centeredStep = steps[centerIndex] ?? steps[steps.length - 1];
  // Compact density relaxes centering — at 5–6 cards visible we don't
  // need to pin the centred card to the viewport midpoint; let the
  // strip start from the leading edge with a small inset.
  const sideInset =
    effectiveDensity === 'compact'
      ? 16
      : Math.max(16, (viewportWidth - cardWidth) / 2);
  const nowBarLeft = Math.max(
    8,
    Math.min(
      viewportWidth - NOW_BAR_WIDTH - 8,
      sideInset +
        Math.max(0, nowSplitIndex) * (cardWidth + CARD_GAP) -
        CARD_GAP / 2 -
        NOW_BAR_WIDTH / 2 -
        scrollX,
    ),
  );
  // Count by real status, not NOW-bar position — a pending step sitting at
  // the NOW marker is "queued", not "in play". Position drives the timeline
  // layout (nowSplitIndex); these pills describe what the steps actually are,
  // matching each card's own status label.
  const doneCount = steps.filter(
    (s) => s.status === 'done' || s.status === 'reflected',
  ).length;
  const inCount = steps.filter(
    (s) => s.status === 'do' || s.status === 'reflect',
  ).length;
  const queuedCount = steps.filter((s) => s.status === 'plan').length;
  const nowGapIndex = Math.max(-1, nowSplitIndex - 1);
  const planningHint = currentWeek?.planningHint;
  const resolvedInterestId = dataset.interest.id === 'live' ? undefined : dataset.interest.id;
  const activeStepId = centeredStep?.id ?? focusStepId;
  const activeStepTitle = centeredStep?.title;
  // First-run: a brand-new user with only a handful of steps shouldn't get
  // cross-interest AI suggestions ("apply X from golf") — they read as
  // premature coaching and each fires a vendor AI call. Hold them until
  // there's enough practice for a connection to be meaningful.
  const firstRun = dataset.totalSteps < ANALYSIS_MIN_STEPS;
  const { data: blueprintSuggestions = [] } = useSuggestedNextSteps(resolvedInterestId);
  const { suggestions: crossInterestSuggestions, isLoading: suggestionsLoading } =
    useCrossInterestSuggestions(
      firstRun ? undefined : activeStepId,
      resolvedInterestId,
      activeStepTitle,
    );
  // Direct suggestions from the user's network (teammates, coaches) normally
  // only land in the Inbox. Surface the most relevant one or two here so a
  // human nudge shapes the plan alongside blueprint + cross-interest cards.
  const visibleInbox = useMemo(
    () => pickInboxSuggestions(inboxItems, activeStepId, resolvedInterestId, 2),
    [inboxItems, activeStepId, resolvedInterestId],
  );
  const visibleBlueprints = useMemo(
    () => blueprintSuggestions.slice(0, 2),
    [blueprintSuggestions],
  );
  const visibleCrossInterest = useMemo(
    () =>
      crossInterestSuggestions.slice(
        0,
        Math.max(0, 4 - visibleInbox.length - visibleBlueprints.length),
      ),
    [crossInterestSuggestions, visibleInbox.length, visibleBlueprints.length],
  );
  const promptSupportingLine = useMemo(
    () =>
      buildPendingSuggestionLine({
        inboxItems,
        focusStepId: activeStepId,
        interestId: resolvedInterestId,
        visibleBlueprints,
      }),
    [
      activeStepId,
      inboxItems,
      resolvedInterestId,
      visibleBlueprints,
    ],
  );
  const resolvedPlanningHint = useMemo(() => {
    if (!planningHint || !promptSupportingLine) return planningHint;
    return {
      ...planningHint,
      supportingLine: promptSupportingLine,
    };
  }, [planningHint, promptSupportingLine]);
  const [hidePlanningHint, setHidePlanningHint] = useState(false);
  const [insertGap, setInsertGap] = useState<{
    afterStepId: string;
    beforeStepId: string | null;
  } | null>(null);
  const [insertDraftTitle, setInsertDraftTitle] = useState('');
  const [inserting, setInserting] = useState(false);

  useEffect(() => {
    setHidePlanningHint(false);
  }, [resolvedPlanningHint?.body]);

  // Carousel ref so we can center the current card on mount and when the
  // focused step changes from the parent canvas.
  const scrollRef = useRef<ScrollView>(null);

  // Live snapshot of "is the lifted card currently in the complete zone (left
  // of NOW)?". The drag hook's onDrop reads this at release time to decide
  // between reorder and mark-done.
  const willCompleteRef = useRef(false);

  const drag = useDragReorder<TimelineStep>({
    items: steps,
    axis: 'horizontal',
    enabled: Boolean(onReorderStep) || Boolean(onMarkStepDone),
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
    onDrop: useCallback(
      (id: string) => {
        if (willCompleteRef.current) {
          onMarkStepDone?.(id);
          return true;
        }
        return false;
      },
      [onMarkStepDone],
    ),
  });

  // Mark-done affordance: while a pending card is lifted, decide whether its
  // current center has crossed left of the NOW bar. Card x is deterministic
  // from index (uniform stride = cardWidth + CARD_GAP, leading inset =
  // sideInset), so we don't need a measured rect — we reuse the same geometry
  // that positions the NOW bar. Done/reflected cards never complete (no-op).
  const liftedIndex = drag.liftedId
    ? steps.findIndex((s) => s.id === drag.liftedId)
    : -1;
  const liftedStep = liftedIndex >= 0 ? steps[liftedIndex] : null;
  const liftedIsPending =
    !!liftedStep && liftedStep.status !== 'done' && liftedStep.status !== 'reflected';
  const liftedCenterViewport =
    sideInset +
    liftedIndex * (cardWidth + CARD_GAP) +
    cardWidth / 2 +
    drag.liftedTranslate -
    scrollX;
  const nowBarCenter = nowBarLeft + NOW_BAR_WIDTH / 2;
  const willCompleteLifted =
    drag.isDragging && liftedIsPending && liftedCenterViewport < nowBarCenter;
  willCompleteRef.current = willCompleteLifted;

  // Auto-scroll on mount + when focus changes (e.g. pinch-in/out preserves
  // focusStepId; the carousel should open with that card visible).
  useEffect(() => {
    const idx = steps.findIndex((s) => s.id === focusStepId);
    const focusedStep = idx >= 0 ? steps[idx] : null;
    const shouldCenterFocusedStep =
      idx >= 0 &&
      focusedStep &&
      (
        idx <= nowSplitIndex ||
        focusedStep.status === 'do' ||
        focusedStep.status === 'reflect'
      );
    const targetIndex = shouldCenterFocusedStep ? idx : defaultFocusIndex;
    if (targetIndex < 0) return;
    setCenterIndex(targetIndex);
    // requestAnimationFrame so the ScrollView has finished its initial
    // layout before we scroll into it on mount.
    requestAnimationFrame(() => {
      const targetScrollX = targetIndex * (cardWidth + CARD_GAP);
      setScrollX(targetScrollX);
      scrollRef.current?.scrollTo({
        x: targetScrollX,
        animated: false,
      });
    });
  }, [defaultFocusIndex, focusStepId, nowSplitIndex, steps, cardWidth]);

  // Web: a horizontal ScrollView ignores the vertical mouse wheel, so the
  // carousel reads as frozen on desktop. Translate a predominantly-vertical
  // wheel into horizontal scroll on the underlying DOM node.
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const node = (scrollRef.current as unknown as {
      getScrollableNode?: () => HTMLElement | null;
    })?.getScrollableNode?.();
    if (!node) return undefined;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      node.scrollLeft += event.deltaY;
      event.preventDefault();
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [steps.length]);

  const handlePlanningHintPrimary = useCallback(() => {
    const intent = planningHint?.primaryCta.intent;
    if (!intent) return;
    if ((intent === 'add-step' || intent === 'accept-suggestion') && universalPlus.isAvailable) {
      universalPlus.open();
      return;
    }
    if (intent === 'open-suggestion-inbox') {
      router.push('/(tabs)/inbox' as never);
      return;
    }
    if (intent === 'open-season-check-in') {
      if (centeredStep?.id) router.push(`/step/${centeredStep.id}` as never);
      return;
    }
  }, [planningHint, universalPlus, centeredStep?.id]);

  const handlePlanningHintSecondary = useCallback(() => {
    setHidePlanningHint(true);
  }, []);

  const handleOpenInsertSheet = useCallback((afterStepId: string, beforeStepId: string | null) => {
    setInsertGap({ afterStepId, beforeStepId });
    setInsertDraftTitle('');
  }, []);

  const handleCloseInsertSheet = useCallback(() => {
    if (inserting) return;
    setInsertGap(null);
    setInsertDraftTitle('');
  }, [inserting]);

  const handleCreateInsertedStep = useCallback(async () => {
    if (!user?.id || !currentInterest?.id || !insertGap) {
      showAlert('Could not add step', 'Choose an interest and try again.');
      return;
    }
    const title = insertDraftTitle.trim();
    if (!title) {
      showAlert('Step title needed', 'Name the step you want to insert.');
      return;
    }

    const after = steps.find((step) => step.id === insertGap.afterStepId);
    const before = insertGap.beforeStepId
      ? steps.find((step) => step.id === insertGap.beforeStepId)
      : null;
    if (!after) {
      showAlert('Could not add step', 'The insertion point is no longer available.');
      return;
    }

    let nextSort = after.sort_order + 1;
    if (before) {
      await shiftTimelineSortOrdersAtOrAfter(user.id, currentInterest.id, before.sort_order);
      nextSort = before.sort_order;
    }

    setInserting(true);
    try {
      const created = await createStep({
        user_id: user.id,
        interest_id: currentInterest.id,
        title,
        status: 'pending',
        visibility: 'private',
        source_type: 'manual',
        sort_order: nextSort,
        metadata: {
          draft: true,
          insertion_context: {
            after_step_id: after.id,
            before_step_id: before?.id ?? null,
            source: 'timeline_zoom_l2_gap',
          },
        },
      });

      queryClient.setQueriesData<any[]>(
        {
          predicate: (query) => {
            const key = query.queryKey;
            return (
              Array.isArray(key) &&
              key[0] === 'timeline-steps' &&
              key[1] === 'mine' &&
              (key[2] === currentInterest.id ||
                key[2] === 'all' ||
                (typeof key[2] === 'string' && key[2].split(',').includes(currentInterest.id)))
            );
          },
        },
        (old) => {
          if (!Array.isArray(old)) return old;
          const shifted = before
            ? old.map((row) => (
                row.interest_id === currentInterest.id && row.sort_order >= before.sort_order
                  ? { ...row, sort_order: row.sort_order + 1 }
                  : row
              ))
            : old;
          if (shifted.some((row) => row.id === created.id)) return shifted;
          return [...shifted, created].sort((a, b) => {
            if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
            return String(a.created_at).localeCompare(String(b.created_at));
          });
        },
      );
      queryClient.setQueryData(['timeline-steps', 'detail', created.id], created);
      void queryClient.invalidateQueries({ queryKey: ['timeline-steps'] });
      const insertionIndex = Math.max(0, steps.findIndex((step) => step.id === after.id) + 1);
      setCenterIndex(insertionIndex);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          x: insertionIndex * (cardWidth + CARD_GAP),
          animated: true,
        });
      });
      setInsertGap(null);
      setInsertDraftTitle('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      showAlert('Could not add step', message);
    } finally {
      setInserting(false);
    }
  }, [currentInterest?.id, insertDraftTitle, insertGap, queryClient, steps, user?.id, cardWidth]);

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        bounces
      >
        <View style={styles.sequenceWrap}>
          {steps.length === 0 ? (
            <EmptyWeekInline />
          ) : (
            <>
              <View style={styles.contextCard}>
                {currentWeek?.contextStrip ? renderContextStrip(currentWeek.contextStrip) : null}
                <View style={styles.contextCardFooter}>
                  {currentSeason?.weekOfTotal ? (
                    <Text style={styles.contextCardMeta}>
                      wk {currentSeason.weekOfTotal.current} / {currentSeason.weekOfTotal.total}
                    </Text>
                  ) : (
                    <View />
                  )}
                  <View style={styles.contextCardCounts}>
                    <CountPill label={`${doneCount} done`} tone="done" />
                    <CountPill label={`${inCount} in play`} tone="in" />
                    <CountPill label={`${queuedCount} queued`} tone="planned" />
                  </View>
                </View>
              </View>

              <ScrollView
                ref={scrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.cardCarousel, { paddingHorizontal: sideInset }]}
                snapToInterval={cardWidth + CARD_GAP}
                decelerationRate="fast"
                scrollEnabled={!drag.isDragging}
                scrollEventThrottle={32}
                onScroll={(e) => {
                  const x = e.nativeEvent.contentOffset.x;
                  const idx = Math.max(
                    0,
                    Math.min(steps.length - 1, Math.round(x / (cardWidth + CARD_GAP))),
                  );
                  setScrollX(x);
                  if (idx !== centerIndex) setCenterIndex(idx);
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
                      nextStep={steps[index + 1] ?? null}
                      isLast={index === steps.length - 1}
                      showInsertAfter={index !== steps.length - 1 && index !== nowGapIndex}
                      isLifted={isLifted}
                      willComplete={isLifted && willCompleteLifted}
                      showDropIndicatorBefore={showDropIndicator}
                      liftedTranslateX={drag.liftedTranslate}
                      highlighted={index === centerIndex}
                      cardWidth={cardWidth}
                      onOpen={() => onOpenStep(step.id)}
                      onInsertAfter={() => handleOpenInsertSheet(step.id, steps[index + 1]?.id ?? null)}
                      buildGesture={drag.buildItemGesture}
                      registerRowLayout={drag.registerRowLayout}
                      onToggleHowItem={
                        onToggleHowItem
                          ? (subStepId, completed) =>
                              onToggleHowItem(step.id, subStepId, completed)
                          : undefined
                      }
                    />
                  );
                })}
              </ScrollView>

              {resolvedPlanningHint && !hidePlanningHint ? (
                <View style={styles.bottomPromptOverlay}>
                  <SeasonLibrarianPrompt
                    prompt={resolvedPlanningHint}
                    onPrimary={handlePlanningHintPrimary}
                    onSecondary={handlePlanningHintSecondary}
                  />
                </View>
              ) : null}

              <View style={[styles.nowBarWrap, { left: nowBarLeft }]}>
                <View style={styles.nowPill}>
                  <Text style={styles.nowPillText}>NOW</Text>
                </View>
                <View style={styles.nowBar} />
                <View style={styles.nowDot} />
              </View>
            </>
          )}
        </View>

        {firstRun && steps.length > 0 ? (
          <View style={styles.capabilityTeaser}>
            <Text style={styles.capabilityTeaserEyebrow}>{vocab.capabilityHeader}</Text>
            <Text style={styles.capabilityTeaserText}>
              Add a few more steps to see how your work spreads across capabilities.
            </Text>
          </View>
        ) : null}

        <L2SuggestedSteps
          focusStepId={activeStepId}
          currentInterestId={resolvedInterestId}
          visibleInbox={visibleInbox}
          visibleBlueprints={visibleBlueprints}
          visibleCrossInterest={visibleCrossInterest}
          isLoading={suggestionsLoading}
        />
      </ScrollView>

      <InsertBetweenStepsSheet
        visible={insertGap != null}
        title={insertDraftTitle}
        onChangeTitle={setInsertDraftTitle}
        onClose={handleCloseInsertSheet}
        onSubmit={() => void handleCreateInsertedStep()}
        submitting={inserting}
        afterTitle={steps.find((step) => step.id === insertGap?.afterStepId)?.title ?? null}
        beforeTitle={
          insertGap?.beforeStepId
            ? steps.find((step) => step.id === insertGap.beforeStepId)?.title ?? null
            : null
        }
      />
    </>
  );
}

function getNowSplitIndex(steps: TimelineStep[]) {
  const firstUpcoming = steps.findIndex(
    (step) => step.status !== 'done' && step.status !== 'reflected',
  );
  return firstUpcoming >= 0 ? firstUpcoming : steps.length;
}

function reorderNearbySteps(steps: TimelineStep[]) {
  const completed = steps.filter(
    (step) => step.status === 'done' || step.status === 'reflected',
  );
  const active = steps.filter(
    (step) => step.status !== 'done' && step.status !== 'reflected',
  );
  return [...completed, ...active];
}

function trimSuggestionText(value: string | undefined, maxLength = 68) {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function possessiveLabel(name: string) {
  return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

function pickInboxSuggestions(
  inboxItems: InboxItem[],
  focusStepId: string,
  interestId: string | undefined,
  limit: number,
): InboxItem[] {
  const suggestions = inboxItems.filter((item) => item.kind === 'suggestion');
  if (suggestions.length === 0) return [];
  // Only show direct suggestions belonging to the interest the user is
  // currently looking at (when known) — a sail-racing rail shouldn't surface a
  // golf suggestion. Within those, prefer ones tied to the focused step.
  const relevant = interestId
    ? suggestions.filter((item) => item.raw.interestId === interestId)
    : suggestions;
  return [...relevant]
    .sort((a, b) => {
      const aMatch = a.raw.sourceStepId === focusStepId ? 1 : 0;
      const bMatch = b.raw.sourceStepId === focusStepId ? 1 : 0;
      return bMatch - aMatch;
    })
    .slice(0, limit);
}

function pickPendingInboxSuggestion(
  inboxItems: InboxItem[],
  focusStepId: string,
  interestId?: string,
) {
  const suggestions = inboxItems.filter((item) => item.kind === 'suggestion');
  return (
    suggestions.find((item) => item.raw.sourceStepId === focusStepId) ??
    (interestId
      ? suggestions.find((item) => item.raw.interestId === interestId)
      : undefined)
  );
}

function buildPendingSuggestionLine({
  inboxItems,
  focusStepId,
  interestId,
  visibleBlueprints,
}: {
  inboxItems: InboxItem[];
  focusStepId: string;
  interestId?: string;
  visibleBlueprints: BlueprintSuggestedNextStep[];
}) {
  const inboxSuggestion = pickPendingInboxSuggestion(inboxItems, focusStepId, interestId);
  if (inboxSuggestion) {
    const title =
      trimSuggestionText(inboxSuggestion.title) ??
      trimSuggestionText(inboxSuggestion.blurb);
    const sender = trimSuggestionText(inboxSuggestion.fromContext, 32) ?? 'A teammate';
    if (title && title !== 'Free-form suggestion') {
      return `${sender} suggested "${title}" in your Inbox.`;
    }
    return `${possessiveLabel(sender)} suggestion in your Inbox would fit here.`;
  }

  const blueprintSuggestion = visibleBlueprints[0];
  if (blueprintSuggestion) {
    const title = trimSuggestionText(resolveBlueprintSuggestionTitle(blueprintSuggestion));
    const source = trimSuggestionText(blueprintSuggestion.blueprint_title, 36);
    if (title && source) return `"${title}" from ${source} would fit here.`;
    if (title) return `"${title}" would fit here.`;
  }

  return undefined;
}

type CountPillTone = 'done' | 'in' | 'planned';

function CountPill({
  label,
  tone,
}: {
  label: string;
  tone: CountPillTone;
}) {
  return (
    <View style={[styles.countPill, COUNT_PILL_TONE[tone].wrap]}>
      <View style={[styles.countDot, COUNT_PILL_TONE[tone].dot]} />
      <Text style={[styles.countText, COUNT_PILL_TONE[tone].text]}>{label}</Text>
    </View>
  );
}

function renderContextStrip(contextStrip: string) {
  const marker = ' has been ';
  const splitIndex = contextStrip.indexOf(marker);
  if (splitIndex < 0) {
    return <Text style={styles.contextCardText}>{contextStrip}</Text>;
  }
  const prefix = contextStrip.slice(0, splitIndex + marker.length);
  const emphasis = contextStrip.slice(splitIndex + marker.length);
  return (
    <Text style={styles.contextCardText}>
      {prefix}
      <Text style={styles.contextCardTextStrong}>{emphasis}</Text>
    </Text>
  );
}

function L2SuggestedSteps({
  focusStepId,
  currentInterestId,
  visibleInbox,
  visibleBlueprints,
  visibleCrossInterest,
  isLoading,
}: {
  focusStepId: string;
  currentInterestId?: string;
  visibleInbox: InboxItem[];
  visibleBlueprints: BlueprintSuggestedNextStep[];
  visibleCrossInterest: CrossInterestSuggestion[];
  isLoading: boolean;
}) {
  const { user } = useAuth();
  const { currentInterest, userInterests, switchInterest } = useInterest();
  const resolvedInterestId = currentInterestId ?? currentInterest?.id;
  const queryClient = useQueryClient();
  const adoptBlueprintStep = useAdoptBlueprintStep();
  const { accept: acceptInboxItem } = useInboxActions();
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [adoptingId, setAdoptingId] = useState<string | null>(null);
  const [acceptingInboxId, setAcceptingInboxId] = useState<string | null>(null);
  // Optimistically hide a network suggestion the instant it's accepted —
  // the inbox refetch (invalidated inside accept) lags behind the tap.
  const [acceptedInboxIds, setAcceptedInboxIds] = useState<string[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<SuggestionDetailState | null>(null);

  const inboxCards = visibleInbox.filter((item) => !acceptedInboxIds.includes(item.id));

  const hasAny =
    inboxCards.length > 0 ||
    visibleBlueprints.length > 0 ||
    visibleCrossInterest.length > 0;

  if (isLoading || !hasAny) return null;

  const acceptSuggestedInboxItem = async (item: InboxItem) => {
    setAcceptingInboxId(item.id);
    try {
      await acceptInboxItem(item);
      setAcceptedInboxIds((prev) => [...prev, item.id]);
    } catch {
      // accept() surfaces its own error toast; leave the card in place to retry.
    } finally {
      setAcceptingInboxId(null);
    }
  };

  const createSuggestedStep = async (
    suggestion: CrossInterestSuggestion,
    targetMode: 'source' | 'current' = 'source',
  ) => {
    if (!user?.id) return;
    const targetInterest =
      targetMode === 'current'
        ? userInterests.find((i) => i.id === resolvedInterestId)
        : userInterests.find((i) => i.slug === suggestion.sourceInterestSlug) ??
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
      // Drop the acted-on suggestion from its cache so it doesn't reappear
      // when the user navigates back. The cross-interest list is ephemeral
      // AI output (no server-side dismissal); the React Query cache is
      // global, so this removal survives this component unmounting on push.
      queryClient.setQueryData<CrossInterestSuggestion[]>(
        ['cross-interest-suggestions', focusStepId, resolvedInterestId],
        (old) => (old ?? []).filter((s) => s.id !== suggestion.id),
      );
      if (targetMode === 'source') {
        await switchInterest(suggestion.sourceInterestSlug);
      }
      setSelectedSuggestion(null);
      router.push(`/(tabs)/practice?selected=${created.id}` as never);
    } catch {
      showAlert('Could not create step', 'Please try again.');
    } finally {
      setCreatingId(null);
    }
  };

  const adoptSuggestedBlueprintStep = async (suggestion: BlueprintSuggestedNextStep) => {
    if (!resolvedInterestId) return;
    setAdoptingId(suggestion.next_step_id);
    try {
      const adopted = await adoptBlueprintStep.mutateAsync({
        sourceStepId: suggestion.next_step_id,
        interestId: resolvedInterestId,
        subscriptionId: suggestion.subscription_id,
        blueprintId: suggestion.blueprint_id,
      });
      setSelectedSuggestion(null);
      router.push(`/(tabs)/practice?selected=${adopted.id}` as never);
    } catch {
      showAlert('Could not add step', 'Please try again.');
    } finally {
      setAdoptingId(null);
    }
  };

  return (
    <View style={styles.suggestedWrap}>
      <View style={styles.suggestedHeader}>
        <Ionicons name="sparkles-outline" size={12} color="#AF52DE" />
        <Text style={styles.suggestedEye}>Suggestions shaping this plan</Text>
      </View>
      {inboxCards.map((item) => (
        <Pressable
          key={`inbox-${item.id}`}
          style={styles.suggestedCard}
          onPress={() => router.push('/practice/inbox' as never)}
        >
          <View style={[styles.suggestedIcon, styles.suggestedIconInbox]}>
            <Ionicons name="person" size={13} color="#0A7E3E" />
          </View>
          <View style={styles.suggestedCopy}>
            <Text style={styles.suggestedTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.suggestedSource} numberOfLines={1}>
              Direct suggestion
            </Text>
            <Text style={styles.suggestedMeta} numberOfLines={1}>
              From {item.fromContext}
            </Text>
          </View>
          <Pressable
            hitSlop={8}
            onPress={(event) => {
              event.stopPropagation();
              void acceptSuggestedInboxItem(item);
            }}
            disabled={acceptingInboxId === item.id}
          >
            <Ionicons name="add-circle-outline" size={17} color={IOS_REGISTER.accentUserAction} />
          </Pressable>
        </Pressable>
      ))}
      {visibleBlueprints.map((suggestion) => (
        <Pressable
          key={`bp-${suggestion.next_step_id}`}
          style={styles.suggestedCard}
          onPress={() => setSelectedSuggestion({ kind: 'blueprint', suggestion })}
        >
          <View style={[styles.suggestedIcon, styles.suggestedIconBlueprint]}>
            <Ionicons name="bookmark" size={13} color="#2367D1" />
          </View>
          <View style={styles.suggestedCopy}>
            <Text style={styles.suggestedTitle} numberOfLines={1}>
              {resolveBlueprintSuggestionTitle(suggestion)}
            </Text>
            <Text style={styles.suggestedSource} numberOfLines={1}>
              From subscribed blueprint
            </Text>
            <Text style={styles.suggestedMeta} numberOfLines={1}>
              {suggestion.blueprint_title}
              {suggestion.author_name ? ` · ${suggestion.author_name}` : ''}
            </Text>
          </View>
          <Pressable
            hitSlop={8}
            onPress={(event) => {
              event.stopPropagation();
              void adoptSuggestedBlueprintStep(suggestion);
            }}
            disabled={adoptingId === suggestion.next_step_id}
          >
            <Ionicons name="add-circle-outline" size={17} color={IOS_REGISTER.accentUserAction} />
          </Pressable>
        </Pressable>
      ))}
      {visibleCrossInterest.map((suggestion) => (
        <Pressable
          key={suggestion.id}
          style={styles.suggestedCard}
          onPress={() => setSelectedSuggestion({ kind: 'cross-interest', suggestion })}
        >
          <View style={styles.suggestedIcon}>
            <Ionicons name="sparkles" size={13} color="#7B3FB0" />
          </View>
          <View style={styles.suggestedCopy}>
            <Text style={styles.suggestedTitle} numberOfLines={1}>
              {suggestion.suggestion}
            </Text>
            <Text style={styles.suggestedSource} numberOfLines={1}>
              Cross-interest
            </Text>
            <Text style={styles.suggestedMeta} numberOfLines={1}>
              From {suggestion.sourceInterestName}
            </Text>
          </View>
          <Pressable
            hitSlop={8}
            onPress={(event) => {
              event.stopPropagation();
              void createSuggestedStep(suggestion);
            }}
            disabled={creatingId === suggestion.id}
          >
            <Ionicons name="add-circle-outline" size={17} color={IOS_REGISTER.accentUserAction} />
          </Pressable>
        </Pressable>
      ))}
      <SuggestionDetailSheet
        suggestion={selectedSuggestion}
        adopting={adoptingId}
        creating={creatingId}
        onClose={() => setSelectedSuggestion(null)}
        onAddBlueprint={(suggestion) => void adoptSuggestedBlueprintStep(suggestion)}
        onAddCrossInterest={(suggestion, targetMode) => void createSuggestedStep(suggestion, targetMode)}
        currentInterestName={currentInterest?.name}
      />
    </View>
  );
}

interface DraggableCarouselSlotProps {
  step: TimelineStep;
  index: number;
  nextStep: TimelineStep | null;
  isLast: boolean;
  showInsertAfter: boolean;
  isLifted: boolean;
  /** True while this lifted card sits left of NOW — it will be marked done on drop. */
  willComplete: boolean;
  showDropIndicatorBefore: boolean;
  liftedTranslateX: number;
  highlighted: boolean;
  /** Density-resolved card width — overrides the static cardSlot style. */
  cardWidth: number;
  onOpen: () => void;
  onInsertAfter?: () => void;
  buildGesture: ReturnType<typeof useDragReorder>['buildItemGesture'];
  registerRowLayout: ReturnType<typeof useDragReorder>['registerRowLayout'];
  onToggleHowItem?: (subStepId: string, completed: boolean) => void;
}

function DraggableCarouselSlot({
  step,
  index,
  nextStep,
  isLast,
  showInsertAfter,
  isLifted,
  willComplete,
  showDropIndicatorBefore,
  liftedTranslateX,
  highlighted,
  cardWidth,
  onOpen,
  onInsertAfter,
  buildGesture,
  registerRowLayout,
  onToggleHowItem,
}: DraggableCarouselSlotProps) {
  // Compose the long-press-to-lift Pan with a Tap so tap-to-open and
  // drag-to-reorder don't fight (the old card-level Pressable couldn't
  // coordinate with the RNGH pan, so a short drag registered as a tap and
  // opened the step). Exclusive gives the pan priority: a held lift wins,
  // and the tap only fires when the pan fails (a quick, stationary press).
  // A moving finger satisfies neither, so it falls through to the carousel
  // ScrollView and scrolls.
  const gesture = useMemo(() => {
    const pan = buildGesture(step.id, index);
    // runOnJS(true): the tap handler calls onOpen (a plain JS function), so the
    // callback must run on the JS thread. Without this it executes as a worklet
    // on the UI thread and crashes ("Tried to synchronously call a non-worklet
    // function on the UI thread").
    const tap = Gesture.Tap()
      .runOnJS(true)
      .onEnd((_event, success) => {
        if (success) onOpen();
      });
    return Gesture.Exclusive(pan, tap);
  }, [buildGesture, step.id, index, onOpen]);

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
    <View style={[styles.cardSlot, { width: cardWidth }]}>
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
            variant="nearby"
            highlighted={highlighted}
            showRelevantSnippet={highlighted}
            onToggleHowItem={onToggleHowItem}
          />
          {willComplete ? (
            <View style={styles.completeOverlay} pointerEvents="none">
              <View style={styles.completeBadge}>
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                <Text style={styles.completeBadgeText}>Mark done</Text>
              </View>
            </View>
          ) : null}
        </Animated.View>
      </GestureDetector>
      {!isLast && showInsertAfter ? (
        <Pressable
          style={styles.insertButton}
          onPress={onInsertAfter}
          accessibilityLabel={`Add a step between ${step.title} and ${nextStep?.title ?? 'the next step'}`}
        >
          <Ionicons name="add" size={15} color={IOS_REGISTER.accentUserAction} />
        </Pressable>
      ) : null}
    </View>
  );
}

type SuggestionDetailState =
  | { kind: 'blueprint'; suggestion: BlueprintSuggestedNextStep }
  | { kind: 'cross-interest'; suggestion: CrossInterestSuggestion };

function resolveBlueprintSuggestionTitle(suggestion: BlueprintSuggestedNextStep) {
  const trimmed = suggestion.next_step_title?.trim();
  if (trimmed) return trimmed;
  const desc = suggestion.next_step_description?.trim();
  if (desc) return trimSuggestionText(desc, 64) ?? desc;
  return 'Suggested step from subscribed blueprint';
}

function SuggestionDetailSheet({
  suggestion,
  adopting,
  creating,
  onClose,
  onAddBlueprint,
  onAddCrossInterest,
  currentInterestName,
}: {
  suggestion: SuggestionDetailState | null;
  adopting: string | null;
  creating: string | null;
  onClose: () => void;
  onAddBlueprint: (suggestion: BlueprintSuggestedNextStep) => void;
  onAddCrossInterest: (suggestion: CrossInterestSuggestion, targetMode: 'source' | 'current') => void;
  currentInterestName?: string;
}) {
  const blueprintSuggestion = suggestion?.kind === 'blueprint' ? suggestion.suggestion : null;
  const crossInterestSuggestion = suggestion?.kind === 'cross-interest' ? suggestion.suggestion : null;
  const submitting =
    (blueprintSuggestion && adopting === blueprintSuggestion.next_step_id) ||
    (crossInterestSuggestion && creating === crossInterestSuggestion.id);

  return (
    <Modal
      visible={suggestion != null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheetCard} onPress={() => undefined}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>
            {blueprintSuggestion ? 'Suggested next step' : 'Cross-interest idea'}
          </Text>
          {blueprintSuggestion ? (
            <>
              <Text style={styles.sheetDetailTitle}>
                {resolveBlueprintSuggestionTitle(blueprintSuggestion)}
              </Text>
              <Text style={styles.sheetDetailMeta}>
                From {blueprintSuggestion.blueprint_title}
                {blueprintSuggestion.author_name ? ` · ${blueprintSuggestion.author_name}` : ''}
              </Text>
              <Text style={styles.sheetDetailBody}>
                {blueprintSuggestion.next_step_description?.trim() ||
                  'Adopt this step from a subscribed blueprint into your nearby run.'}
              </Text>
              <View style={styles.sheetActions}>
                <Pressable style={styles.sheetSecondaryButton} onPress={onClose}>
                  <Text style={styles.sheetSecondaryButtonText}>Not now</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.sheetPrimaryButton,
                    submitting && styles.sheetPrimaryButtonDisabled,
                  ]}
                  onPress={() => onAddBlueprint(blueprintSuggestion)}
                  disabled={Boolean(submitting)}
                >
                  <Text style={styles.sheetPrimaryButtonText}>
                    {submitting ? 'Adding…' : 'Add this step'}
                  </Text>
                </Pressable>
              </View>
            </>
          ) : crossInterestSuggestion ? (
            <>
              <Text style={styles.sheetDetailTitle}>
                {crossInterestSuggestion.suggestion}
              </Text>
              <Text style={styles.sheetDetailMeta}>
                Cross-interest · From {crossInterestSuggestion.sourceInterestName}
              </Text>
              <Text style={styles.sheetDetailBody}>
                {crossInterestSuggestion.relevance}
              </Text>
              <View style={styles.sheetActions}>
                <Pressable
                  style={styles.sheetSecondaryButton}
                  onPress={() => onAddCrossInterest(crossInterestSuggestion, 'current')}
                  disabled={Boolean(submitting)}
                >
                  <Text style={styles.sheetSecondaryButtonText}>
                    {currentInterestName ? `Create in ${currentInterestName}` : 'Create here'}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.sheetPrimaryButton,
                    submitting && styles.sheetPrimaryButtonDisabled,
                  ]}
                  onPress={() => onAddCrossInterest(crossInterestSuggestion, 'source')}
                  disabled={Boolean(submitting)}
                >
                  <Text style={styles.sheetPrimaryButtonText}>
                    {submitting ? 'Creating…' : `Create in ${crossInterestSuggestion.sourceInterestName}`}
                  </Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function InsertBetweenStepsSheet({
  visible,
  title,
  onChangeTitle,
  onClose,
  onSubmit,
  submitting,
  afterTitle,
  beforeTitle,
}: {
  visible: boolean;
  title: string;
  onChangeTitle: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
  afterTitle: string | null;
  beforeTitle: string | null;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheetCard} onPress={() => undefined}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Add a step here</Text>
          <Text style={styles.sheetBody}>
            {beforeTitle
              ? `This step will be inserted between "${afterTitle ?? 'this step'}" and "${beforeTitle}".`
              : `This step will be inserted after "${afterTitle ?? 'this step'}".`}
          </Text>
          <TextInput
            value={title}
            onChangeText={onChangeTitle}
            placeholder="Name the step you want to add"
            placeholderTextColor={IOS_REGISTER.labelTertiary}
            style={styles.sheetInput}
            autoFocus
          />
          <View style={styles.sheetActions}>
            <Pressable style={styles.sheetSecondaryButton} onPress={onClose}>
              <Text style={styles.sheetSecondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.sheetPrimaryButton,
                (!title.trim() || submitting) && styles.sheetPrimaryButtonDisabled,
              ]}
              onPress={onSubmit}
              disabled={!title.trim() || submitting}
            >
              <Text style={styles.sheetPrimaryButtonText}>
                {submitting ? 'Adding…' : 'Add between steps'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function EmptyWeekInline() {
  const universalPlus = useUniversalPlus();
  return (
    <View style={styles.emptyInline}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="leaf-outline" size={22} color={IOS_REGISTER.labelTertiary} />
      </View>
      <Text style={styles.emptyTitle}>No nearby steps</Text>
      <Text style={styles.emptyBody}>
        Add a step to start building your season run.
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

const CARD_WIDTH = 150;
// Compact mode card width — picked so 5–6 cards fit on a 393pt iPhone
// width with the 16pt gap plus the leading inset.
const COMPACT_CARD_WIDTH = 100;
const CARD_GAP = 16;
const NOW_BAR_WIDTH = 52;

const COUNT_PILL_TONE: Record<
  CountPillTone,
  { wrap: object; dot: object; text: object }
> = {
  done: {
    wrap: { backgroundColor: 'rgba(52, 199, 89, 0.12)' },
    dot: { backgroundColor: '#34C759' },
    text: { color: '#2E7D32' },
  },
  in: {
    wrap: { backgroundColor: 'rgba(255, 149, 0, 0.14)' },
    dot: { backgroundColor: '#FF9500' },
    text: { color: '#B45F06' },
  },
  planned: {
    wrap: { backgroundColor: 'rgba(142, 142, 147, 0.14)' },
    dot: { backgroundColor: IOS_REGISTER.labelTertiary },
    text: { color: IOS_REGISTER.labelSecondary },
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 0,
  },
  contentContainer: {
    paddingBottom: 124,
  },
  verbEyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelSecondary,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  suggestedWrap: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 112,
    gap: 5,
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
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(175, 82, 222, 0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(175, 82, 222, 0.18)',
  },
  suggestedIcon: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(175, 82, 222, 0.12)',
  },
  suggestedIconBlueprint: {
    backgroundColor: 'rgba(35, 103, 209, 0.12)',
  },
  suggestedIconInbox: {
    backgroundColor: 'rgba(10, 126, 62, 0.12)',
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
  suggestedSource: {
    marginTop: 1,
    fontSize: 10.5,
    fontWeight: '700',
    color: '#7B3FB0',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  suggestedMeta: {
    marginTop: 1,
    fontSize: 10.5,
    color: IOS_REGISTER.labelSecondary,
  },
  titleRow: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
    color: IOS_REGISTER.label,
  },
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
  },
  countDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  countText: {
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  sequenceWrap: {
    position: 'relative',
    minHeight: 684,
    marginBottom: 6,
    marginTop: -6,
    paddingTop: 66,
  },
  capabilityTeaser: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(120, 120, 130, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(120, 120, 130, 0.14)',
  },
  capabilityTeaserEyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelTertiary,
    marginBottom: 6,
  },
  capabilityTeaserText: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    lineHeight: 17,
  },
  contextCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: -2,
    zIndex: 18,
    paddingHorizontal: 10,
    paddingTop: 7,
    paddingBottom: 7,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  contextCardText: {
    fontSize: 12.5,
    lineHeight: 17,
    color: IOS_REGISTER.labelSecondary,
    fontStyle: 'italic',
    maxWidth: '100%',
  },
  contextCardTextStrong: {
    color: IOS_REGISTER.label,
    fontWeight: '700',
    fontStyle: 'italic',
  },
  contextCardFooter: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  contextCardMeta: {
    fontSize: 9.5,
    color: IOS_REGISTER.labelTertiary,
    letterSpacing: 0.2,
  },
  contextCardCounts: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    marginRight: 68,
    flexShrink: 0,
  },
  cardCarousel: {
    paddingTop: 0,
    paddingBottom: 188,
    gap: CARD_GAP,
  },
  bottomPromptOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -20,
    zIndex: 16,
  },
  nowBarWrap: {
    position: 'absolute',
    top: 56,
    bottom: 32,
    width: NOW_BAR_WIDTH,
    borderRadius: NOW_BAR_WIDTH / 2,
    backgroundColor: 'rgba(210, 123, 84, 0.14)',
    alignItems: 'center',
    zIndex: 30,
    pointerEvents: 'none',
  },
  nowPill: {
    width: 52,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#D27B54',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nowPillText: {
    fontSize: 11,
    lineHeight: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  nowBar: {
    marginTop: 6,
    width: 4,
    flex: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(210, 123, 84, 0.22)',
  },
  nowDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 4,
    backgroundColor: '#D27B54',
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
  completeOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#22C55E',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    zIndex: 11,
  },
  completeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: '#22C55E',
  },
  completeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  insertButton: {
    position: 'absolute',
    right: -CARD_GAP / 2 - 14,
    top: '50%',
    marginTop: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(210, 123, 84, 0.28)',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    zIndex: 6,
  },
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
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 10,
  },
  sheetHandle: {
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(60, 60, 67, 0.18)',
    alignSelf: 'center',
    marginBottom: 6,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  sheetBody: {
    fontSize: 13.5,
    lineHeight: 19,
    color: IOS_REGISTER.labelSecondary,
  },
  sheetInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: IOS_REGISTER.label,
    backgroundColor: '#FFFFFF',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  sheetSecondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_REGISTER.fillPill,
  },
  sheetSecondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_REGISTER.labelSecondary,
  },
  sheetPrimaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: IOS_REGISTER.accentUserAction,
  },
  sheetPrimaryButtonDisabled: {
    opacity: 0.55,
  },
  sheetPrimaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sheetDetailTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: IOS_REGISTER.label,
    letterSpacing: -0.25,
  },
  sheetDetailMeta: {
    fontSize: 12.5,
    lineHeight: 17,
    color: IOS_REGISTER.labelSecondary,
  },
  sheetDetailBody: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_REGISTER.label,
  },
});
