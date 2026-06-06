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

import React, { useCallback, useState } from 'react';
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
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { resolveDoTabInterestKind } from '@/lib/interest-config';
import { StepDetailContent } from '@/components/step/StepDetailContent';
import { PickerListSheet } from './PickerListSheet';
import type { TimelineDataset, TimelineStep } from './types';

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
  const isNowStep = step.id === dataset.focusStepId;
  const [hostWidth, setHostWidth] = useState(SCREEN_WIDTH);
  const swipeStridePx =
    Platform.OS === 'web'
      ? hostWidth * WEB_L1_CARD_WIDTH_RATIO + WEB_L1_CARD_GUTTER
      : SCREEN_WIDTH;
  const translateX = useSharedValue(0);
  const passedThreshold = useSharedValue(false);

  const handleHostLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (width > 0) setHostWidth(width);
  }, []);

  const fireSwipe = useCallback(
    (direction: 'prev' | 'next') => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      if (direction === 'prev') onSwipePrev?.();
      else onSwipeNext?.();
    },
    [onSwipePrev, onSwipeNext],
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
      passedThreshold.value = false;
      runOnJS(fireLightHaptic)();
    })
    .onUpdate((e) => {
      'worklet';
      // Rubber-banded follow: the card moves with the finger but dampened
      // so the gesture feels held back enough to read as intentional.
      translateX.value = e.translationX * SWIPE_RUBBER_FACTOR;
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
        // Cancelled — spring back to center.
        translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
        return;
      }
      const dir = e.translationX > 0 ? 1 : -1;
      if ((dir > 0 && !hasPrev) || (dir < 0 && !hasNext)) {
        translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
        return;
      }
      const direction = dir > 0 ? 'prev' : 'next';
      // Let the visible neighbor slide into the center, then commit the
      // focus change and snap the lane back to its neutral geometry.
      translateX.value = withTiming(dir * swipeStridePx, { duration: 220 }, (finished) => {
        if (finished) {
          translateX.value = 0;
          runOnJS(fireSwipe)(direction);
        }
      });
    });

  const translateStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  // Neighbor cards sit one card-width + gutter to either side. They share
  // translateX with the focused card so the lane moves as one horizontal
  // timeline strip.
  const prevTranslateStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value - swipeStridePx }],
  }));
  const nextTranslateStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value + swipeStridePx }],
  }));

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
            {prevStep ? (
              <Animated.View
                style={[styles.ghostCard, prevTranslateStyle]}
                pointerEvents="none"
              >
                <EmbeddedStepCard step={prevStep} bottomInset={bottomInset} />
              </Animated.View>
            ) : null}
            {nextStep ? (
              <Animated.View
                style={[styles.ghostCard, nextTranslateStyle]}
                pointerEvents="none"
              >
                <EmbeddedStepCard step={nextStep} bottomInset={bottomInset} />
              </Animated.View>
            ) : null}
            <Animated.View style={[styles.embedContent, translateStyle]}>
              <EmbeddedStepCard
                step={step}
                onScroll={onScroll}
                onStepDeleted={onStepDeleted}
                bottomInset={bottomInset}
              />
            </Animated.View>
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
          onScroll={onScroll}
          hideStatePill
          onDeleted={onStepDeleted}
          bottomInset={bottomInset}
        />
      </View>
    </>
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
  embedContent: {
    flex: 1,
    marginHorizontal: CARD_INSET,
    marginVertical: 10,
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
        alignSelf: 'center',
        boxShadow:
          '0 1px 2px rgba(0,0,0,0.06), 0 18px 40px -16px rgba(0,0,0,0.28), 0 6px 14px -6px rgba(0,0,0,0.12)',
        width: WEB_L1_CARD_WIDTH,
      } as any,
      default: {},
    }),
  },
  // Adjacent embedded step cards. They render real content but do not
  // receive pointer events; swiping anywhere in the lane moves the strip.
  ghostCard: {
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
      } as any,
      default: {},
    }),
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
