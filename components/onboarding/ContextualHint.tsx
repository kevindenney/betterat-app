/**
 * ContextualHint — Visual hint component.
 *
 * Wraps children and shows a small popover card when the hint is visible.
 * White card with blue left border, arrow pointing at the wrapped element,
 * and dismiss / skip buttons. Reports its position to the tour backdrop
 * for the spotlight cutout.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
  type LayoutChangeEvent,
  type ViewStyle,
  useWindowDimensions,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useFeatureTourContext } from '@/providers/FeatureTourProvider';

interface ContextualHintProps {
  /** Whether the hint popover is visible. */
  visible: boolean;
  /** Title text for the hint. */
  title: string;
  /** Description / body text. */
  description: string;
  /** Called when user taps the dismiss button. */
  onDismiss: () => void;
  /** Label for the dismiss button (default: "Next"). */
  dismissLabel?: string;
  /** Where to place the popover relative to the child. */
  position?: 'top' | 'bottom';
  /** Wrap the target element. */
  children: React.ReactNode;
  /** Optional extra style for the outer container. */
  style?: ViewStyle;
  /** Distance in px between target and popover. */
  distance?: number;
  /** Horizontal anchor strategy for the popover relative to target. */
  horizontalAlign?: 'center' | 'targetLeft' | 'targetRight';
  /** Show skip action in the hint card. */
  showSkip?: boolean;
  /** Called when user taps "Skip Tour". */
  onSkip?: () => void;
  /** Optional secondary action (e.g. "Open tab"). */
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  /** Pulse highlight around target while visible. */
  pulseTarget?: boolean;
  /** Called when target wrapper is laid out with non-zero size. */
  onTargetReady?: () => void;
}

export function ContextualHint({
  visible,
  title,
  description,
  onDismiss,
  dismissLabel = 'Next',
  position = 'bottom',
  children,
  style,
  distance = 8,
  horizontalAlign = 'center',
  showSkip = false,
  onSkip,
  secondaryActionLabel,
  onSecondaryAction,
  pulseTarget = false,
  onTargetReady,
}: ContextualHintProps) {
  const collapsableProp = Platform.OS === 'web' ? undefined : false;
  const [targetBounds, setTargetBounds] = React.useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [cardHeight, setCardHeight] = React.useState(0);
  const { width: viewportWidth } = useWindowDimensions();
  const cardWidth = Math.min(340, Math.max(280, viewportWidth - 24));
  const pulseScale = useSharedValue(1);

  // Use a separate native View ref for measureInWindow (Animated.View doesn't support it)
  const measureRef = useRef<View>(null);
  const { setSpotlightBounds } = useFeatureTourContext();

  const measureTarget = useCallback(() => {
    if (!measureRef.current) {
      return;
    }
    measureRef.current.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        const nextBounds = { x, y, width, height };
        setTargetBounds(nextBounds);
        setSpotlightBounds(nextBounds);
      }
    });
  }, [setSpotlightBounds]);

  const handleWrapperLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      onTargetReady?.();
      if (visible) {
        setTimeout(measureTarget, 0);
      }
    }
  }, [onTargetReady, visible, measureTarget]);

  // Measure wrapper position in window and report as spotlight bounds
  useEffect(() => {
    if (!visible) {
      setSpotlightBounds(null);
      setTargetBounds(null);
      setCardHeight(0);
      return;
    }

    // Delay to ensure layout is complete after animation
    const timer = setTimeout(() => {
      measureTarget();
    }, 150);

    return () => clearTimeout(timer);
  }, [visible, setSpotlightBounds, measureTarget, viewportWidth]);

  useEffect(() => {
    if (visible && pulseTarget) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.018, { duration: 420 }),
          withTiming(1, { duration: 420 }),
        ),
        -1,
        false,
      );
      return;
    }

    pulseScale.value = withTiming(1, { duration: 120 });
  }, [pulseScale, visible, pulseTarget]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const horizontalPadding = 12;
  const maxLeft = Math.max(horizontalPadding, viewportWidth - cardWidth - horizontalPadding);
  const targetCenterX = targetBounds ? targetBounds.x + targetBounds.width / 2 : 0;
  const targetLeft = targetBounds?.x ?? 0;
  const targetRight = targetBounds ? targetBounds.x + targetBounds.width : 0;
  const preferredLeft =
    horizontalAlign === 'targetLeft'
      ? targetLeft
      : horizontalAlign === 'targetRight'
        ? targetRight - cardWidth
        : targetCenterX - cardWidth / 2;
  const popoverLeft = Math.min(maxLeft, Math.max(horizontalPadding, preferredLeft));
  const anchorOffsetX = targetBounds ? targetCenterX - popoverLeft : 0;
  const arrowLeft = Math.max(16, Math.min(cardWidth - 26, anchorOffsetX - 8));
  const fallbackTop = 100;
  const popoverTop = targetBounds
    ? position === 'top'
      ? Math.max(8, targetBounds.y - cardHeight - distance)
      : targetBounds.y + targetBounds.height + distance
    : fallbackTop;

  return (
    <Animated.View
      style={[styles.wrapper, visible && styles.wrapperHighlight, pulseStyle, style]}
      onLayout={handleWrapperLayout}
    >
      {/* Native View wrapper for measureInWindow (Animated.View can't do this) */}
      <View ref={measureRef} collapsable={collapsableProp}>
        {children}
      </View>

      {/* Popover on top-most layer to avoid being blocked by backdrop */}
      <Modal
        transparent
        visible={visible && !!targetBounds}
        animationType="none"
        statusBarTranslucent
      >
        <View style={styles.modalRoot} pointerEvents="box-none">
          <Animated.View
            entering={FadeIn.duration(220)}
            exiting={FadeOut.duration(150)}
            style={[
              styles.modalPopover,
              {
                top: popoverTop,
                left: popoverLeft,
                width: cardWidth,
                opacity: position === 'top' && cardHeight === 0 ? 0 : 1,
              },
            ]}
            pointerEvents="auto"
            onLayout={(event) => {
              const nextHeight = event.nativeEvent.layout.height;
              if (nextHeight > 0 && nextHeight !== cardHeight) {
                setCardHeight(nextHeight);
              }
            }}
          >
            <View
              style={[
                styles.arrow,
                position === 'top' ? styles.arrowBottom : styles.arrowTop,
                { left: arrowLeft },
              ]}
            />

            <View style={[styles.card, { width: cardWidth, maxWidth: cardWidth }]}>
              <View style={styles.blueBorder} />
              <View style={styles.content}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.description}>{description}</Text>
                <View style={styles.actionsRow}>
                  {secondaryActionLabel && onSecondaryAction && (
                    <TouchableOpacity
                      style={styles.secondaryActionButton}
                      onPress={onSecondaryAction}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.secondaryActionText}>{secondaryActionLabel}</Text>
                    </TouchableOpacity>
                  )}
                  {showSkip && onSkip && (
                    <TouchableOpacity
                      style={styles.skipButton}
                      onPress={onSkip}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.skipText}>Skip</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.dismissButton}
                    onPress={onDismiss}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.dismissText}>{dismissLabel}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  wrapperHighlight: {
    borderRadius: 10,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.36,
    shadowRadius: 14,
    elevation: 8,
  },
  popover: {
    position: 'absolute',
    zIndex: 1000,
  },
  modalRoot: {
    ...StyleSheet.absoluteFillObject,
  },
  modalPopover: {
    position: 'absolute',
    zIndex: 1200,
  },
  popoverWideTarget: {
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  popoverCompactTarget: {
    right: 0,
    alignItems: 'flex-end',
  },
  popoverNarrowTarget: {
    left: 0,
    alignItems: 'flex-start',
  },
  popoverTop: {
    bottom: '100%',
  },
  popoverBottom: {
    top: '100%',
  },
  arrow: {
    width: 16,
    height: 16,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
    position: 'absolute',
    zIndex: 2,
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderColor: '#DBEAFE',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  arrowTop: {
    top: -8,
  },
  arrowBottom: {
    bottom: -8,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
    overflow: 'hidden',
  },
  blueBorder: {
    width: 4,
    backgroundColor: '#3B82F6',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  content: {
    flex: 1,
    padding: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 10,
  },
  dismissButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  dismissText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  secondaryActionButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  skipButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  skipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
});
