/**
 * L1 — one card focused, peeks left and right, horizontal swipe.
 *
 * Frame 1/5. The full step card: pre-title, title, meta row, Plan/Do/Reflect
 * phase tabs (presentational — actual tab routing happens elsewhere in the
 * Practice tab), what/how body, capability chips, FROM provenance footer,
 * cohort avatars. Step counter ("Step 27 of 41") sits in the parent header.
 *
 * Pinch out → L2. Tap the right-rail pill → jump.
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { resolveDoTabInterestKind } from '@/lib/interest-config';
import { StepDetailContent } from '@/components/step/StepDetailContent';
import { PickerListSheet } from './PickerListSheet';
import type { StepStatus, TimelineDataset, TimelineStep } from './types';

// The embedded StepDetailContent loads its own step record async, so on first
// render it has no status and defaults to the Plan tab — then snaps to the real
// tab once data arrives. L1 already knows the step's phase, so we pass it down
// as initialTab to land the card (and the peek neighbours, mid-swipe) on the
// correct tab from the first frame. Mirrors StepDetailContent's getDefaultTab.
function tabForStepStatus(status: StepStatus): 'plan' | 'act' | 'review' {
  switch (status) {
    case 'do':
      return 'act';
    case 'reflect':
    case 'reflected':
    case 'done':
      return 'review';
    case 'plan':
    default:
      return 'plan';
  }
}

const SERIF_FAMILY = fontFamily.serif;

const NOW_COLOR = '#FF6B5A';

interface L1StepViewProps {
  dataset: TimelineDataset;
  step: TimelineStep;
  /**
   * When provided, the L1 card becomes pressable — tap → push to the full
   * step detail surface (existing `<StepDetailContent />` at /step/[id]).
   * The canvas itself stays mounted; back-gesture from detail returns here
   * with zoom level preserved. Omitted in preview routes where no real
   * step record exists.
   */
  onOpenStepDetail?: (stepId: string) => void;
  /**
   * When true, L1 embeds the full <StepDetailContent /> inline — same
   * Plan/Do/Reflect/Discuss tabs ("taskbar") + rich body content as the
   * /step/[id] route. The pinch-out gesture takes the user back to L2;
   * no extra navigation push needed. Requires `step.id` to be a real
   * Supabase row UUID. Sample-data routes leave this false and get the
   * slim preview card.
   */
  embedFullDetail?: boolean;
  /**
   * L1 horizontal swipe (Screen 07 canonical: "Past on the left, future
   * on the right. Swipe to traverse"). Called on threshold-met left/right
   * pan to switch the focused step. The canvas computes neighbors from
   * the season's flat step list.
   */
  onSwipePrev?: () => void;
  onSwipeNext?: () => void;
  /**
   * Neighbor steps — drive the ghost cards that slide in from the left
   * (prev) and right (next) along with the user's swipe gesture, giving
   * the pager illusion. Null when at the first/last step.
   */
  prevStep?: TimelineStep | null;
  nextStep?: TimelineStep | null;
  /**
   * Forwarded to the inner step detail's scroll so the canvas's chrome
   * row can animate hide/show on scroll.
   */
  onScroll?: React.ComponentProps<typeof StepDetailContent>['onScroll'];
  /**
   * Called after the embedded step detail deletes its step. The embedded
   * detail has no own route to pop, so without this the inner router.back()
   * would exit the canvas entirely (re-landing at its default zoom level).
   * The canvas passes a handler that zooms out one level instead.
   */
  onStepDeleted?: () => void;
  /**
   * Ordered flat list of sibling steps (same list the canvas swipes
   * through). Drives the "Step N of M ⌄" switcher chip + its jump sheet.
   * Omit on preview routes with no real steps.
   */
  allSteps?: TimelineStep[];
  /** Jump to an arbitrary sibling step from the switcher sheet. */
  onJumpToStep?: (stepId: string) => void;
  /**
   * Suppress the in-card "Step N of M ⌄" switcher chip. Set true when an
   * ancestor task bar (StepTaskBar) already owns step selection, so the
   * chooser isn't duplicated.
   */
  hideStepSwitcher?: boolean;
  /**
   * Bottom padding handed to the embedded step detail so its capture
   * composer and last rows clear the canvas's floating tab bar. Only
   * meaningful in embedFullDetail mode.
   */
  bottomInset?: number;
  /**
   * Opens the add-step sheet. When the arc has no active step
   * (dataset.nowStepId == null) the pager grows a ghost "plan your next
   * step" card past the last real card — NOW lives on that gap, and this
   * is its CTA. Omit to suppress the ghost (preview routes).
   */
  onAddStep?: () => void;
}

const PHASES = ['Plan', 'Do', 'Reflect', 'Discuss'] as const;
type PreviewPhase = 'Plan' | 'Do' | 'Reflect' | 'Review' | 'Discuss';

// Swipe threshold (Reanimated worklet uses these constants).
const SWIPE_PX_THRESHOLD = 60;
const SWIPE_VELOCITY_THRESHOLD = 600;
const SWIPE_RUBBER_FACTOR = 1; // drag follows finger 1:1 so the motion reads
const SCREEN_WIDTH = Dimensions.get('window').width;
const WEB_L1_CARD_WIDTH_RATIO = 0.33;
const WEB_L1_CARD_WIDTH = '33%';
const WEB_L1_CARD_LEFT = '33.5%';
const WEB_L1_CARD_GUTTER = 20;

// How many cards to keep mounted on each side of the focused one. Two — not one.
// At rest the lane shows three cards (prev · focused · next), so a single buffer
// looks sufficient. But a drag slides the whole lane up to a full stride before
// the gesture resolves, which uncovers the `focused ± 2` slot. With only one card
// buffered that slot is unmounted, so the incoming step reads as a gray gap until
// release re-centres the window and mounts it. Buffering two keeps the next-out
// card mounted (StepDetailContent already loaded) so it slides into view from the
// moment the scroll begins, instead of popping in on release.
const PAGER_WINDOW = 2;

/**
 * The window of sibling steps to render, each tagged with its absolute index in
 * the full list. Positioning by absolute index (not by prev/focused/next role)
 * is what lets a card keep its identity when focus moves onto it.
 */
function buildWindow(
  steps: TimelineStep[],
  focusedIndex: number,
): { step: TimelineStep; index: number }[] {
  const out: { step: TimelineStep; index: number }[] = [];
  for (let i = focusedIndex - PAGER_WINDOW; i <= focusedIndex + PAGER_WINDOW; i++) {
    if (i >= 0 && i < steps.length) out.push({ step: steps[i], index: i });
  }
  return out;
}

/**
 * One card in the L1 pager lane. Its rest position is `cardBase` (its absolute
 * index × stride); the shared `scrollX` slides the whole lane. Because cardBase
 * is keyed to the step's identity (not its role), React reuses this instance
 * when the step transitions next → focused, so StepDetailContent never remounts.
 */
function PagerCard({
  scrollX,
  cardBase,
  isFocused,
  isNow,
  forceInteractive,
  children,
}: {
  scrollX: SharedValue<number>;
  cardBase: number;
  isFocused: boolean;
  isNow?: boolean;
  /**
   * Unfocused cards normally swallow no touches (they overlap the focused
   * card mid-swipe). The ghost "plan next step" card sits beyond the last
   * real card with nothing behind it, so its CTA stays tappable even while
   * it's only peeking (web shows neighbours at rest).
   */
  forceInteractive?: boolean;
  children: React.ReactNode;
}) {
  const style = useAnimatedStyle(
    () => ({ transform: [{ translateX: cardBase - scrollX.value }] }),
    [cardBase],
  );
  return (
    <Animated.View
      style={[
        styles.pagerCard,
        isFocused && styles.pagerCardFocused,
        isNow && styles.pagerCardNow,
        style,
      ]}
      pointerEvents={isFocused || forceInteractive ? 'auto' : 'none'}
    >
      {isNow ? (
        <View style={styles.pagerNowRail} pointerEvents="none">
          <Text style={styles.pagerNowRailText}>NOW</Text>
        </View>
      ) : null}
      {children}
    </Animated.View>
  );
}

export function L1StepView({
  dataset,
  step,
  onOpenStepDetail,
  embedFullDetail,
  onSwipePrev,
  onSwipeNext,
  prevStep,
  nextStep,
  onScroll,
  onStepDeleted,
  allSteps,
  onJumpToStep,
  hideStepSwitcher,
  bottomInset,
  onAddStep,
}: L1StepViewProps) {
  const hasPrev = prevStep != null;
  const hasNext = nextStep != null;
  const [stepPickerOpen, setStepPickerOpen] = useState(false);
  const stepOrdinal =
    allSteps && allSteps.length > 0
      ? allSteps.findIndex((s) => s.id === step.id) + 1
      : 0;
  const showStepSwitcher =
    !hideStepSwitcher &&
    Boolean(onJumpToStep) &&
    (allSteps?.length ?? 0) > 1 &&
    stepOrdinal > 0;
  // The merged Step view's relative DONE/NOW/NEXT indicator lives in the
  // canvas-level NowFloat chrome (mockup #38 `.nowfloat`), not on the card —
  // the card stays clean. isNowStep only drives the slim preview's accent bar.
  // Keyed to nowStepId (canonical NOW), not focusStepId (landing card): a
  // settled step can be the landing card but must never wear the NOW accent.
  const isNowStep = step.id === dataset.nowStepId;
  const [hostWidth, setHostWidth] = useState(SCREEN_WIDTH);
  const swipeStridePx =
    Platform.OS === 'web'
      ? hostWidth * WEB_L1_CARD_WIDTH_RATIO + WEB_L1_CARD_GUTTER
      : SCREEN_WIDTH;
  // Windowed pager geometry. Cards are positioned by their ABSOLUTE index in
  // the sibling list (cardBase = index × stride) inside a lane scrolled by
  // `scrollX`. Because a card's base position never depends on which step is
  // focused, the card that was the off-screen "next" neighbour keeps the same
  // React key + animated position when it becomes focused — React reuses the
  // instance instead of unmounting the ghost and mounting a fresh
  // StepDetailContent. That remount was the "mini flash" on landing.
  const scrollX = useSharedValue(0);
  const dragStartX = useSharedValue(0);
  const passedThreshold = useSharedValue(false);

  const steps = allSteps ?? [];
  const focusedIndex = steps.findIndex((s) => s.id === step.id);
  const useList = focusedIndex >= 0;
  const lastIndex = steps.length - 1;

  // NOW past the end. When the arc has no active step (nowStepId == null),
  // every real card is settled, so the pager grows a ghost "plan your next
  // step" card one stride past the last card. The red NOW rail rides the
  // ghost — the gap after finished work — never a settled card. The ghost is
  // swipeable like a real card; focus on it is local state because the parent
  // only tracks real step ids.
  const hasGhost = Boolean(
    embedFullDetail && useList && steps.length > 0 && dataset.nowStepId == null && onAddStep,
  );
  const ghostIndex = steps.length;
  const [ghostFocused, setGhostFocused] = useState(false);
  // An external focus jump (picker / task bar) exits the ghost.
  const prevFocusedIndexRef = useRef(focusedIndex);
  if (prevFocusedIndexRef.current !== focusedIndex) {
    prevFocusedIndexRef.current = focusedIndex;
    if (ghostFocused) setGhostFocused(false);
  }
  const onGhost = hasGhost && ghostFocused;

  const canPrev = onGhost ? true : useList ? focusedIndex > 0 : hasPrev;
  const canNext = onGhost
    ? false
    : useList
      ? focusedIndex < lastIndex || (hasGhost && focusedIndex === lastIndex)
      : hasNext;

  // Keep scrollX pinned to the focused card's rest position (the ghost's slot
  // when it holds focus). On a committed swipe the gesture has already
  // animated scrollX to exactly this value, so this write is a no-op (no
  // jump); on an external jump (picker / task bar) or a width change (web
  // resize) it snaps the lane to re-center instantly.
  const pinIndex = onGhost ? ghostIndex : focusedIndex;
  const lastPinRef = useRef<number | null>(null);
  const lastStrideRef = useRef<number | null>(null);
  if (
    embedFullDetail &&
    useList &&
    (lastPinRef.current !== pinIndex || lastStrideRef.current !== swipeStridePx)
  ) {
    scrollX.value = pinIndex * swipeStridePx;
    lastPinRef.current = pinIndex;
    lastStrideRef.current = swipeStridePx;
  }

  const handleHostLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (width > 0) setHostWidth(width);
  }, []);

  const fireSwipe = useCallback(
    (direction: 'prev' | 'next') => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      // Ghost transitions are local — the parent's focused step id doesn't
      // change when the user swipes onto or off the plan-next ghost.
      if (direction === 'next' && hasGhost && !ghostFocused && focusedIndex === lastIndex) {
        setGhostFocused(true);
        return;
      }
      if (direction === 'prev' && ghostFocused) {
        setGhostFocused(false);
        return;
      }
      if (direction === 'prev') onSwipePrev?.();
      else onSwipeNext?.();
    },
    [onSwipePrev, onSwipeNext, hasGhost, ghostFocused, focusedIndex, lastIndex],
  );

  const fireLightHaptic = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
  }, []);

  // Horizontal pan that only activates after 15px of x movement so vertical
  // scroll inside the embedded StepDetailContent still works untouched.
  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-12, 12])
    .onStart(() => {
      'worklet';
      dragStartX.value = scrollX.value;
      passedThreshold.value = false;
      runOnJS(fireLightHaptic)();
    })
    .onUpdate((e) => {
      'worklet';
      // Lane follows the finger 1:1 — scroll grows as you drag left (toward next).
      scrollX.value = dragStartX.value - e.translationX * SWIPE_RUBBER_FACTOR;
      // Threshold-cross light haptic — once per gesture.
      const crossed = Math.abs(e.translationX) > SWIPE_PX_THRESHOLD;
      if (crossed && !passedThreshold.value) {
        passedThreshold.value = true;
        runOnJS(fireLightHaptic)();
      } else if (!crossed && passedThreshold.value) {
        passedThreshold.value = false;
      }
    })
    .onEnd((e) => {
      'worklet';
      const enoughDistance = Math.abs(e.translationX) > SWIPE_PX_THRESHOLD;
      const enoughVelocity = Math.abs(e.velocityX) > SWIPE_VELOCITY_THRESHOLD;
      if (!enoughDistance && !enoughVelocity) {
        // Cancelled — spring back to the current card's rest position.
        scrollX.value = withSpring(dragStartX.value, { damping: 18, stiffness: 220 });
        return;
      }
      const goPrev = e.translationX > 0;
      if ((goPrev && !canPrev) || (!goPrev && !canNext)) {
        scrollX.value = withSpring(dragStartX.value, { damping: 18, stiffness: 220 });
        return;
      }
      const direction = goPrev ? 'prev' : 'next';
      // Settle the neighbour into the centre, then commit the focus change.
      // scrollX lands exactly on the next card's rest position, so when the
      // parent swaps in the new focused step the rest-pin guard above is a
      // no-op and the reused card simply stays centred — no remount, no flash.
      const target = dragStartX.value + (goPrev ? -swipeStridePx : swipeStridePx);
      scrollX.value = withTiming(target, { duration: 220 }, (finished) => {
        if (finished) {
          runOnJS(fireSwipe)(direction);
        }
      });
    });

  if (embedFullDetail) {
    return (
      <View style={styles.embedHost} onLayout={handleHostLayout}>
        {showStepSwitcher ? (
          <View style={styles.switcherBar}>
            <Pressable
              style={({ pressed }) => [styles.switcherChip, pressed && styles.switcherChipPressed]}
              onPress={() => setStepPickerOpen(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Step ${stepOrdinal} of ${allSteps?.length ?? 0}. Jump to another step`}
            >
              <Text style={styles.switcherChipText}>
                Step {stepOrdinal} of {allSteps?.length ?? 0}
              </Text>
              <Ionicons name="chevron-down" size={13} color={IOS_REGISTER.labelSecondary} />
            </Pressable>
          </View>
        ) : null}
        <GestureDetector gesture={swipeGesture}>
          <View style={styles.embedGestureLayer}>
            {(useList ? buildWindow(steps, pinIndex) : [{ step, index: 0 }]).map(
              ({ step: cardStep, index }) => {
                const isFocused = !onGhost && cardStep.id === step.id;
                return (
                  <PagerCard
                    key={cardStep.id}
                    scrollX={scrollX}
                    cardBase={index * swipeStridePx}
                    isFocused={isFocused}
                    isNow={cardStep.id === dataset.nowStepId}
                  >
                    <EmbeddedStepCard
                      step={cardStep}
                      onScroll={isFocused ? onScroll : undefined}
                      onStepDeleted={isFocused ? onStepDeleted : undefined}
                      bottomInset={bottomInset}
                    />
                  </PagerCard>
                );
              },
            )}
            {hasGhost && ghostIndex - pinIndex <= PAGER_WINDOW ? (
              <PagerCard
                key="ghost-plan-next"
                scrollX={scrollX}
                cardBase={ghostIndex * swipeStridePx}
                isFocused={onGhost}
                isNow
                forceInteractive
              >
                <PlanNextStepCard
                  interestLabel={dataset.interest.label}
                  onAddStep={onAddStep!}
                />
              </PagerCard>
            ) : null}
          </View>
        </GestureDetector>
        {showStepSwitcher && allSteps ? (
          <PickerListSheet<TimelineStep>
            visible={stepPickerOpen}
            title="Jump to step"
            items={allSteps}
            keyExtractor={(s) => s.id}
            isSelected={(s) => s.id === step.id}
            onSelect={(s) => {
              setStepPickerOpen(false);
              if (s.id !== step.id) onJumpToStep?.(s.id);
            }}
            onClose={() => setStepPickerOpen(false)}
            renderRow={(s) => {
              const ordinal = allSteps.findIndex((x) => x.id === s.id) + 1;
              return (
                <>
                  <Text style={styles.pickerPrimary} numberOfLines={1}>
                    {ordinal}. {s.title}
                  </Text>
                  {s.preTitle ? (
                    <Text style={styles.pickerSecondary} numberOfLines={1}>
                      {s.preTitle}
                    </Text>
                  ) : null}
                </>
              );
            }}
          />
        ) : null}
      </View>
    );
  }

  const isNursingDataset =
    resolveDoTabInterestKind({
      interestSlug: dataset.interest.slug,
      interestName: dataset.interest.label,
      interestId: dataset.interest.id,
    }) === 'nursing';
  const previewPhases: PreviewPhase[] = isNursingDataset
    ? ['Plan', 'Do', 'Review']
    : [...PHASES];
  const activePhase: PreviewPhase =
    step.status === 'plan' ? 'Plan' : step.status === 'do' ? 'Do' : isNursingDataset ? 'Review' : 'Reflect';

  const handleOpen = onOpenStepDetail
    ? () => onOpenStepDetail(step.id)
    : undefined;

  return (
    <View style={styles.slimHost}>
      {hasPrev ? <View style={styles.peekLeft} pointerEvents="none" /> : null}
      {hasNext ? <View style={styles.peekRight} pointerEvents="none" /> : null}
      <GestureDetector gesture={swipeGesture}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={styles.card}
        onPress={handleOpen}
        disabled={!handleOpen}
        accessibilityRole={handleOpen ? 'button' : undefined}
        accessibilityLabel={handleOpen ? `Open ${step.title}` : undefined}
      >
        {isNowStep ? <View style={styles.nowBar} /> : null}

        {handleOpen ? (
          <View style={styles.openHint}>
            <Text style={styles.openHintText}>OPEN</Text>
            <Ionicons
              name="chevron-forward"
              size={12}
              color={IOS_REGISTER.accentUserAction}
            />
          </View>
        ) : null}

        {step.peerQuote ? <PeerQuoteBlock quote={step.peerQuote} /> : null}
        {step.subStep ? <SessionStrap step={step} /> : null}

        {step.preTitle ? (
          <Text style={styles.eyebrow}>{step.preTitle}</Text>
        ) : null}
        <Text style={styles.title}>{step.title}</Text>

        {(step.metaLeft || step.metaRight) ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{step.metaLeft}</Text>
            {step.metaRight ? <Text style={styles.metaText}>{step.metaRight}</Text> : null}
          </View>
        ) : null}

        <View style={styles.phaseRow}>
          {previewPhases.map((p) => {
            const active = p === activePhase;
            const count =
              p === 'Discuss' && (step.discussCount ?? 0) > 0 ? step.discussCount : null;
            return (
              <View key={p} style={styles.phaseTab}>
                <View style={styles.phaseLabelRow}>
                  <Text style={[styles.phaseLabel, active && styles.phaseLabelActive]}>{p}</Text>
                  {count != null ? (
                    <View style={styles.phaseBadge}>
                      <Text style={styles.phaseBadgeText}>{count}</Text>
                    </View>
                  ) : null}
                </View>
                {active ? <View style={styles.phaseUnderline} /> : null}
              </View>
            );
          })}
        </View>

        {step.whatBody ? (
          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>WHAT WILL YOU DO?</Text>
            <Text style={styles.bodyText}>{step.whatBody}</Text>
          </View>
        ) : null}

        {step.howItems?.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>HOW WILL YOU DO IT?</Text>
            {step.howItems.map((item, idx) => (
              <View key={idx} style={styles.howRow}>
                <View style={[styles.check, item.checked && styles.checkOn]}>
                  {item.checked ? (
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.howLabel,
                    item.checked && styles.howLabelChecked,
                  ]}
                >
                  {item.label}
                </Text>
              </View>
            ))}
            <View style={styles.libraryUnderChecklist}>
              <Ionicons
                name="library-outline"
                size={13}
                color={IOS_REGISTER.labelSecondary}
              />
              <Text style={styles.libraryUnderChecklistText}>
                {step.linkedResourceCount
                  ? `${step.linkedResourceCount} library resource${step.linkedResourceCount === 1 ? '' : 's'} linked`
                  : 'Add from library'}
              </Text>
              <Ionicons
                name="add-circle-outline"
                size={14}
                color={IOS_REGISTER.accentUserAction}
              />
            </View>
          </View>
        ) : null}

        {step.capabilities?.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>CAPABILITIES</Text>
            <View style={styles.capabilityRow}>
              {step.capabilities.map((cap) => (
                <View
                  key={cap.id}
                  style={[styles.capChip, { backgroundColor: withAlpha(cap.color, 0.16) }]}
                >
                  <Text style={[styles.capText, { color: darken(cap.color) }]}>{cap.label}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {step.from ? (
          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>FROM</Text>
            <View style={styles.fromRow}>
              <Ionicons name="git-network-outline" size={13} color={IOS_REGISTER.labelSecondary} />
              <Text style={styles.fromText} numberOfLines={2}>
                <Text style={styles.fromSource}>{step.from.source}</Text>
                {step.from.suggestedBy ? (
                  <Text style={styles.fromSuggested}>
                    {`  ·  suggested by ${step.from.suggestedBy}`}
                  </Text>
                ) : null}
              </Text>
            </View>
          </View>
        ) : null}
        </Pressable>
      </ScrollView>
      </GestureDetector>
    </View>
  );
}

function EmbeddedStepCard({
  step,
  onScroll,
  onStepDeleted,
  bottomInset,
}: {
  step: TimelineStep;
  onScroll?: React.ComponentProps<typeof StepDetailContent>['onScroll'];
  onStepDeleted?: () => void;
  bottomInset?: number;
}) {
  return (
    <>
      {step.peerQuote || step.subStep ? (
        <View style={styles.embedChrome}>
          {step.peerQuote ? <PeerQuoteBlock quote={step.peerQuote} /> : null}
          {step.subStep ? <SessionStrap step={step} /> : null}
        </View>
      ) : null}
      <View style={styles.embedDetailHost}>
        {/* StepDetailContent renders its own •••-menu button (with the
            Delete action) via StepCard's floating menu. A second dead
            ellipsis here used to overlay and swallow that tap. */}
        <StepDetailContent
          stepId={step.id}
          initialTab={tabForStepStatus(step.status)}
          onScroll={onScroll}
          hideStatePill
          onDeleted={onStepDeleted}
          bottomInset={bottomInset}
        />
      </View>
    </>
  );
}

/**
 * The ghost card one stride past the last real card, shown only when the arc
 * has no active step (dataset.nowStepId == null). It IS the timeline's NOW in
 * that state: everything behind it is settled, so the honest thing at the
 * cursor is an invitation to plan the next step — not a red flag on work
 * that's already been reviewed.
 */
function PlanNextStepCard({
  interestLabel,
  onAddStep,
}: {
  interestLabel: string;
  onAddStep: () => void;
}) {
  return (
    <View style={styles.ghostHost}>
      <View style={styles.ghostIconWrap}>
        <Ionicons name="flag-outline" size={26} color={NOW_COLOR} />
      </View>
      <Text style={styles.ghostTitle}>All settled here</Text>
      <Text style={styles.ghostBody}>
        Every {interestLabel} step behind this point is done and reviewed.
        Your next rep starts here.
      </Text>
      <Pressable
        style={({ pressed }) => [styles.ghostCta, pressed && styles.ghostCtaPressed]}
        onPress={onAddStep}
        accessibilityRole="button"
        accessibilityLabel="Plan your next step"
      >
        <Ionicons name="add" size={16} color="#FFFFFF" />
        <Text style={styles.ghostCtaText}>Plan your next step</Text>
      </Pressable>
    </View>
  );
}

function PeerQuoteBlock({ quote }: { quote: NonNullable<TimelineStep['peerQuote']> }) {
  return (
    <View style={styles.peerQuoteBlock}>
      <View style={styles.peerQuoteHeader}>
        {quote.avatarInitials ? (
          <View
            style={[
              styles.peerAvatar,
              { backgroundColor: quote.avatarColor ?? IOS_REGISTER.labelSecondary },
            ]}
          >
            <Text style={styles.peerAvatarText}>{quote.avatarInitials}</Text>
          </View>
        ) : null}
        <Text style={styles.peerQuoteAuthor}>
          {quote.author.toUpperCase()}
          {'  ·  '}
          <Text style={styles.peerQuoteWhen}>{quote.when.toUpperCase()}</Text>
        </Text>
      </View>
      <Text style={styles.peerQuoteBody}>&ldquo;{quote.body}&rdquo;</Text>
    </View>
  );
}

function SessionStrap({ step }: { step: TimelineStep }) {
  if (!step.subStep) return null;
  return (
    <Text style={styles.sessionStrap}>
      SUB-STEP {step.subStep.current} OF {step.subStep.total}
      {step.subStep.label ? `  ·  ${step.subStep.label.toUpperCase()}` : ''}
      {step.status === 'do' ? '  ·  ' : ''}
      {step.status === 'do' ? <Text style={styles.inPlay}>● in play</Text> : null}
    </Text>
  );
}

function withAlpha(hex: string, alpha: number): string {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function darken(hex: string): string {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return hex;
  const r = Math.round(parseInt(m[1], 16) * 0.65);
  const g = Math.round(parseInt(m[2], 16) * 0.65);
  const b = Math.round(parseInt(m[3], 16) * 0.65);
  return `rgb(${r}, ${g}, ${b})`;
}

// Narrow gutter so the card reads as wide; the prev/next peeks fill the
// gutter flush to the screen edges (mockup #38 "make the card wider").
const PEEK_WIDTH = 16;
const CARD_INSET = 14;

const styles = StyleSheet.create({
  embedHost: {
    flex: 1,
    position: 'relative',
    // A touch darker than the global groundBg (#F2F2F7) so the white card
    // reads as a distinct, lifted surface rather than blending into the ground.
    backgroundColor: '#E7E7EC',
  },
  embedChrome: {
    paddingHorizontal: 22,
    paddingTop: 0,
    paddingBottom: 4,
  },
  embedGestureLayer: {
    flex: 1,
    position: 'relative',
  },
  embedDetailHost: { flex: 1, position: 'relative' },
  // Every card in the pager lane shares this geometry. They're absolutely
  // positioned and slide as one strip via each card's translateX, so the
  // focused card and its peeking neighbours are laid out identically — the
  // only difference is zIndex + pointer events (see pagerCardFocused).
  pagerCard: {
    position: 'absolute',
    top: 10,
    bottom: 10,
    left: CARD_INSET,
    right: CARD_INSET,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
    zIndex: 2,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.16,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 9 },
      web: {
        left: WEB_L1_CARD_LEFT,
        right: 'auto',
        width: WEB_L1_CARD_WIDTH,
        boxShadow:
          '0 1px 2px rgba(0,0,0,0.06), 0 18px 40px -16px rgba(0,0,0,0.28), 0 6px 14px -6px rgba(0,0,0,0.12)',
        // A mouse-drag to swipe would otherwise select the card text it passes
        // over (blue highlight). Suppress selection so dragging only swipes.
        userSelect: 'none',
        WebkitUserSelect: 'none',
      } as any,
      default: {},
    }),
  },
  pagerCardFocused: {
    zIndex: 3,
  },
  // The NOW step gets a bold left rail + corner badge so the card you should
  // act on next reads as "now" at a glance, even amid the swipeable pager.
  pagerCardNow: {
    borderLeftWidth: 5,
    borderLeftColor: NOW_COLOR,
  },
  pagerNowRail: {
    position: 'absolute',
    top: 0,
    left: 0,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderBottomRightRadius: 9,
    backgroundColor: NOW_COLOR,
    zIndex: 4,
  },
  pagerNowRailText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#FFFFFF',
  },
  ghostHost: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  ghostIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 107, 90, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  ghostTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: IOS_REGISTER.label,
    marginBottom: 6,
  },
  ghostBody: {
    fontSize: 14,
    lineHeight: 19,
    color: IOS_REGISTER.labelSecondary,
    textAlign: 'center',
    marginBottom: 18,
  },
  ghostCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: IOS_REGISTER.accentUserAction,
  },
  ghostCtaPressed: {
    opacity: 0.7,
  },
  ghostCtaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // Adjacent-step silhouettes — edge + corner + shadow only, no content.
  // Sit behind the main card; the user reads them as "more here".
  // Solid card-bg colour + hairline + shadow so they read against the
  // gray canvas — opacity-blending against groundBg made them vanish.
  peekLeft: {
    position: 'absolute',
    left: 0,
    top: 20,
    bottom: 20,
    width: PEEK_WIDTH,
    backgroundColor: IOS_REGISTER.cardBg,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    zIndex: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 2, height: 2 },
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  peekRight: {
    position: 'absolute',
    right: 0,
    top: 20,
    bottom: 20,
    width: PEEK_WIDTH,
    backgroundColor: IOS_REGISTER.cardBg,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    zIndex: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: -2, height: 2 },
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  slimHost: { flex: 1, position: 'relative' },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: CARD_INSET,
    paddingBottom: 120,
  },
  card: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 16,
    padding: 18,
    paddingLeft: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    position: 'relative',
    overflow: 'hidden',
  },
  nowBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: NOW_COLOR,
  },
  verbEyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelSecondary,
    marginBottom: 12,
  },
  peerQuoteBlock: {
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_REGISTER.separator,
  },
  peerQuoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  peerAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peerAvatarText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  peerQuoteAuthor: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelSecondary,
  },
  peerQuoteWhen: {
    fontWeight: '500',
    color: IOS_REGISTER.labelTertiary,
  },
  peerQuoteBody: {
    fontFamily: SERIF_FAMILY,
    fontStyle: 'italic',
    fontSize: 15,
    lineHeight: 21,
    color: IOS_REGISTER.label,
  },
  sessionStrap: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelSecondary,
    marginBottom: 6,
  },
  inPlay: {
    color: '#34C759',
    fontWeight: '700',
  },
  phaseLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  phaseBadge: {
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#AF52DE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  openHint: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 122, 255, 0.10)',
  },
  openHintText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: IOS_REGISTER.accentUserAction,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: IOS_REGISTER.accentUserAction,
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 28,
    letterSpacing: -0.5,
    color: IOS_REGISTER.label,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: 12,
    rowGap: 2,
    marginBottom: 16,
  },
  metaText: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
  },
  phaseRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_REGISTER.separator,
  },
  phaseTab: {
    paddingBottom: 8,
  },
  phaseLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_REGISTER.labelSecondary,
  },
  phaseLabelActive: {
    color: IOS_REGISTER.accentUserAction,
    fontWeight: '600',
  },
  phaseUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: IOS_REGISTER.accentUserAction,
  },
  section: {
    marginBottom: 18,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelTertiary,
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: -0.2,
    color: IOS_REGISTER.label,
  },
  howRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: IOS_REGISTER.separatorStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    backgroundColor: IOS_REGISTER.accentUserAction,
    borderColor: IOS_REGISTER.accentUserAction,
  },
  howLabel: {
    flex: 1,
    fontSize: 15,
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  howLabelChecked: {
    color: IOS_REGISTER.labelSecondary,
  },
  libraryUnderChecklist: {
    marginTop: 10,
    marginLeft: 30,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: IOS_REGISTER.fillPill,
  },
  libraryUnderChecklistText: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_REGISTER.labelSecondary,
  },
  capabilityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  capChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  capText: {
    fontSize: 12,
    fontWeight: '500',
  },
  fromRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fromText: {
    flex: 1,
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
  },
  fromSource: {
    color: IOS_REGISTER.label,
    fontWeight: '500',
  },
  fromSuggested: {
    color: IOS_REGISTER.labelSecondary,
  },
  switcherBar: {
    paddingHorizontal: CARD_INSET,
    paddingTop: 6,
    paddingBottom: 2,
    backgroundColor: IOS_REGISTER.groundBg,
    zIndex: 5,
  },
  switcherChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: IOS_REGISTER.fillPill,
  },
  switcherChipPressed: {
    opacity: 0.6,
  },
  switcherChipText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
    color: IOS_REGISTER.label,
  },
  pickerPrimary: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_REGISTER.label,
    letterSpacing: -0.2,
  },
  pickerSecondary: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 2,
  },
});
