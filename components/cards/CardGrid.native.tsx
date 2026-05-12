/**
 * CardGrid (Native) - Horizontal Race Timeline Navigation
 *
 * Simplified architecture:
 * - Horizontal swipes for race timeline navigation
 * - Single RaceSummaryCard per race (full height, scrolls internally)
 * - Phase tabs inside card for temporal navigation
 * - Bottom sheet for drill-down details
 *
 * Uses react-native-gesture-handler and react-native-reanimated.
 */

import React, { useCallback, useMemo, memo, useState, useEffect } from 'react';
import { StyleSheet, View, Platform, LayoutChangeEvent } from 'react-native';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  useSharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import {
  CardGridProps,
  CardRaceData,
  CardType,
  CardPosition,
  isRacePast,
} from './types';
import {
  SNAP_SPRING_CONFIG,
  VELOCITY_THRESHOLD,
  SNAP_DISTANCE_THRESHOLD,
  HORIZONTAL_CARD_GAP,
  ENABLE_HAPTICS,
  calculateCardDimensions,
  IOS_COLORS,
} from './constants';
import { CardShell } from './CardShell';
import { TimeAxisRace } from '@/components/races/TimelineTimeAxis';
import { CardWidthContext } from './CardWidthContext';

// =============================================================================
// CONSTANTS
// =============================================================================

// =============================================================================
// TYPES
// =============================================================================

interface CardGridNativeProps extends CardGridProps {
  /** Render function for card content */
  renderCardContent: (
    race: CardRaceData,
    cardType: CardType,
    isActive: boolean,
    canManage: boolean,
    onEdit?: () => void,
    onDelete?: () => void,
    onUploadDocument?: () => void,
    onRaceComplete?: (sessionId: string, raceName: string, raceId: string) => void,
    onOpenPostRaceInterview?: () => void,
    userId?: string,
    onDismiss?: () => void,
    raceIndex?: number,
    totalRaces?: number,
    // Timeline navigation props (for compact axis inside card)
    timelineRaces?: { id: string; date: string; raceType?: 'fleet' | 'distance' | 'match' | 'team'; seriesName?: string; name?: string; interestSlug?: string; metadata?: Record<string,unknown> }[],
    currentRaceIndex?: number,
    onSelectRace?: (index: number) => void,
    nextRaceIndex?: number,
    // Handler for card press (not used on native but needed for parameter parity with web)
    onCardPress?: () => void,
    // Refetch trigger for AfterRaceContent
    refetchTrigger?: number
  ) => React.ReactNode;
}

// =============================================================================
// CARD GRID COMPONENT
// =============================================================================

function CardGridComponent({
  races,
  initialRaceIndex = 0,
  onRaceChange,
  renderCardContent,
  style,
  enableHaptics = ENABLE_HAPTICS,
  testID,
  userId,
  onEditRace,
  onDeleteRace,
  onUploadDocument,
  onRaceComplete,
  onOpenPostRaceInterview,
  nextRaceIndex,
  deletingRaceId,
  onDismissSample,
  topInset = 0,
  safeAreaTop = 0,
  toolbarHidden = false,
  onContentScroll: _onContentScroll,
  refetchTrigger,
  nowBarWeather: _nowBarWeather,
}: CardGridNativeProps) {
  // Track actual container dimensions
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContainerSize({ width, height });
  }, []);

  // Navigation state
  const [jsRaceIndex, setJsRaceIndex] = useState(initialRaceIndex);

  // Shared values for animations
  const currentRaceIndex = useSharedValue(initialRaceIndex);
  const horizontalOffset = useSharedValue(0);
  const isGestureActive = useSharedValue(false);

  // Animated top inset: shrinks from toolbarHeight to safeAreaTop when toolbar hides
  const animatedTopInset = useSharedValue(topInset);

  useEffect(() => {
    animatedTopInset.value = withTiming(
      toolbarHidden ? safeAreaTop : topInset,
      { duration: 250 },
    );
  }, [toolbarHidden, topInset, safeAreaTop, animatedTopInset]);

  const animatedWrapperStyle = useAnimatedStyle(() => ({
    paddingTop: animatedTopInset.value,
  }));

  // Calculate dimensions
  const effectiveWidth = containerSize?.width ?? 393;
  const effectiveHeight = containerSize?.height ?? 700;

  // Card height based on current animated top inset target (not animated, drives layout)
  const currentTopInset = toolbarHidden ? safeAreaTop : topInset;

  const dimensions = useMemo(() => {
    const baseCalc = calculateCardDimensions(effectiveWidth, effectiveHeight);
    return {
      ...baseCalc,
      cardHeight: effectiveHeight - 24 - currentTopInset,
    };
  }, [effectiveWidth, effectiveHeight, currentTopInset]);

  // Stable CardWidthContext value — one object per cardWidth instead of one per card per render.
  const cardWidthContextValue = useMemo(
    () => ({ cardWidth: dimensions.cardWidth }),
    [dimensions.cardWidth],
  );

  // Update horizontal offset when dimensions change
  useEffect(() => {
    horizontalOffset.value = jsRaceIndex * dimensions.horizontalSnapInterval;
  }, [dimensions.horizontalSnapInterval, jsRaceIndex, horizontalOffset]);

  // Respond to initialRaceIndex changes from parent (e.g., "upcoming" button)
  // NOTE: We do NOT call onRaceChange here to avoid re-render loops.
  // The parent already knows the race index (it passed it to us).
  // onRaceChange should only be called when the USER changes the race via gesture.
  useEffect(() => {
    if (initialRaceIndex !== jsRaceIndex && initialRaceIndex >= 0 && initialRaceIndex < races.length) {
      // Update shared values
      currentRaceIndex.value = initialRaceIndex;
      horizontalOffset.value = withSpring(initialRaceIndex * dimensions.horizontalSnapInterval, SNAP_SPRING_CONFIG);
      // Update JS state only - no callback to avoid loop
      setJsRaceIndex(initialRaceIndex);
    }
    // jsRaceIndex intentionally omitted — see comment above (loop guard).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRaceIndex, races.length, currentRaceIndex, horizontalOffset, dimensions.horizontalSnapInterval]);

  // ==========================================================================
  // GESTURE HANDLING
  // ==========================================================================

  const handleRaceChange = useCallback(
    (idx: number) => {
      setJsRaceIndex(idx);
      if (onRaceChange && races[idx]) {
        onRaceChange(idx, races[idx]);
      }
    },
    [onRaceChange, races]
  );

  /**
   * Navigate to a specific race index (used by timeline dots)
   */
  const goToRace = useCallback(
    (targetIndex: number) => {
      if (targetIndex < 0 || targetIndex >= races.length || targetIndex === jsRaceIndex) {
        return;
      }

      // Haptic feedback
      if (enableHaptics && Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // Update shared values for animation
      currentRaceIndex.value = targetIndex;
      horizontalOffset.value = withSpring(targetIndex * dimensions.horizontalSnapInterval, SNAP_SPRING_CONFIG);

      // Update JS state and trigger callback
      handleRaceChange(targetIndex);
    },
    [races.length, jsRaceIndex, enableHaptics, dimensions.horizontalSnapInterval, handleRaceChange, currentRaceIndex, horizontalOffset]
  );

  const racesCount = races.length;
  const lastDoneIndex = useMemo(() => {
    if (races.length === 0) return null;
    if (nextRaceIndex != null) {
      if (nextRaceIndex <= 0) return null;
      return Math.min(nextRaceIndex - 1, races.length - 1);
    }
    for (let i = races.length - 1; i >= 0; i -= 1) {
      const row = races[i];
      if (isRacePast(row.date, row.startTime)) return i;
    }
    return null;
  }, [nextRaceIndex, races]);

  // Convert races to TimeAxisRace format for Tufte-inspired time axis
  const timeAxisRaces: TimeAxisRace[] = useMemo(() => {
    return races.map((race) => ({
      id: race.id,
      date: race.start_date || race.date || new Date().toISOString(),
      raceType: (race.race_type as 'fleet' | 'distance' | 'match' | 'team') || 'fleet',
      seriesName: race.series_name || race.metadata?.series_name,
      name: race.name,
      interestSlug: String(race.metadata?.interest_slug || ''),
      metadata: race.metadata,
    }));
  }, [races]);

  /**
   * Pan gesture for horizontal race navigation
   */
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-10, 10])
        .failOffsetY([-10, 10])
        .onStart(() => {
          'worklet';
          isGestureActive.value = true;
        })
        .onUpdate((event) => {
          'worklet';
          const { translationX } = event;
          const currentIdx = Math.max(0, currentRaceIndex.value);
          const baseOffset = currentIdx * dimensions.horizontalSnapInterval;
          horizontalOffset.value = baseOffset - translationX;
        })
        .onEnd((event) => {
          'worklet';
          const { translationX, velocityX } = event;
          const currentIndex = Math.max(0, currentRaceIndex.value);
          let targetIndex = currentIndex;

          // Check velocity and distance thresholds
          if (velocityX < -VELOCITY_THRESHOLD || translationX < -SNAP_DISTANCE_THRESHOLD) {
            targetIndex = Math.min(currentIndex + 1, racesCount - 1);
          } else if (velocityX > VELOCITY_THRESHOLD || translationX > SNAP_DISTANCE_THRESHOLD) {
            targetIndex = Math.max(currentIndex - 1, 0);
          }

          // Ensure targetIndex is valid
          targetIndex = Math.max(0, Math.min(targetIndex, racesCount - 1));

          // Snap to target
          const targetOffset = targetIndex * dimensions.horizontalSnapInterval;
          horizontalOffset.value = withSpring(targetOffset, SNAP_SPRING_CONFIG);
          currentRaceIndex.value = targetIndex;

          // Haptic feedback
          if (enableHaptics && Platform.OS !== 'web' && targetIndex !== currentIndex) {
            runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
          }

          // Callback
          if (targetIndex !== currentIndex) {
            runOnJS(handleRaceChange)(targetIndex);
          }

          isGestureActive.value = false;
        }),
    [
      dimensions.horizontalSnapInterval,
      racesCount,
      enableHaptics,
      handleRaceChange,
      currentRaceIndex,
      horizontalOffset,
      isGestureActive,
    ]
  );

  // ==========================================================================
  // ANIMATED CONTAINER STYLE
  // ==========================================================================

  const animatedContainerStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [
        { translateX: -horizontalOffset.value + dimensions.contentPaddingLeft },
      ],
    };
  }, [dimensions.contentPaddingLeft]);

  // ==========================================================================
  // RENDER CARDS
  // ==========================================================================

  const gridState = useMemo(
    () => ({
      currentRaceIndex,
      horizontalOffset,
      isGestureActive,
    }),
    [currentRaceIndex, horizontalOffset, isGestureActive]
  );

  /**
   * Render a single card for a race
   */
  const renderCard = useCallback(
    (race: CardRaceData, raceIndex: number) => {
      const position: CardPosition = { x: raceIndex };
      const isActive = raceIndex === jsRaceIndex;

      // Only render cards within visible range for performance
      const isNearby = Math.abs(raceIndex - jsRaceIndex) <= 1;
      if (!isNearby) {
        return null;
      }

      // Determine if user can manage this race (or if it's a demo race that can be dismissed)
      const isDemo = !!race.isDemo;
      const canManage = (!!userId && race.created_by === userId) || isDemo;
      const handleEdit = !isDemo && canManage && onEditRace ? () => onEditRace(race.id) : undefined;
      const handleDelete = !isDemo && canManage && onDeleteRace ? () => onDeleteRace(race.id, race.name) : undefined;
      const handleDismiss = isDemo && onDismissSample ? onDismissSample : undefined;
      const handleUploadDocument = onUploadDocument ? () => onUploadDocument(race.id) : undefined;
      const handleRaceComplete = onRaceComplete
        ? (sessionId: string, raceName: string, raceId: string) => onRaceComplete(sessionId, raceName, raceId)
        : undefined;
      const handleOpenPostRaceInterview = onOpenPostRaceInterview
        ? () => onOpenPostRaceInterview(race.id, race.name)
        : undefined;

      // Determine if this is the next upcoming race (for subtle styling)
      // Use != to catch both null and undefined
      const isNextRace = nextRaceIndex != null && raceIndex === nextRaceIndex;
      const isLastDone = lastDoneIndex != null && raceIndex === lastDoneIndex;

      // Determine if race is in the past (for warm off-white background)
      const isPastRace = isRacePast(race.date, race.startTime);

      return (
        <View
          key={race.id}
          testID={raceIndex === 0 ? 'card-first-in-timeline' : undefined}
          style={[
            styles.cardPosition,
            {
              left: raceIndex * (dimensions.cardWidth + HORIZONTAL_CARD_GAP),
              top: 0,
            },
          ]}
        >
          <CardShell
            isNextRace={isNextRace}
            isLastDone={isLastDone}
            isPast={isPastRace}
            position={position}
            dimensions={dimensions}
            gridState={gridState}
            testID={`card-${race.id}`}
            isDeleting={deletingRaceId === race.id}
          >
            <CardWidthContext.Provider value={cardWidthContextValue}>
              {renderCardContent(
                race,
                'race_summary',
                isActive,
                canManage,
                handleEdit,
                handleDelete,
                handleUploadDocument,
                handleRaceComplete,
                handleOpenPostRaceInterview,
                userId,
                handleDismiss,
                raceIndex,
                races.length,
                // Timeline navigation props (for compact axis inside card)
                timeAxisRaces,
                jsRaceIndex,
                goToRace,
                nextRaceIndex ?? undefined,
                // onCardPress - not used on native (swipe navigation instead)
                undefined,
                // refetchTrigger for AfterRaceContent
                refetchTrigger
              )}
            </CardWidthContext.Provider>
          </CardShell>
        </View>
      );
    },
    [
      jsRaceIndex,
      dimensions,
      gridState,
      renderCardContent,
      userId,
      onEditRace,
      onDeleteRace,
      onUploadDocument,
      onRaceComplete,
      onOpenPostRaceInterview,
      deletingRaceId,
      onDismissSample,
      races.length,
      refetchTrigger,
      cardWidthContextValue,
      goToRace,
      lastDoneIndex,
      nextRaceIndex,
      timeAxisRaces,
    ]
  );

  /**
   * Render all visible cards
   */
  const renderCards = useMemo(() => {
    return races.map((race, raceIndex) => {
      // DEBUG: Log each race being rendered
      if (typeof window !== 'undefined' && (window as any).__PERIOD_DEBUG__?.enabled) {
        (window as any).__PERIOD_DEBUG__.log('CardGrid.native.renderCard', raceIndex, { raceId: race.id, raceName: race.name, raceIndex });
      }
      return renderCard(race, raceIndex);
    }).filter(Boolean);
  }, [races, renderCard]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  if (races.length === 0) {
    return (
      <View style={[styles.container, styles.emptyContainer, style]} testID={testID}>
        {/* Empty state could go here */}
      </View>
    );
  }

  // Calculate total grid size (horizontal only)
  const totalGridWidth = races.length * (dimensions.cardWidth + HORIZONTAL_CARD_GAP);

  return (
    <GestureHandlerRootView
      style={[styles.rootContainer, style]}
      testID={testID}
      onLayout={handleLayout}
    >
      <Animated.View style={[styles.gestureWrapper, animatedWrapperStyle]}>
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              styles.gridContainer,
              {
                width: totalGridWidth,
                height: dimensions.cardHeight,
              },
              animatedContainerStyle,
            ]}
            collapsable={false}
          >
            {renderCards}
          </Animated.View>
        </GestureDetector>
      </Animated.View>

    </GestureHandlerRootView>
  );
}

// =============================================================================
// MEMOIZED EXPORT
// =============================================================================

export const CardGrid = memo(CardGridComponent);

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
    overflow: 'hidden',
    minHeight: 500,
  },
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
    overflow: 'hidden',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gestureWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  gridContainer: {
    position: 'relative',
  },
  cardPosition: {
    position: 'absolute',
  },
});

export default CardGrid;
