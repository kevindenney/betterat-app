/**
 * TourOverlay — Standalone overlay component for tour progress UI
 *
 * Shows progress dots, step counter, and optional skip/controls.
 * Used in the tab layout alongside the FeatureTourProvider.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

export interface TourOverlayProps {
  visible: boolean;
  currentStepIndex: number;
  totalSteps: number;
  onSkip: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onGoToStep?: (index: number) => void;
  onReset?: () => void;
  showSkipButton?: boolean;
  showProgressIndicator?: boolean;
  style?: ViewStyle;
}

export function TourOverlay({
  visible,
  currentStepIndex,
  totalSteps,
  onSkip,
  onPrevious,
  onNext,
  onGoToStep,
  onReset,
  showSkipButton = true,
  showProgressIndicator = true,
  style,
}: TourOverlayProps) {
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  const hasControls = onPrevious || onNext || onReset;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={[styles.overlay, style]}
      pointerEvents="box-none"
    >
      {showProgressIndicator && (
        <View style={[styles.progressContainer, { paddingTop: insets.top + 4 }]}>
          <View style={styles.progressInner}>
            <View style={styles.progressDots}>
              {Array.from({ length: totalSteps }).map((_, index) => {
                const dot = (
                  <View
                    key={index}
                    style={[
                      styles.progressDot,
                      index < currentStepIndex
                        ? styles.progressDotCompleted
                        : index === currentStepIndex - 1
                          ? styles.progressDotCurrent
                          : styles.progressDotUpcoming,
                    ]}
                  />
                );

                if (onGoToStep) {
                  return (
                    <TouchableOpacity
                      key={index}
                      onPress={() => onGoToStep(index + 1)}
                      activeOpacity={0.75}
                    >
                      {dot}
                    </TouchableOpacity>
                  );
                }

                return dot;
              })}
            </View>
            <Text style={styles.progressText}>
              {currentStepIndex} of {totalSteps}
            </Text>
            {hasControls && (
              <View style={styles.controlsRow}>
                {onPrevious && (
                  <TouchableOpacity
                    style={[styles.controlButton, currentStepIndex <= 1 && styles.controlButtonDisabled]}
                    onPress={onPrevious}
                    disabled={currentStepIndex <= 1}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.controlButtonText, currentStepIndex <= 1 && styles.controlButtonTextDisabled]}>Back</Text>
                  </TouchableOpacity>
                )}
                {onNext && (
                  <TouchableOpacity
                    style={styles.controlButton}
                    onPress={onNext}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.controlButtonText}>Next</Text>
                  </TouchableOpacity>
                )}
                {onReset && (
                  <TouchableOpacity
                    style={styles.controlButton}
                    onPress={onReset}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.controlButtonText}>Reset</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      )}

      {showSkipButton && (
        <View style={styles.skipContainer}>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={onSkip}
            activeOpacity={0.7}
          >
            <Text style={styles.skipText}>Skip Tour</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    pointerEvents: 'box-none',
    zIndex: 999,
  },
  progressContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    pointerEvents: 'auto',
  },
  progressInner: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    gap: 12,
  },
  progressDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  progressDotCompleted: {
    backgroundColor: '#3B82F6',
  },
  progressDotCurrent: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
  },
  progressDotUpcoming: {
    backgroundColor: '#E5E7EB',
  },
  progressText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlButton: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  controlButtonDisabled: {
    backgroundColor: '#F1F5F9',
  },
  controlButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  controlButtonTextDisabled: {
    color: '#94A3B8',
  },
  skipContainer: {
    alignItems: 'center',
    paddingBottom: 120,
    paddingHorizontal: 20,
    pointerEvents: 'auto',
  },
  skipButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
});
