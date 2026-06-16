/**
 * TourStep — Wrapper component for feature tour steps
 *
 * Integrates with ContextualHint to show tour hints on specific elements.
 * Automatically shows/hides based on the current tour step.
 */

import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { ContextualHint } from './ContextualHint';
import { useFeatureTourContext, useTourStepContext, type TourStep as TourStepType } from '@/providers/FeatureTourProvider';
import { TOUR_STEPS } from '@/services/onboarding/FeatureTourService';

export interface TourStepProps {
  /** The tour step this component is associated with */
  step: TourStepType;
  /** The target element to wrap */
  children: React.ReactNode;
  /** Optional extra style for the wrapper */
  style?: ViewStyle;
  /** Override the default position from config */
  position?: 'top' | 'bottom';
  /** Horizontal alignment for hint card relative to target */
  horizontalAlign?: 'center' | 'targetLeft' | 'targetRight';
  /** Distance between target and hint card */
  distance?: number;
  /** Override the default title from config */
  title?: string;
  /** Override the default description from config */
  description?: string;
}

/**
 * TourStep component that wraps a target element and shows
 * a contextual hint when the associated tour step is active.
 */
export function TourStep({
  step,
  children,
  style,
  position,
  horizontalAlign,
  distance,
  title,
  description,
}: TourStepProps) {
  const { isActive, config, advance, skip } = useTourStepContext(step);
  const { markStepReady } = useFeatureTourContext();

  // Use config values if not overridden
  const hintTitle = title ?? config?.title ?? '';
  const hintDescription = description ?? config?.description ?? '';
  const hintPosition = position ?? config?.position ?? 'bottom';

  // Determine button label: last step → "Done", otherwise "Next →"
  const stepIndex = TOUR_STEPS.indexOf(step);
  const isLastStep = stepIndex === TOUR_STEPS.length - 1;
  const dismissLabel = isLastStep ? 'Done' : 'Next \u2192';

  return (
    <ContextualHint
      visible={isActive}
      title={hintTitle}
      description={hintDescription}
      position={hintPosition}
      onDismiss={advance}
      dismissLabel={dismissLabel}
      showSkip
      onSkip={skip}
      onTargetReady={() => markStepReady(step)}
      style={style}
      horizontalAlign={horizontalAlign}
      distance={distance ?? 10}
    >
      {children}
    </ContextualHint>
  );
}

/**
 * TourStepIndicator — Shows tour progress (e.g., "2 of 5")
 *
 * Can be used in a header or overlay to show the user's progress
 * through the tour.
 */
export interface TourStepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  style?: ViewStyle;
}

export function TourStepIndicator({
  currentStep,
  totalSteps,
  style,
}: TourStepIndicatorProps) {
  if (currentStep === 0) return null;

  return (
    <View style={[styles.indicator, style]}>
      <View style={styles.indicatorInner}>
        {Array.from({ length: totalSteps }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index < currentStep ? styles.dotActive : styles.dotInactive,
              index === currentStep - 1 && styles.dotCurrent,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  indicator: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  indicatorInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: '#3B82F6',
  },
  dotInactive: {
    backgroundColor: '#E5E7EB',
  },
  dotCurrent: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
  },
});

export default TourStep;
