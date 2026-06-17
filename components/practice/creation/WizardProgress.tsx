/**
 * WizardProgress Component
 *
 * Step indicator for the 4Q practice creation wizard.
 * Shows: WHAT → WHO → WHY → HOW
 */

import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { IOS_COLORS } from '@/components/cards/constants';
import { WizardStep } from '@/hooks/usePracticeCreationWizard';

const STEPS: { key: WizardStep; label: string; shortLabel: string }[] = [
  { key: 'what', label: 'What', shortLabel: 'WHAT' },
  { key: 'who', label: 'Who', shortLabel: 'WHO' },
  { key: 'why', label: 'Why', shortLabel: 'WHY' },
  { key: 'how', label: 'How', shortLabel: 'HOW' },
];

interface WizardProgressProps {
  currentStep: WizardStep;
  onStepPress?: (step: WizardStep) => void;
  canNavigateToStep?: (step: WizardStep) => boolean;
}

function StepDot({
  step,
  index,
  isActive,
  isCompleted,
  canNavigate,
  onPress,
}: {
  step: { key: WizardStep; label: string; shortLabel: string };
  index: number;
  isActive: boolean;
  isCompleted: boolean;
  canNavigate: boolean;
  onPress?: () => void;
}) {
  const dotStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      backgroundColor: isActive
        ? IOS_COLORS.indigo
        : isCompleted
        ? IOS_COLORS.green
        : IOS_COLORS.gray5,
      transform: [{ scale: withSpring(isActive ? 1.1 : 1) }],
    };
  });

  const textStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      color: isActive
        ? IOS_COLORS.indigo
        : isCompleted
        ? IOS_COLORS.green
        : IOS_COLORS.gray3,
      fontWeight: isActive ? '700' : '500',
    };
  });

  return (
    <TouchableOpacity
      style={styles.stepContainer}
      onPress={onPress}
      disabled={!canNavigate}
      activeOpacity={canNavigate ? 0.7 : 1}
    >
      <Animated.View style={[styles.stepDot, dotStyle]}>
        <Text style={styles.stepNumber}>{index + 1}</Text>
      </Animated.View>
      <Animated.Text style={[styles.stepLabel, textStyle]}>
        {step.shortLabel}
      </Animated.Text>
    </TouchableOpacity>
  );
}

function StepConnector({ isCompleted }: { isCompleted: boolean }) {
  return (
    <View
      style={[
        styles.connector,
        { backgroundColor: isCompleted ? IOS_COLORS.green : IOS_COLORS.gray5 },
      ]}
    />
  );
}

export function WizardProgress({
  currentStep,
  onStepPress,
  canNavigateToStep,
}: WizardProgressProps) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <View style={styles.container}>
      {STEPS.map((step, index) => {
        const isActive = step.key === currentStep;
        const isCompleted = index < currentIndex;
        const canNavigate = canNavigateToStep?.(step.key) ?? index <= currentIndex;

        return (
          <React.Fragment key={step.key}>
            <StepDot
              step={step}
              index={index}
              isActive={isActive}
              isCompleted={isCompleted}
              canNavigate={canNavigate}
              onPress={() => canNavigate && onStepPress?.(step.key)}
            />
            {index < STEPS.length - 1 && <StepConnector isCompleted={isCompleted} />}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: IOS_COLORS.systemBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.gray5,
  },
  stepContainer: {
    alignItems: 'center',
    gap: 6,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepLabel: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
  connector: {
    flex: 1,
    height: 2,
    marginHorizontal: 8,
    marginBottom: 20, // Offset for label
    borderRadius: 1,
    maxWidth: 40,
  },
});

export default WizardProgress;
