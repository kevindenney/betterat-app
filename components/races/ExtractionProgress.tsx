/**
 * ExtractionProgress Component
 *
 * Animated progress indicator for AI extraction
 * Shows step-by-step extraction status
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Spacing, colors, BorderRadius } from '@/constants/designSystem';

export type ExtractionStep =
  | 'parsing'
  | 'extracting_basic'
  | 'extracting_course'
  | 'extracting_weather'
  | 'validating'
  | 'complete';

interface ExtractionProgressProps {
  currentStep: ExtractionStep;
  progress: number; // 0-100
}

const steps: { key: ExtractionStep; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'parsing', label: 'Reading document', icon: 'document-text-outline' },
  { key: 'extracting_basic', label: 'Extracting race details', icon: 'information-circle-outline' },
  { key: 'extracting_course', label: 'Finding course information', icon: 'navigate-outline' },
  { key: 'extracting_weather', label: 'Analyzing conditions', icon: 'partly-sunny-outline' },
  { key: 'validating', label: 'Validating data', icon: 'checkmark-circle-outline' },
  { key: 'complete', label: 'Complete!', icon: 'checkmark-done-circle' },
];

export const ExtractionProgress: React.FC<ExtractionProgressProps> = ({
  currentStep,
  progress,
}) => {
  const [spinValue] = useState(new Animated.Value(0));

  useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    );
    spin.start();
    return () => spin.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const currentStepIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <Ionicons name="sparkles" size={32} color={colors.ai[600]} />
        </Animated.View>
        <Text style={styles.title}>Extracting race information</Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${progress}%` }]} />
      </View>
      <Text style={styles.progressText}>{Math.round(progress)}%</Text>

      {/* Steps */}
      <View style={styles.steps}>
        {steps.map((step, index) => {
          const isActive = index === currentStepIndex;
          const isComplete = index < currentStepIndex || currentStep === 'complete';
          const isPending = index > currentStepIndex && currentStep !== 'complete';

          return (
            <View key={step.key} style={styles.step}>
              <View
                style={[
                  styles.stepIcon,
                  isActive && styles.stepIconActive,
                  isComplete && styles.stepIconComplete,
                  isPending && styles.stepIconPending,
                ]}
              >
                <Ionicons
                  name={step.icon}
                  size={20}
                  color={
                    isComplete
                      ? colors.success[600]
                      : isActive
                      ? colors.ai[600]
                      : colors.text.tertiary
                  }
                />
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  isActive && styles.stepLabelActive,
                  isComplete && styles.stepLabelComplete,
                ]}
              >
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Fun fact */}
      <View style={styles.funFact}>
        <Ionicons name="bulb-outline" size={16} color={colors.warning[600]} />
        <Text style={styles.funFactText}>
          Did you know? Course marks, start times, and even tactical notes can be extracted from race documents
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.xl,
    backgroundColor: colors.background.primary,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h3,
    color: colors.text.primary,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: colors.background.tertiary,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.ai[600],
    borderRadius: 4,
  },
  progressText: {
    ...Typography.caption,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  steps: {
    gap: Spacing.md,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.secondary,
    borderWidth: 2,
    borderColor: colors.border.light,
  },
  stepIconActive: {
    backgroundColor: colors.ai[50],
    borderColor: colors.ai[600],
  },
  stepIconComplete: {
    backgroundColor: colors.success[50],
    borderColor: colors.success[600],
  },
  stepIconPending: {
    opacity: 0.5,
  },
  stepLabel: {
    ...Typography.body,
    color: colors.text.secondary,
  },
  stepLabelActive: {
    ...Typography.bodyBold,
    color: colors.ai[700],
  },
  stepLabelComplete: {
    color: colors.text.tertiary,
  },
  funFact: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    padding: Spacing.md,
    backgroundColor: colors.warning[50],
    borderRadius: BorderRadius.medium,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning[600],
  },
  funFactText: {
    ...Typography.caption,
    flex: 1,
    color: colors.warning[900],
    lineHeight: 18,
  },
});
