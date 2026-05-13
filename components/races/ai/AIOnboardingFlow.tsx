import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

const AI_ONBOARDING_KEY = 'race_ai_onboarding_complete_v1';

interface AIOnboardingFlowProps {
  visible?: boolean;
  onComplete?: () => void;
  onSkip?: () => void;
}

const STEPS = [
  {
    title: 'Phase-aware advice',
    body: 'Get tactical guidance before and during races.',
  },
  {
    title: 'Use Skill Buttons',
    body: 'Tap a skill for immediate tactical guidance.',
  },
  {
    title: 'Trust with Context',
    body: 'Each recommendation includes confidence and source context.',
  },
];

export function AIOnboardingFlow({ visible, onComplete, onSkip }: AIOnboardingFlowProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof visible === 'boolean') {
      setIsVisible(visible);
      return;
    }

    AsyncStorage.getItem(AI_ONBOARDING_KEY).then((value) => {
      setIsVisible(value !== 'true');
    });
  }, [visible]);

  const finish = async () => {
    await AsyncStorage.setItem(AI_ONBOARDING_KEY, 'true');
    setIsVisible(false);
    onComplete?.();
  };

  const skip = async () => {
    await AsyncStorage.setItem(AI_ONBOARDING_KEY, 'true');
    setIsVisible(false);
    onSkip?.();
  };

  if (!isVisible) return null;

  const current = STEPS[step];
  const atEnd = step === STEPS.length - 1;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={skip}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.kicker}>Onboarding</Text>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.body}>{current.body}</Text>

          <View style={styles.progressRow}>
            {STEPS.map((_, index) => (
              <View
                key={String(index)}
                style={[styles.dot, index === step && styles.dotActive]}
              />
            ))}
          </View>

          <View style={styles.actions}>
            <Pressable style={[styles.button, styles.ghost]} onPress={skip}>
              <Text style={styles.ghostText}>Skip</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.primary]}
              onPress={() => {
                if (atEnd) {
                  void finish();
                } else {
                  setStep((prev) => prev + 1);
                }
              }}
            >
              <Text style={styles.primaryText}>{atEnd ? 'Start' : 'Next'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#475569',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: '#334155',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CBD5E1',
  },
  dotActive: {
    backgroundColor: '#2563EB',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  button: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: {
    backgroundColor: '#E2E8F0',
  },
  primary: {
    backgroundColor: '#1D4ED8',
  },
  ghostText: {
    color: '#0F172A',
    fontWeight: '600',
    fontSize: 14,
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
