/**
 * TimelineFeed Component
 *
 * TikTok-style vertical swipe navigation between user timelines.
 *
 * Navigation:
 * - Swipe LEFT/RIGHT: Scrub through current person's races (handled by TimelineScreen)
 * - Swipe UP: Next followed user's timeline
 * - Swipe DOWN: Previous user / back to your timeline
 * - Your timeline is always index 0
 *
 * Features:
 * - Full-screen animated transitions between timelines
 * - Timeline indicator dots at bottom
 * - Maintains horizontal scroll position per timeline
 * - Haptic feedback on timeline changes
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
  Animated,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';
import { Users } from 'lucide-react-native';
import { TimelineScreen } from './TimelineScreen';
import { TimelineAvatarStrip } from './TimelineAvatarStrip';
import { Timeline } from '@/hooks/useFollowedTimelines';
import { TUFTE_BACKGROUND } from '@/components/cards';
import * as Haptics from 'expo-haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Swipe thresholds
const SWIPE_THRESHOLD = 50; // Minimum distance to trigger timeline change
const SWIPE_VELOCITY_THRESHOLD = 0.3; // Minimum velocity to trigger quick swipe

interface TimelineFeedProps {
  /** All timelines to display (index 0 is current user) */
  timelines: Timeline[];
  /** Whether data is still loading */
  isLoading: boolean;
  /** Callback when timeline changes */
  onTimelineChange?: (index: number, timeline: Timeline) => void;
  /** Callback when a race is selected */
  onSelectRace?: (raceId: string) => void;
  /** Currently selected race ID */
  selectedRaceId?: string | null;
  /** Current user ID for permissions */
  currentUserId?: string;
  /** Callback to edit a race */
  onEditRace?: (raceId: string) => void;
  /** Callback to delete a race */
  onDeleteRace?: (raceId: string) => void;
  /** Callback when a race is copied to timeline */
  onRaceCopied?: (newRaceId: string) => void;
  /** Available height for cards */
  cardHeight?: number;
  /** Height of the timeline indicator area */
  indicatorHeight?: number;
  /** Whether haptics are enabled */
  enableHaptics?: boolean;
}

export function TimelineFeed({
  timelines,
  isLoading: _isLoading,
  onTimelineChange,
  onSelectRace,
  selectedRaceId,
  currentUserId,
  onEditRace,
  onDeleteRace,
  onRaceCopied,
  cardHeight = 480,
  indicatorHeight: _indicatorHeight = 60,
  enableHaptics = true,
}: TimelineFeedProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const translateY = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);

  // Get current timeline
  const currentTimeline = timelines[currentIndex];

  // Trigger haptic feedback
  const triggerHaptic = useCallback(() => {
    if (enableHaptics && Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [enableHaptics]);

  // Navigate to a specific timeline index
  const navigateToTimeline = useCallback(
    (newIndex: number, animated = true) => {
      if (isAnimating.current) return;
      if (newIndex < 0 || newIndex >= timelines.length) return;
      if (newIndex === currentIndex) {
        // Bounce back animation
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 10,
        }).start();
        return;
      }

      isAnimating.current = true;
      triggerHaptic();

      // Animate transition
      const direction = newIndex > currentIndex ? -1 : 1;
      const targetY = direction * SCREEN_HEIGHT;

      if (animated) {
        Animated.timing(translateY, {
          toValue: targetY,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setCurrentIndex(newIndex);
          translateY.setValue(0);
          isAnimating.current = false;
          onTimelineChange?.(newIndex, timelines[newIndex]);
        });
      } else {
        setCurrentIndex(newIndex);
        translateY.setValue(0);
        isAnimating.current = false;
        onTimelineChange?.(newIndex, timelines[newIndex]);
      }
    },
    [currentIndex, timelines, translateY, triggerHaptic, onTimelineChange]
  );

  // Go to next timeline (swipe up)
  const goToNext = useCallback(() => {
    if (currentIndex < timelines.length - 1) {
      navigateToTimeline(currentIndex + 1);
    } else {
      // Bounce at end
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
      }).start();
    }
  }, [currentIndex, timelines.length, navigateToTimeline, translateY]);

  // Go to previous timeline (swipe down)
  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      navigateToTimeline(currentIndex - 1);
    } else {
      // Bounce at start
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
      }).start();
    }
  }, [currentIndex, navigateToTimeline, translateY]);

  // Pan responder for vertical swipe gestures
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (
          _evt: GestureResponderEvent,
          gestureState: PanResponderGestureState
        ) => {
          // Only capture vertical gestures (not horizontal for race card scrolling)
          const { dx, dy } = gestureState;
          const isVertical = Math.abs(dy) > Math.abs(dx) * 1.5;
          const isSignificant = Math.abs(dy) > 10;
          return isVertical && isSignificant && !isAnimating.current;
        },
        onPanResponderGrant: () => {
          // Gesture started
        },
        onPanResponderMove: (
          _evt: GestureResponderEvent,
          gestureState: PanResponderGestureState
        ) => {
          // Apply resistance at boundaries
          let { dy } = gestureState;

          // Apply resistance at top boundary (can't go before first timeline)
          if (currentIndex === 0 && dy > 0) {
            dy = dy * 0.3; // Resistance
          }

          // Apply resistance at bottom boundary (can't go past last timeline)
          if (currentIndex === timelines.length - 1 && dy < 0) {
            dy = dy * 0.3; // Resistance
          }

          translateY.setValue(dy);
        },
        onPanResponderRelease: (
          _evt: GestureResponderEvent,
          gestureState: PanResponderGestureState
        ) => {
          const { dy, vy } = gestureState;

          // Check if swipe was significant enough
          const swipedUp = dy < -SWIPE_THRESHOLD || vy < -SWIPE_VELOCITY_THRESHOLD;
          const swipedDown = dy > SWIPE_THRESHOLD || vy > SWIPE_VELOCITY_THRESHOLD;

          if (swipedUp) {
            goToNext();
          } else if (swipedDown) {
            goToPrevious();
          } else {
            // Not enough - bounce back
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              tension: 100,
              friction: 10,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          // Gesture interrupted - reset
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 10,
          }).start();
        },
      }),
    [currentIndex, timelines.length, translateY, goToNext, goToPrevious]
  );

  // No timelines to show
  if (timelines.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Users size={48} color="#94A3B8" />
        </View>
        <Text style={styles.emptyTitle}>No timelines yet</Text>
        <Text style={styles.emptySubtitle}>
          Follow other sailors to see their race timelines
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Main Timeline Area */}
      <Animated.View
        style={[
          styles.timelineContainer,
          {
            transform: [{ translateY }],
          },
        ]}
        {...(Platform.OS !== 'web' ? panResponder.panHandlers : {})}
      >
        {currentTimeline && (
          <TimelineScreen
            user={currentTimeline.user}
            races={currentTimeline.races}
            isActive={true}
            onSelectRace={onSelectRace}
            selectedRaceId={selectedRaceId}
            currentUserId={currentUserId}
            onEditRace={onEditRace}
            onDeleteRace={onDeleteRace}
            onRaceCopied={onRaceCopied}
            cardHeight={cardHeight}
          />
        )}
      </Animated.View>

      {/* Tufte-Inspired Avatar Strip Navigation */}
      {timelines.length > 1 && (
        <TimelineAvatarStrip
          timelines={timelines}
          currentIndex={currentIndex}
          onSelectTimeline={(index) => navigateToTimeline(index)}
          enableHaptics={enableHaptics}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TUFTE_BACKGROUND,
  },
  timelineContainer: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: TUFTE_BACKGROUND,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
});

export default TimelineFeed;
